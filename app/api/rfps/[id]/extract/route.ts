import { safeErrorSummary } from "@/lib/safe-log";
import { reportError } from "@/lib/monitoring";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma, RfpStatus } from "@/lib/generated/prisma";
import { beginAiOperation, refundAllowance } from "@/lib/ai-guard";
import { usageRecorder } from "@/lib/ai-usage";
import { friendlyLlmError } from "@/lib/llm";
import { DocumentReadError } from "@/lib/document-safety";
import { verifyExtraction } from "@/lib/extraction-checks";
import { parseKeyDetails } from "@/lib/key-details";
import { readRfpDocument } from "@/lib/ocr";
import { changesFlag, diffRequirements, type RequirementLists } from "@/lib/requirement-diff";
import {
  detectQuestionnaire,
  readSpreadsheet,
  sheetQuestions,
  spreadsheetFormat,
  summarizeSheets,
} from "@/lib/spreadsheet";
import {
  deadlineToDate,
  downloadRfpFile,
  extractRequirementsWithLlm,
  prepareExtractionText,
} from "@/lib/rfp-extract";
import { resetPlanKeepingCover } from "@/lib/rfp-draft";

export const runtime = "nodejs";

class AddendumError extends Error {}

const asList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function requirementLists(rfp: {
  extractedDeadline: Date | null;
  extractedEligibility: unknown;
  extractedDesirable: unknown;
  extractedEvaluationCriteria: unknown;
  extractedSubmission: unknown;
  extractedQuestionnaire: unknown;
}): RequirementLists {
  return {
    deadline: rfp.extractedDeadline ? rfp.extractedDeadline.toISOString().slice(0, 10) : null,
    eligibility: asList(rfp.extractedEligibility),
    desirable: asList(rfp.extractedDesirable),
    evaluation: asList(rfp.extractedEvaluationCriteria),
    submission: asList(rfp.extractedSubmission),
    questionnaire: asList(rfp.extractedQuestionnaire),
  };
}
// Long RFPs take more than a minute to read; a killed request would leave the RFP stuck.
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** The steps an extraction goes through, reported live to the browser when it asks for progress. */
export type ExtractionStep = "download" | "read" | "addenda" | "extract" | "check" | "save";
type Report = (step: ExtractionStep, detail?: string) => void;

/**
 * Runs the extraction, streaming one JSON line per step and a final line with
 * the result (the same status and body the plain JSON response would have).
 */
function streamWithProgress(work: (report: Report) => Promise<Response>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const response = await work((step, detail) => send({ type: "step", step, ...(detail ? { detail } : {}) }));
      send({ type: "result", status: response.status, body: await response.json() });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: { select: { tier: true } } },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Complete onboarding before extracting RFPs." },
      { status: 403 },
    );
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id, userId: user.id },
    include: { files: { orderBy: { createdAt: "asc" } } },
  });

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  if (!rfp.originalFileUrl) {
    return NextResponse.json(
      { error: "This RFP has no uploaded file to extract from." },
      { status: 400 },
    );
  }

  // A request killed mid-extraction (timeout, deploy) leaves the status behind.
  // It is only genuinely running while the account's AI lock is held.
  const extractionRunning =
    rfp.status === RfpStatus.extracting && Boolean(user.aiBusyUntil && user.aiBusyUntil > new Date());
  if (extractionRunning) {
    return NextResponse.json(
      { error: "Extraction is already in progress." },
      { status: 409 },
    );
  }

  const guard = await beginAiOperation({
    user,
    tier: user.subscription?.tier ?? "free",
    rfpId: rfp.id,
    operation: "extract",
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const work = async (report: Report): Promise<Response> => {
    const previousStatus =
      rfp.status === RfpStatus.extracting
        ? rfp.extractedDocumentType
          ? RfpStatus.extracted
          : RfpStatus.uploaded
        : rfp.status;

    await prisma.rfp.update({
      where: { id: rfp.id },
      data: { status: RfpStatus.extracting },
    });

    try {
      report("download");
      const { buffer, fileName } = await downloadRfpFile(rfp.originalFileUrl!);
      // Scanned PDFs are read with OCR through the same AI provider (metered as "ocr").
      report("read");
      const read = await readRfpDocument(
        buffer,
        fileName,
        usageRecorder({ userId: user.id, rfpId: rfp.id, action: "ocr" }),
      );
      if (!read.ok) {
        await refundAllowance(rfp.id, "extract");
        await prisma.rfp.update({ where: { id: rfp.id }, data: { status: previousStatus } });
        return NextResponse.json({ error: read.error }, { status: 422 });
      }
      // Addenda are read after the original; later ones override earlier text (extraction rule 2).
      const onUsage = usageRecorder({ userId: user.id, rfpId: rfp.id, action: "ocr" });
      const addendumTexts: string[] = [];
      for (const [index, file] of rfp.files.entries()) {
        report("addenda", `${index + 1} of ${rfp.files.length}: ${file.fileName}`);
        const download = await downloadRfpFile(file.fileUrl);
        const addendum = await readRfpDocument(download.buffer, download.fileName, onUsage);
        if (!addendum.ok) {
          throw new AddendumError(`Addendum "${file.fileName}" could not be read: ${addendum.error}`);
        }
        read.flags.push(...addendum.flags);
        addendumTexts.push(
          `=== ADDENDUM ${index + 1}: ${file.fileName} (added ${file.createdAt.toISOString().slice(0, 10)}; overrides the original and earlier addenda) ===\n${addendum.text}`,
        );
      }
      const documentText = [read.text, ...addendumTexts].join("\n\n");
      const newAddenda = rfp.files.filter((file) => !file.includedAt);
      // Spreadsheet questionnaires: the questions are the sheet's rows, so each answer can go back in its row.
      const format = spreadsheetFormat(fileName);
      const sheets = format ? await readSpreadsheet(new Uint8Array(buffer), format) : [];
      const sheet = format ? sheetQuestions(detectQuestionnaire(sheets, format)) : null;
      const questionnaireMap = sheet?.map
        ? { ...sheet.map, sheets: summarizeSheets(sheets) }
        : format
          ? { format, sheet: sheets[0]?.name ?? "", headerRow: null, questionColumn: "A", answerColumn: "B", idColumn: null, rows: [], sheets: summarizeSheets(sheets) }
          : null;

      report("extract");
      const extracted = await extractRequirementsWithLlm(
        documentText,
        usageRecorder({ userId: user.id, rfpId: rfp.id, action: "extract" }),
      );

      report("check");
      // Deterministic checks against the document, plus a notice if it was too long to read in full.
      const { truncated, readPercent } = prepareExtractionText(documentText);
      // Each detail's page comes from finding its quote in the document, not from the model.
      const keyDetails = parseKeyDetails(extracted.keyDetails, documentText);
      const unverified = keyDetails.filter((detail) => !detail.verified).length;

      if (sheet?.questions) {
        extracted.questionnaireItems = sheet.questions;
      }
      const flags = [
        ...(sheet?.flags ?? []),
        ...read.flags,
        ...extracted.flaggedForReview,
        ...verifyExtraction(extracted, documentText).flags,
        ...(unverified > 0
          ? [`Key details: ${unverified} could not be matched to the document's wording and are marked "check". Confirm them against the original.`]
          : []),
        ...(truncated
          ? [`Document length: only the first ${readPercent}% of this document was read. Check the later sections (appendices, forms, questionnaires) and add any requirements they contain.`]
          : []),
      ];
      extracted.flaggedForReview = [...new Set(flags)];

      // When new addenda were read into an earlier extraction, record what they changed.
      const changes =
        newAddenda.length > 0 && rfp.extractedDocumentType
          ? diffRequirements(
              requirementLists(rfp),
              requirementLists({
                extractedDeadline: deadlineToDate(extracted.deadline),
                extractedEligibility: extracted.eligibilityCriteria,
                extractedDesirable: extracted.desirableCriteria,
                extractedEvaluationCriteria: extracted.evaluationCriteria,
                extractedSubmission: extracted.submissionRequirements,
                extractedQuestionnaire: extracted.questionnaireItems,
              }),
              newAddenda.map((file) => file.fileName),
            )
          : null;
      if (changes) {
        extracted.flaggedForReview = [changesFlag(changes), ...extracted.flaggedForReview];
      }

      report("save");
      const updated = await prisma.rfp.update({
        where: { id: rfp.id },
        data: {
          status: RfpStatus.extracted,
          extractedScope: extracted.scope,
          extractedDeadline: deadlineToDate(extracted.deadline),
          extractedEligibility: extracted.eligibilityCriteria,
          extractedEvaluationCriteria: extracted.evaluationCriteria,
          extractedDocumentType: extracted.documentType,
          extractedDesirable: extracted.desirableCriteria,
          extractedQuestionnaire: extracted.questionnaireItems,
          extractedFlags: extracted.flaggedForReview,
          extractedSubmission: extracted.submissionRequirements,
          // Postgres text columns reject NUL bytes, which some PDFs contain.
          sourceText: documentText.replace(/\u0000/g, ""),
          questionnaireMap: questionnaireMap ?? Prisma.DbNull,
          extractedDetails: keyDetails as unknown as Prisma.InputJsonValue,
          ...(changes ? { extractionChanges: changes as unknown as Prisma.InputJsonValue } : {}),
          draftPlan: resetPlanKeepingCover(rfp.draftPlan) ?? Prisma.DbNull,
        },
      });

      if (newAddenda.length > 0) {
        await prisma.rfpFile.updateMany({
          where: { id: { in: newAddenda.map((file) => file.id) } },
          data: { includedAt: new Date() },
        });
      }

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        extracted: {
          documentType: extracted.documentType,
          scope: extracted.scope,
          deadline: extracted.deadline,
          eligibilityCriteria: extracted.eligibilityCriteria,
          desirableCriteria: extracted.desirableCriteria,
          evaluationCriteria: extracted.evaluationCriteria,
          questionnaireItems: extracted.questionnaireItems,
          flaggedForReview: extracted.flaggedForReview,
          submissionRequirements: extracted.submissionRequirements,
        },
      });
    } catch (error) {
      await prisma.rfp
        .update({
          where: { id: rfp.id },
          data: { status: previousStatus },
        })
        .catch(() => undefined);
      // A failed attempt should not use up one of the proposal's extractions.
      await refundAllowance(rfp.id, "extract");

      if (error instanceof DocumentReadError || error instanceof AddendumError) {
        return NextResponse.json({ error: error.message }, { status: 422 });
      }

      const message = friendlyLlmError(error, "extraction", "Extraction failed. Try again in a moment.");

      console.error("RFP extraction failed:", safeErrorSummary(error));
      reportError(error, { area: "extract", userId: user.id, rfpId: rfp.id });
      return NextResponse.json({ error: message }, { status: 500 });
    } finally {
      await guard.release();
    }
  };

  // The app's extraction screen asks for live progress; other callers get one JSON response.
  if ((request.headers.get("accept") ?? "").includes("application/x-ndjson")) return streamWithProgress(work);
  return work(() => undefined);
}

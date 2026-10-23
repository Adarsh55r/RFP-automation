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
import {
  deadlineToDate,
  downloadRfpFile,
  extractRequirementsWithLlm,
  extractTextFromDocument,
  NO_TEXT_MESSAGE,
  prepareExtractionText,
} from "@/lib/rfp-extract";
import { resetPlanKeepingCover } from "@/lib/rfp-draft";

export const runtime = "nodejs";
// Long RFPs take more than a minute to read; a killed request would leave the RFP stuck.
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
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
    const { buffer, fileName } = await downloadRfpFile(rfp.originalFileUrl);
    const documentText = await extractTextFromDocument(buffer, fileName);
    if (!documentText.trim()) {
      await refundAllowance(rfp.id, "extract");
      await prisma.rfp.update({ where: { id: rfp.id }, data: { status: previousStatus } });
      return NextResponse.json({ error: NO_TEXT_MESSAGE }, { status: 422 });
    }
    const extracted = await extractRequirementsWithLlm(
      documentText,
      usageRecorder({ userId: user.id, rfpId: rfp.id, action: "extract" }),
    );

    // Deterministic checks against the document, plus a notice if it was too long to read in full.
    const { truncated, readPercent } = prepareExtractionText(documentText);
    const flags = [
      ...extracted.flaggedForReview,
      ...verifyExtraction(extracted, documentText).flags,
      ...(truncated
        ? [`Document length: only the first ${readPercent}% of this document was read. Check the later sections (appendices, forms, questionnaires) and add any requirements they contain.`]
        : []),
    ];
    extracted.flaggedForReview = [...new Set(flags)];

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
        draftPlan: resetPlanKeepingCover(rfp.draftPlan) ?? Prisma.DbNull,
      },
    });

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

    if (error instanceof DocumentReadError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    const message = friendlyLlmError(error, "extraction", "Extraction failed. Try again in a moment.");

    console.error("RFP extraction failed:", error);
    reportError(error, { area: "extract", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await guard.release();
  }
}

import { safeErrorSummary } from "@/lib/safe-log";
import { reportError } from "@/lib/monitoring";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  buildProposalDocument,
  draftsReadyForExport,
  isExportFormat,
  isExportVariant,
  proposalExportFileName,
} from "@/lib/proposal-document";
import { buildProposalDocxBuffer } from "@/lib/rfp-export";
import { buildProposalPdfBuffer } from "@/lib/rfp-export-pdf";
import { PDFDocument } from "pdf-lib";
import { storedKeyDetails } from "@/lib/key-details";
import { pageLimitFrom, pageLimitWarning } from "@/lib/page-limit";
import { downloadRfpFile } from "@/lib/rfp-extract";
import {
  matchAnswers,
  parseQuestionnaireMap,
  writeAnswersToCsv,
  writeAnswersToXlsx,
} from "@/lib/spreadsheet";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const contentTypes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const requested = params.get("format") ?? "docx";
  const includeComplianceMatrix = params.get("matrix") === "1";
  if (requested === "sheet") {
    return exportSpreadsheet(clerkId, id);
  }
  if (!isExportFormat(requested)) {
    return NextResponse.json({ error: "Format must be docx or pdf." }, { status: 400 });
  }
  const format = requested;
  const requestedVariant = params.get("variant") ?? "submission";
  if (!isExportVariant(requestedVariant)) {
    return NextResponse.json({ error: "Variant must be submission or review." }, { status: 400 });
  }
  const variant = requestedVariant;

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Complete onboarding before exporting." },
      { status: 403 },
    );
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id, userId: user.id },
    include: { drafts: true },
  });

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  if (
    rfp.status !== RfpStatus.drafting &&
    rfp.status !== RfpStatus.drafted &&
    rfp.status !== RfpStatus.exported
  ) {
    return NextResponse.json(
      { error: "Generate a draft before exporting." },
      { status: 400 },
    );
  }

  if (!draftsReadyForExport(rfp, rfp.drafts)) {
    return NextResponse.json(
      { error: "There is no drafted content to export yet. Finish drafting first." },
      { status: 400 },
    );
  }

  try {
    const doc = buildProposalDocument({
      companyName: user.agencyName?.trim() || "Your company",
      rfp,
      drafts: rfp.drafts,
      includeComplianceMatrix,
      variant,
    });
    const bytes =
      format === "pdf"
        ? await buildProposalPdfBuffer(doc)
        : Buffer.from(await buildProposalDocxBuffer(doc));

    // Page-limit check: the PDF's real page count, or for Word the count of
    // the same content laid out as PDF (Word's own layout can differ a little).
    const limit = pageLimitFrom(storedKeyDetails(rfp.extractedDetails), rfp.extractedSubmission);
    let pageHeaders: Record<string, string> = {};
    if (limit) {
      const pdfBytes = format === "pdf" ? bytes : await buildProposalPdfBuffer(doc);
      const pageCount = (await PDFDocument.load(new Uint8Array(pdfBytes), { updateMetadata: false })).getPageCount();
      const warning = pageLimitWarning(pageCount, limit, format !== "pdf");
      pageHeaders = {
        "X-Page-Count": String(pageCount),
        "X-Page-Limit": String(limit.pages),
        ...(warning ? { "X-Page-Warning": encodeURIComponent(warning) } : {}),
      };
    }

    // An internal review copy is not the final export.
    if (variant === "submission") {
      await prisma.rfp.update({
        where: { id: rfp.id },
        data: { status: RfpStatus.exported },
      });
    }

    const fileName = proposalExportFileName(doc.cover.projectTitle, format, variant);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypes[format],
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        ...pageHeaders,
      },
    });
  } catch (error) {
    console.error(`RFP ${format.toUpperCase()} export failed:`, safeErrorSummary(error));
    reportError(error, { area: "export", userId: user.id, rfpId: rfp.id, extra: { format } });
    return NextResponse.json(
      { error: "Export failed. Try again in a moment." },
      { status: 500 },
    );
  }
}

/**
 * A spreadsheet questionnaire comes back as the buyer's own file with each
 * drafted answer written into its row (markers removed, gaps kept visible).
 */
async function exportSpreadsheet(clerkId: string, id: string) {
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "Complete onboarding before exporting." }, { status: 403 });
  }
  const rfp = await prisma.rfp.findFirst({
    where: { id, userId: user.id },
    include: { drafts: { where: { sectionName: "responses" } } },
  });
  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }
  const map = parseQuestionnaireMap(rfp.questionnaireMap);
  if (!map || !rfp.originalFileUrl) {
    return NextResponse.json({ error: "This RFP was not uploaded as a spreadsheet." }, { status: 400 });
  }
  const responses = rfp.drafts[0]?.content ?? "";
  if (!responses.trim() || map.rows.length === 0) {
    return NextResponse.json({ error: "Draft the questionnaire answers before exporting the spreadsheet." }, { status: 400 });
  }

  try {
    const answers = matchAnswers(map.rows, responses);
    const { buffer, fileName: storedName } = await downloadRfpFile(rfp.originalFileUrl);
    let bytes: Uint8Array;
    let skipped: string[] = [];
    if (map.format === "xlsx") {
      ({ bytes, skipped } = await writeAnswersToXlsx(new Uint8Array(buffer), map, answers));
    } else {
      bytes = new TextEncoder().encode(writeAnswersToCsv(buffer.toString("utf8"), map, answers));
    }
    await prisma.rfp.update({ where: { id: rfp.id }, data: { status: RfpStatus.exported } });

    const base = storedName.replace(/\.(xlsx|csv)$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "questionnaire";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypes[map.format],
        "Content-Disposition": `attachment; filename="${base}-answered.${map.format}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        // How many question rows did not get an answer, so the app can say so.
        "X-Unanswered-Rows": String(map.rows.length - answers.size + skipped.length),
      },
    });
  } catch (error) {
    console.error("Spreadsheet export failed:", safeErrorSummary(error));
    reportError(error, { area: "export", userId: user.id, rfpId: rfp.id, extra: { format: map.format } });
    return NextResponse.json({ error: "Export failed. Try again in a moment." }, { status: 500 });
  }
}

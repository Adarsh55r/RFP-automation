import { NextResponse } from "next/server";
import { usageCostMicros } from "@/lib/ai-usage";
import { DocumentReadError, officeFileProblem } from "@/lib/document-safety";
import { verifyExtraction } from "@/lib/extraction-checks";
import { clientIp, finishFreeToolRun, FREE_TOOL, freeToolLimit, hashIp, startFreeToolRun } from "@/lib/free-tool";
import { hiddenTextFlags } from "@/lib/hidden-text";
import { parseKeyDetails } from "@/lib/key-details";
import { friendlyLlmError } from "@/lib/llm";
import { textLayerIsThin } from "@/lib/ocr";
import { extractRequirementsWithLlm, readDocumentText } from "@/lib/rfp-extract";
import { looksLikeRfpFile } from "@/lib/rfp-upload";
import { safeErrorSummary } from "@/lib/safe-log";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Free requirement checklist, no account. The file is read in memory and
 * dropped when the request ends: it is never written to storage, the
 * database or logs. Uses the same extraction as the app.
 */
export async function POST(request: Request) {
  const ipHash = hashIp(clientIp(request));
  const limited = await freeToolLimit(ipHash);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a PDF or Word file." }, { status: 400 });
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    return NextResponse.json({ error: "The free checklist reads PDF and Word (.docx) files." }, { status: 400 });
  }
  if (file.size > FREE_TOOL.maxBytes) {
    return NextResponse.json({ error: "The free checklist reads files up to 4 MB. Create a free account for files up to 25 MB." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeRfpFile(bytes, file.name)) {
    return NextResponse.json({ error: "This file is not a valid PDF or Word (.docx) document." }, { status: 400 });
  }
  const unsafe = officeFileProblem(bytes, file.name);
  if (unsafe) return NextResponse.json({ error: unsafe }, { status: 400 });

  const runId = await startFreeToolRun(ipHash);
  try {
    const { text, pageCount, hidden } = await readDocumentText(Buffer.from(bytes), file.name);
    if (pageCount !== null && pageCount > FREE_TOOL.maxPages) {
      return NextResponse.json(
        { error: `The free checklist reads up to ${FREE_TOOL.maxPages} pages. Create a free account to read the whole document.` },
        { status: 413 },
      );
    }
    if (!text.trim() || (pageCount !== null && textLayerIsThin(text, pageCount))) {
      return NextResponse.json(
        { error: "This looks like a scanned document. Scans are read with OCR in the app: create a free account to use it." },
        { status: 422 },
      );
    }
    const truncated = text.length > FREE_TOOL.maxChars;
    const documentText = truncated ? text.slice(0, FREE_TOOL.maxChars) : text;

    let costMicros = 0;
    const extracted = await extractRequirementsWithLlm(documentText, (usage) => {
      costMicros += usageCostMicros(usage);
    });
    await finishFreeToolRun(runId, costMicros);

    const flags = [
      ...hiddenTextFlags(hidden, documentText),
      ...extracted.flaggedForReview,
      ...verifyExtraction(extracted, documentText).flags,
      ...(truncated ? [`Only the first ${FREE_TOOL.maxChars.toLocaleString("en-US")} characters were read. Create a free account to read the whole document.`] : []),
    ];
    return NextResponse.json({
      documentType: extracted.documentType,
      scope: extracted.scope,
      deadline: extracted.deadline,
      mandatory: extracted.eligibilityCriteria,
      desirable: extracted.desirableCriteria,
      evaluation: extracted.evaluationCriteria,
      submission: extracted.submissionRequirements,
      questions: extracted.questionnaireItems.slice(0, 50),
      questionCount: extracted.questionnaireItems.length,
      keyDetails: parseKeyDetails(extracted.keyDetails, documentText),
      flags: [...new Set(flags)],
    });
  } catch (error) {
    if (error instanceof DocumentReadError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Free checklist failed:", safeErrorSummary(error));
    return NextResponse.json(
      { error: friendlyLlmError(error, "extraction", "The checklist could not be built. Try again in a moment.") },
      { status: 500 },
    );
  }
}

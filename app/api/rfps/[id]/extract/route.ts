import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma, RfpStatus } from "@/lib/generated/prisma";
import { beginAiOperation } from "@/lib/ai-guard";
import { usageRecorder } from "@/lib/ai-usage";
import { friendlyLlmError } from "@/lib/llm";
import {
  deadlineToDate,
  downloadRfpFile,
  extractRequirementsWithLlm,
  extractTextFromDocument,
} from "@/lib/rfp-extract";
import { resetPlanKeepingCover } from "@/lib/rfp-draft";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (rfp.status === RfpStatus.extracting) {
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

  const previousStatus = rfp.status;

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: { status: RfpStatus.extracting },
  });

  try {
    const { buffer, fileName } = await downloadRfpFile(rfp.originalFileUrl);
    const documentText = await extractTextFromDocument(buffer, fileName);
    const extracted = await extractRequirementsWithLlm(
      documentText,
      usageRecorder({ userId: user.id, rfpId: rfp.id, action: "extract" }),
    );

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

    const message = friendlyLlmError(error, "extraction", "Extraction failed. Try again in a moment.");

    console.error("RFP extraction failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await guard.release();
  }
}

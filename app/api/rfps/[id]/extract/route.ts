import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  deadlineToDate,
  downloadRfpFile,
  extractRequirementsWithClaude,
  extractTextFromDocument,
} from "@/lib/rfp-extract";

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

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: { status: RfpStatus.extracting },
  });

  try {
    const { buffer, fileName } = await downloadRfpFile(rfp.originalFileUrl);
    const documentText = await extractTextFromDocument(buffer, fileName);
    const extracted = await extractRequirementsWithClaude(documentText);

    const updated = await prisma.rfp.update({
      where: { id: rfp.id },
      data: {
        status: RfpStatus.extracted,
        extractedScope: extracted.scope,
        extractedDeadline: deadlineToDate(extracted.deadline),
        extractedEligibility: extracted.eligibilityCriteria,
        extractedEvaluationCriteria: extracted.evaluationCriteria,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      extracted: {
        scope: extracted.scope,
        deadline: extracted.deadline,
        eligibilityCriteria: extracted.eligibilityCriteria,
        evaluationCriteria: extracted.evaluationCriteria,
      },
    });
  } catch (error) {
    await prisma.rfp
      .update({
        where: { id: rfp.id },
        data: { status: RfpStatus.uploaded },
      })
      .catch(() => undefined);

    const message =
      error instanceof Error &&
      error.message.includes("Anthropic is not configured")
        ? "AI extraction is not configured yet. Add ANTHROPIC_API_KEY."
        : error instanceof Error
          ? error.message
          : "Extraction failed. Try again in a moment.";

    console.error("RFP extraction failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import { isRfpDocumentType } from "@/lib/rfp-extract";
import { editableTextToList } from "@/lib/rfp-extract-form";
import { deadlineToDate } from "@/lib/rfp-extract";

export type ConfirmExtractionPayload = {
  rfpId: string;
  documentType: string;
  scope: string;
  deadline: string;
  eligibilityCriteria: string;
  desirableCriteria: string;
  evaluationCriteria: string;
  questionnaireItems: string;
  flaggedForReview: string;
};

export async function confirmExtraction(payload: ConfirmExtractionPayload) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return { ok: false as const, error: "Complete onboarding first." };
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id: payload.rfpId, userId: user.id },
  });

  if (!rfp) {
    return { ok: false as const, error: "RFP not found." };
  }

  if (
    rfp.status !== RfpStatus.extracted &&
    rfp.status !== RfpStatus.drafting &&
    rfp.status !== RfpStatus.drafted &&
    rfp.status !== RfpStatus.exported
  ) {
    return {
      ok: false as const,
      error: "Extract requirements before confirming.",
    };
  }

  const scope = payload.scope.trim();
  const eligibilityCriteria = editableTextToList(payload.eligibilityCriteria);
  const desirableCriteria = editableTextToList(payload.desirableCriteria);
  const evaluationCriteria = editableTextToList(payload.evaluationCriteria);
  const questionnaireItems = editableTextToList(payload.questionnaireItems);
  const flaggedForReview = editableTextToList(payload.flaggedForReview);

  if (
    !scope &&
    eligibilityCriteria.length === 0 &&
    questionnaireItems.length === 0
  ) {
    return {
      ok: false as const,
      error:
        "Add a scope summary, at least one eligibility criterion, or questionnaire items before continuing.",
    };
  }

  const deadline = payload.deadline.trim()
    ? deadlineToDate(payload.deadline.trim())
    : null;

  if (payload.deadline.trim() && !deadline) {
    return {
      ok: false as const,
      error: "Deadline must be a valid date (YYYY-MM-DD).",
    };
  }

  const nextStatus =
    rfp.status === RfpStatus.extracted || rfp.status === RfpStatus.drafting
      ? RfpStatus.drafting
      : rfp.status;

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: {
      extractedDocumentType: isRfpDocumentType(payload.documentType)
        ? payload.documentType
        : "other",
      extractedScope: scope,
      extractedDeadline: deadline,
      extractedEligibility: eligibilityCriteria,
      extractedDesirable: desirableCriteria,
      extractedEvaluationCriteria: evaluationCriteria,
      extractedQuestionnaire: questionnaireItems,
      extractedFlags: flaggedForReview,
      status: nextStatus,
    },
  });

  revalidatePath(`/dashboard/rfps/${rfp.id}`);
  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  revalidatePath("/dashboard");

  return { ok: true as const, status: nextStatus };
}

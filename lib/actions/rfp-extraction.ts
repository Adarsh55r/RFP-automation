"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import { editableTextToList } from "@/lib/rfp-extract-form";
import { deadlineToDate } from "@/lib/rfp-extract";

export type ConfirmExtractionPayload = {
  rfpId: string;
  scope: string;
  deadline: string;
  eligibilityCriteria: string;
  evaluationCriteria: string;
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
  if (!scope) {
    return { ok: false as const, error: "Scope cannot be empty." };
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
      extractedScope: scope,
      extractedDeadline: deadline,
      extractedEligibility: editableTextToList(payload.eligibilityCriteria),
      extractedEvaluationCriteria: editableTextToList(
        payload.evaluationCriteria,
      ),
      status: nextStatus,
    },
  });

  revalidatePath(`/dashboard/rfps/${rfp.id}`);
  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  revalidatePath("/dashboard");

  return { ok: true as const, status: nextStatus };
}

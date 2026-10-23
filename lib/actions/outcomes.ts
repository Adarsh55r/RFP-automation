"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { CURRENCIES, isOutcome } from "@/lib/outcomes";
import { recordFirst } from "@/lib/funnel";

/** Records what happened to a bid. Every field is optional; empty clears it. */
export async function updateBidOutcome(input: {
  rfpId: string;
  submittedAt: string | null;
  outcome: string | null;
  contractValue: string | null;
  contractCurrency: string | null;
  notes: string | null;
  hoursSaved: string | null;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false as const, error: "You must be signed in." };
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return { ok: false as const, error: "Complete onboarding first." };
  const rfp = await prisma.rfp.findFirst({ where: { id: input.rfpId, userId: user.id } });
  if (!rfp) return { ok: false as const, error: "RFP not found." };

  const submittedAt = input.submittedAt ? new Date(`${input.submittedAt}T12:00:00Z`) : null;
  if (submittedAt && (Number.isNaN(submittedAt.getTime()) || submittedAt.getTime() > Date.now() + 86_400_000)) {
    return { ok: false as const, error: "Enter the date you submitted the bid (not a future date)." };
  }
  const outcome = input.outcome || null;
  if (outcome !== null && !isOutcome(outcome)) return { ok: false as const, error: "Choose an outcome." };
  const value = input.contractValue?.replace(/[,\s]/g, "") || null;
  const contractValue = value === null ? null : Number(value);
  if (contractValue !== null && (!Number.isFinite(contractValue) || contractValue < 0 || contractValue > 10_000_000)) {
    return { ok: false as const, error: "Enter the contract value as a number (up to 10,000,000)." };
  }
  const currency = input.contractCurrency || null;
  if (currency !== null && !(CURRENCIES as readonly string[]).includes(currency)) {
    return { ok: false as const, error: "Choose a currency." };
  }
  const hours = input.hoursSaved?.trim() ? Number(input.hoursSaved) : null;
  if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 1000)) {
    return { ok: false as const, error: "Enter hours saved as a number between 0 and 1000." };
  }
  const notes = input.notes?.trim().slice(0, 2000) || null;

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: {
      submittedAt,
      outcome,
      outcomeAt: outcome && outcome !== rfp.outcome && outcome !== "pending" ? new Date() : outcome ? rfp.outcomeAt : null,
      contractValueCents: contractValue === null ? null : Math.round(contractValue * 100),
      contractCurrency: contractValue === null ? null : (currency ?? "USD"),
      outcomeNotes: notes,
      hoursSaved: hours,
    },
  });
  if (outcome || submittedAt) await recordFirst("outcome_logged", user.id);
  revalidatePath(`/dashboard/rfps/${rfp.id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

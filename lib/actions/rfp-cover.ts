"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { COVER_FIELDS, parseDraftPlan, resolveCover, type CoverDetails } from "@/lib/rfp-draft";

/**
 * Saves the bidder's cover-page edits into the RFP's bid plan. Only fields
 * the bidder actually changed are kept: a field still showing what the draft
 * filled in is not an edit, and must follow the next draft rather than pin
 * an old (possibly wrong) value forever.
 */
export async function saveCoverDetails(input: {
  rfpId: string;
  cover: Partial<Record<keyof CoverDetails, string>>;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return { ok: false as const, error: "Complete onboarding first." };
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id: input.rfpId, userId: user.id },
    select: { id: true, draftPlan: true, title: true },
  });
  if (!rfp) {
    return { ok: false as const, error: "RFP not found." };
  }

  const plan = parseDraftPlan(rfp.draftPlan);
  const drafted = resolveCover(
    { ...plan, cover: {} },
    { companyName: user.agencyName?.trim() || "Your company", rfpTitle: rfp.title },
  );
  const cover: Partial<CoverDetails> = { ...plan.cover };
  for (const field of COVER_FIELDS) {
    const value = input.cover[field];
    if (typeof value !== "string") continue;
    const next = value.trim().slice(0, 500);
    if (next === drafted[field]) delete cover[field];
    else cover[field] = next;
  }

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: {
      draftPlan: { ...plan, cover } as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  return { ok: true as const };
}

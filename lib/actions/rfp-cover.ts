"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { COVER_FIELDS, parseDraftPlan, type CoverDetails } from "@/lib/rfp-draft";

/** Saves the bidder's cover-page edits into the RFP's bid plan. */
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
    select: { id: true, draftPlan: true },
  });
  if (!rfp) {
    return { ok: false as const, error: "RFP not found." };
  }

  const cover: Partial<CoverDetails> = {};
  for (const field of COVER_FIELDS) {
    const value = input.cover[field];
    if (typeof value === "string") {
      cover[field] = value.trim().slice(0, 500);
    }
  }

  const plan = parseDraftPlan(rfp.draftPlan);
  await prisma.rfp.update({
    where: { id: rfp.id },
    data: {
      draftPlan: { ...plan, cover: { ...plan.cover, ...cover } } as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  return { ok: true as const };
}

import { cache } from "react";
import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import type { Prisma, SubscriptionTier } from "@/lib/generated/prisma";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * One RFP for its pages. Leaves out the full document text, which can run to
 * 400,000 characters and is only read by the AI routes.
 */
export const getRfpForUser = cache(async (rfpId: string, userId: string) => {
  return prisma.rfp.findFirst({
    where: { id: rfpId, userId },
    omit: { sourceText: true },
  });
});

/** Columns RFP lists show. Keeps large fields (full RFP text, bid plan) out of list queries. */
export const rfpListSelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  extractedDocumentType: true,
  extractedDeadline: true,
} satisfies Prisma.RfpSelect;

export type RfpListItem = Prisma.RfpGetPayload<{ select: typeof rfpListSelect }>;

/** By Clerk ID, so a page can load the list alongside the user lookup instead of after it. */
export async function getRfpsForClerkUser(clerkId: string) {
  return prisma.rfp.findMany({
    // Large uploads create the row before the file arrives; hide them until it does.
    where: { user: { clerkId }, originalFileUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: rfpListSelect,
  });
}

export async function getRfpUploadQuota(userId: string, tier: SubscriptionTier) {
  const monthStart = startOfMonth();
  const usedThisMonth = await prisma.rfp.count({
    where: {
      userId,
      createdAt: { gte: monthStart },
      // An abandoned upload (no file ever arrived) does not use up the quota.
      originalFileUrl: { not: null },
    },
  });

  const limit = monthlyRfpLimit[tier];

  return {
    usedThisMonth,
    limit,
    remaining: rfpsRemaining(tier, usedThisMonth),
  };
}

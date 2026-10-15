import { cache } from "react";
import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import type { Prisma, SubscriptionTier } from "@/lib/generated/prisma";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const getRfpForUser = cache(async (rfpId: string, userId: string) => {
  return prisma.rfp.findFirst({
    where: { id: rfpId, userId },
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

export async function getRfpsForUser(userId: string) {
  return prisma.rfp.findMany({
    where: { userId },
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
    },
  });

  const limit = monthlyRfpLimit[tier];

  return {
    usedThisMonth,
    limit,
    remaining: rfpsRemaining(tier, usedThisMonth),
  };
}

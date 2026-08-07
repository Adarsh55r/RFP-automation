import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import type { SubscriptionTier } from "@/lib/generated/prisma";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getRfpForUser(rfpId: string, userId: string) {
  return prisma.rfp.findFirst({
    where: { id: rfpId, userId },
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

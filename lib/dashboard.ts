import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import type { SubscriptionTier } from "@/lib/generated/prisma";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Lean user+subscription lookup, deduped per request.
 * Do not join RFPs here — layout and most pages don't need them.
 */
export const requireDashboardUser = cache(async () => {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  });
});

export async function getDashboardHomeData() {
  const user = await requireDashboardUser();
  if (!user) {
    return null;
  }

  const monthStart = startOfMonth();
  const tier: SubscriptionTier = user.subscription?.tier ?? "free";

  const [rfpsThisMonth, draftsInProgress, recentRfps] = await Promise.all([
    prisma.rfp.count({
      where: {
        userId: user.id,
        createdAt: { gte: monthStart },
      },
    }),
    prisma.rfp.count({
      where: {
        userId: user.id,
        status: { in: ["drafting", "drafted"] },
      },
    }),
    prisma.rfp.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const limit = monthlyRfpLimit[tier];
  const remaining = rfpsRemaining(tier, rfpsThisMonth);

  return {
    agencyName: user.agencyName ?? "Your agency",
    tier,
    stats: {
      rfpsThisMonth,
      rfpsRemaining: remaining,
      rfpsLimit: limit,
      draftsInProgress,
    },
    recentRfps,
  };
}


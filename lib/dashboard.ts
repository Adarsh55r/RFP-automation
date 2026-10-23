import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import { rfpListSelect } from "@/lib/rfps";
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
    include: {
      subscription: { select: { tier: true, status: true, currentPeriodEnd: true } },
    },
  });
});

export async function getDashboardHomeData() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  const monthStart = startOfMonth();
  // Filtering through the user's Clerk ID lets the counts run alongside the
  // user lookup: one database round trip instead of two in a row.
  // Unfinished uploads (no file yet) are left out, as on the RFP list.
  const owned = { user: { clerkId }, originalFileUrl: { not: null } };

  const [user, rfpsThisMonth, draftsInProgress, recentRfps] = await Promise.all([
    requireDashboardUser(),
    // From the usage ledger, matching the upload quota: deleted RFPs still count.
    prisma.proposalUsage.count({
      where: { user: { clerkId }, createdAt: { gte: monthStart } },
    }),
    prisma.rfp.count({
      where: { ...owned, status: { in: ["drafting", "drafted"] } },
    }),
    prisma.rfp.findMany({
      where: owned,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: rfpListSelect,
    }),
  ]);

  if (!user) {
    return null;
  }

  const tier: SubscriptionTier = user.subscription?.tier ?? "free";

  const limit = monthlyRfpLimit[tier];
  const remaining = rfpsRemaining(tier, rfpsThisMonth);

  return {
    agencyName: user.agencyName ?? "Your company",
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


import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { monthlyRfpLimit, rfpsRemaining } from "@/lib/plan-limits";
import type { SubscriptionTier } from "@/lib/generated/prisma";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function requireDashboardUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { clerkId },
    include: {
      subscription: true,
      rfps: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
}

export async function getDashboardHomeData() {
  const user = await requireDashboardUser();
  if (!user) {
    return null;
  }

  const monthStart = startOfMonth();
  const tier: SubscriptionTier = user.subscription?.tier ?? "free";

  const [rfpsThisMonth, draftsInProgress] = await Promise.all([
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
    recentRfps: user.rfps,
  };
}

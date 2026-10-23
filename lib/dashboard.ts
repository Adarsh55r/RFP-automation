import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { allowancePeriodStart, computeAllowance } from "@/lib/entitlements";
import { rfpListSelect } from "@/lib/rfps";
import { setupSteps } from "@/lib/library-readiness";
import { summarizeOutcomes } from "@/lib/outcomes";

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
      subscription: {
        select: { tier: true, status: true, currentPeriodEnd: true, planVersion: true, billingCycle: true, accessEndsAt: true },
      },
    },
  });
});

export async function getDashboardHomeData() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  const now = new Date();
  // Filtering through the user's Clerk ID lets the counts run alongside the
  // user lookup: one database round trip instead of two in a row.
  // Unfinished uploads (no file yet) are left out, as on the RFP list.
  const owned = { user: { clerkId }, originalFileUrl: { not: null } };
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [user, usedThisMonth, usedEver, draftsInProgress, recentRfps, libraryCounts, profile, outcomeRows] = await Promise.all([
    requireDashboardUser(),
    // Plan usage comes from the usage ledger, matching upload enforcement: deleted RFPs still count.
    prisma.proposalUsage.count({ where: { user: { clerkId }, createdAt: { gte: monthStart } } }),
    prisma.proposalUsage.count({ where: { user: { clerkId } } }),
    prisma.rfp.count({
      where: { ...owned, status: { in: ["drafting", "drafted"] } },
    }),
    prisma.rfp.findMany({
      where: owned,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: rfpListSelect,
    }),
    prisma.libraryItem.groupBy({ by: ["type"], where: { user: { clerkId } }, _count: { _all: true } }),
    prisma.libraryItem.findFirst({ where: { user: { clerkId }, type: "company_profile" }, select: { content: true } }),
    prisma.rfp.findMany({
      where: { user: { clerkId }, OR: [{ submittedAt: { not: null } }, { outcome: { not: null } }] },
      select: { submittedAt: true, outcome: true, contractValueCents: true, contractCurrency: true, hoursSaved: true },
    }),
  ]);

  if (!user) {
    return null;
  }

  const since = allowancePeriodStart(user.subscription, now);
  const used =
    since === undefined
      ? usedEver
      : since.getTime() === monthStart.getTime()
        ? usedThisMonth
        : await prisma.proposalUsage.count({ where: { userId: user.id, createdAt: { gte: since } } });
  const allowance = computeAllowance(user.subscription, used, now);

  return {
    agencyName: user.agencyName ?? "Your company",
    allowance: {
      planName: allowance.plan.name,
      used: allowance.used,
      limit: allowance.limit,
      remaining: allowance.remaining,
      periodLabel: allowance.periodLabel,
      overagePriceUsd: allowance.overagePriceUsd,
      accessEnded: allowance.accessEnded,
    },
    draftsInProgress,
    recentRfps,
    outcomes: summarizeOutcomes(outcomeRows),
    setup: setupSteps({
      counts: Object.fromEntries(libraryCounts.map((row) => [row.type, row._count._all])),
      profileLength: profile?.content.trim().length ?? 0,
      rfpCount: usedEver,
    }),
  };
}

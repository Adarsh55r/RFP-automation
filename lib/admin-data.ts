import { prisma } from "@/lib/db";
import { monthlySpendCapUsd, proposalAllowance } from "@/lib/ai-guard";
import { modelRates } from "@/lib/ai-usage";
import { monthlyRevenueUsd, PLANS, resolvePlan } from "@/lib/plans";
import type { SubscriptionStatus, SubscriptionTier } from "@/lib/generated/prisma";

/**
 * Read-only queries behind the admin panel. Revenue is estimated from each
 * account's plan list price, not from Dodo Payments' records.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYING_STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due"];

export const TIER_ORDER: SubscriptionTier[] = ["free", "single_bid", "starter", "pro", "consultant", "pilot", "growth", "agency"];

export function tierLabel(tier: SubscriptionTier) {
  return PLANS[tier]?.name ?? tier;
}

type SubscriptionPlanFields = { tier: SubscriptionTier; planVersion?: string | null; billingCycle?: string | null };

/** Monthly revenue a subscription brings in at its own (possibly grandfathered) list price. */
export function subscriptionRevenueUsd(subscription: SubscriptionPlanFields) {
  return monthlyRevenueUsd(resolvePlan(subscription), subscription.billingCycle);
}

function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type DailyPoint = { day: string; value: number };

/** Fills missing days with 0 so charts get a continuous series. */
function fillDays(rows: { day: Date; value: number }[], days: number, now = new Date()): DailyPoint[] {
  const byDay = new Map(rows.map((row) => [startOfDayUtc(new Date(row.day)).toISOString().slice(0, 10), row.value]));
  const today = startOfDayUtc(now);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today.getTime() - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return { day, value: byDay.get(day) ?? 0 };
  });
}

async function dailyCounts(table: "User" | "Rfp", since: Date) {
  const rows =
    table === "User"
      ? await prisma.$queryRaw<{ day: Date; value: number }[]>`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS value
          FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`
      : await prisma.$queryRaw<{ day: Date; value: number }[]>`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS value
          FROM "Rfp" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  return rows;
}

async function dailyCost(since: Date, userId?: string) {
  const rows = userId
    ? await prisma.$queryRaw<{ day: Date; value: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, (SUM("costMicros") / 1e6)::float8 AS value
        FROM "AiUsage" WHERE "createdAt" >= ${since} AND "userId" = ${userId} GROUP BY 1 ORDER BY 1`
    : await prisma.$queryRaw<{ day: Date; value: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, (SUM("costMicros") / 1e6)::float8 AS value
        FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  return rows;
}

function isPaying(subscription: { tier: SubscriptionTier; status: SubscriptionStatus } | null) {
  return Boolean(subscription && subscription.tier !== "free" && PAYING_STATUSES.includes(subscription.status));
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export async function getAdminOverview() {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const since30 = startOfDayUtc(new Date(now.getTime() - 29 * DAY_MS));
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const prev7 = new Date(now.getTime() - 14 * DAY_MS);

  const [
    totalUsers,
    newUsers7,
    newUsersPrev7,
    subscriptions,
    totalRfps,
    rfpsThisMonth,
    aiMonth,
    signups,
    proposals,
    cost,
    funnelRows,
    reviewClicks,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { createdAt: { gte: prev7, lt: since7 } } }),
    prisma.subscription.findMany({ select: { tier: true, status: true, planVersion: true, billingCycle: true } }),
    prisma.rfp.count(),
    prisma.rfp.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.aiUsage.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    dailyCounts("User", since30),
    dailyCounts("Rfp", since30),
    dailyCost(since30),
    prisma.$queryRaw<{ uploaded: number; drafted: number; exported: number }[]>`
      SELECT
        COUNT(DISTINCT "userId")::int AS uploaded,
        COUNT(DISTINCT "userId") FILTER (WHERE status::text IN ('drafted', 'exported') OR "fullDraftCount" > 0)::int AS drafted,
        COUNT(DISTINCT "userId") FILTER (WHERE status::text = 'exported')::int AS exported
      FROM "Rfp"`,
    prisma.user.count({ where: { reviewResponse: "reviewed" } }),
  ]);

  const planMix = TIER_ORDER.map((tier) => ({
    tier,
    label: tierLabel(tier),
    value: subscriptions.filter((sub) => sub.tier === tier).length,
  }));
  // Accounts created before subscriptions existed count as Free.
  planMix[0].value += Math.max(totalUsers - subscriptions.length, 0);

  const paying = subscriptions.filter(isPaying);
  const mrrUsd = paying.reduce((sum, sub) => sum + subscriptionRevenueUsd(sub), 0);
  const aiCostMonthUsd = (aiMonth._sum.costMicros ?? 0) / 1e6;
  const funnel = funnelRows[0] ?? { uploaded: 0, drafted: 0, exported: 0 };

  return {
    kpis: {
      totalUsers,
      newUsers7,
      newUsersPrev7,
      payingCustomers: paying.length,
      mrrUsd,
      aiCostMonthUsd,
      aiCallsMonth: aiMonth._count._all,
      grossMarginPct: mrrUsd > 0 ? ((mrrUsd - aiCostMonthUsd) / mrrUsd) * 100 : null,
      totalRfps,
      rfpsThisMonth,
    },
    series: {
      signups: fillDays(signups, 30, now),
      proposals: fillDays(proposals, 30, now),
      aiCost: fillDays(cost, 30, now),
    },
    planMix,
    funnel: [
      { stage: "Signed up", value: totalUsers },
      { stage: "Uploaded an RFP", value: funnel.uploaded },
      { stage: "Generated a draft", value: funnel.drafted },
      { stage: "Exported a proposal", value: funnel.exported },
      { stage: "Clicked the review link", value: reviewClicks },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export type CustomerRow = {
  id: string;
  email: string;
  company: string;
  teamSize: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  createdAt: string;
  lastActiveAt: string | null;
  rfpsTotal: number;
  rfpsThisMonth: number;
  rfpLimit: number | null;
  libraryItems: number;
  aiCallsMonth: number;
  aiCostMonthUsd: number;
  capUsd: number;
  capPct: number;
  revenueUsd: number;
  marginUsd: number;
  reviewResponse: string | null;
  flags: ("near-cap" | "at-cap" | "inactive" | "power-user" | "upsell")[];
};

export async function getCustomers(): Promise<CustomerRow[]> {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);

  const [users, rfpsMonth, aiMonth, lastRfp, lastAi] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        id: true,
        email: true,
        agencyName: true,
        teamSize: true,
        createdAt: true,
        reviewResponse: true,
        subscription: { select: { tier: true, status: true, planVersion: true, billingCycle: true } },
        _count: { select: { rfps: true, libraryItems: true } },
      },
    }),
    prisma.rfp.groupBy({ by: ["userId"], where: { createdAt: { gte: monthStart } }, _count: { _all: true } }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    prisma.rfp.groupBy({ by: ["userId"], _max: { createdAt: true } }),
    prisma.aiUsage.groupBy({ by: ["userId"], _max: { createdAt: true } }),
  ]);

  const rfpsMonthBy = new Map(rfpsMonth.map((row) => [row.userId, row._count._all]));
  const aiBy = new Map(aiMonth.map((row) => [row.userId, row]));
  const lastRfpBy = new Map(lastRfp.map((row) => [row.userId, row._max.createdAt]));
  const lastAiBy = new Map(lastAi.map((row) => [row.userId, row._max.createdAt]));

  return users.map((user) => {
    const tier = user.subscription?.tier ?? "free";
    const status = user.subscription?.status ?? "active";
    const ai = aiBy.get(user.id);
    const aiCostMonthUsd = (ai?._sum.costMicros ?? 0) / 1e6;
    const capUsd = monthlySpendCapUsd[tier];
    const capPct = Math.min((aiCostMonthUsd / capUsd) * 100, 999);
    const revenueUsd = isPaying(user.subscription) && user.subscription ? subscriptionRevenueUsd(user.subscription) : 0;
    const activity = [lastRfpBy.get(user.id), lastAiBy.get(user.id)].filter(Boolean) as Date[];
    const lastActive = activity.length ? new Date(Math.max(...activity.map((date) => date.getTime()))) : null;
    const rfpsThisMonth = rfpsMonthBy.get(user.id) ?? 0;
    const rfpLimit = resolvePlan(user.subscription).proposals.limit;

    const flags: CustomerRow["flags"] = [];
    if (capPct >= 100) flags.push("at-cap");
    else if (capPct >= 80) flags.push("near-cap");
    if (!lastActive || now.getTime() - lastActive.getTime() > 14 * DAY_MS) flags.push("inactive");
    if (rfpsThisMonth >= 5) flags.push("power-user");
    if (tier === "free" && rfpLimit !== null && rfpsThisMonth >= rfpLimit) flags.push("upsell");

    return {
      id: user.id,
      email: user.email,
      company: user.agencyName?.trim() || "—",
      teamSize: user.teamSize,
      tier,
      status,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: lastActive?.toISOString() ?? null,
      rfpsTotal: user._count.rfps,
      rfpsThisMonth,
      rfpLimit,
      libraryItems: user._count.libraryItems,
      aiCallsMonth: ai?._count._all ?? 0,
      aiCostMonthUsd,
      capUsd,
      capPct,
      revenueUsd,
      marginUsd: revenueUsd - aiCostMonthUsd,
      reviewResponse: user.reviewResponse,
      flags,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Customer detail                                                     */
/* ------------------------------------------------------------------ */

export async function getCustomerDetail(userId: string) {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const since30 = startOfDayUtc(new Date(now.getTime() - 29 * DAY_MS));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      clerkId: true,
      agencyName: true,
      teamSize: true,
      createdAt: true,
      aiBusyUntil: true,
      reviewPromptCount: true,
      reviewPromptedAt: true,
      reviewResponse: true,
      reviewRespondedAt: true,
      subscription: { select: { tier: true, status: true, currentPeriodEnd: true, planVersion: true, billingCycle: true } },
    },
  });
  if (!user) return null;

  const tier = user.subscription?.tier ?? "free";
  const [rfps, library, monthly, lifetime, recentCalls, cost] = await Promise.all([
    prisma.rfp.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        extractedDocumentType: true,
        extractCount: true,
        fullDraftCount: true,
        revisionCount: true,
      },
    }),
    prisma.libraryItem.groupBy({ by: ["type"], where: { userId }, _count: { _all: true } }),
    prisma.aiUsage.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { costMicros: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.aggregate({ where: { userId }, _sum: { costMicros: true }, _count: { _all: true } }),
    prisma.aiUsage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        action: true,
        model: true,
        inputTokens: true,
        cachedInputTokens: true,
        outputTokens: true,
        costMicros: true,
        createdAt: true,
        rfpId: true,
      },
    }),
    dailyCost(since30, userId),
  ]);

  const aiCostMonthUsd = (monthly._sum.costMicros ?? 0) / 1e6;
  const rfpsThisMonth = rfps.filter((rfp) => rfp.createdAt >= monthStart).length;

  return {
    user: {
      ...user,
      tier,
      status: user.subscription?.status ?? "active",
      aiLocked: Boolean(user.aiBusyUntil && user.aiBusyUntil > now),
    },
    allowance: proposalAllowance(tier),
    month: {
      aiCostUsd: aiCostMonthUsd,
      aiCalls: monthly._count._all,
      inputTokens: monthly._sum.inputTokens ?? 0,
      outputTokens: monthly._sum.outputTokens ?? 0,
      capUsd: monthlySpendCapUsd[tier],
      rfpsThisMonth,
      rfpLimit: resolvePlan(user.subscription).proposals.limit,
    },
    lifetime: { aiCostUsd: (lifetime._sum.costMicros ?? 0) / 1e6, aiCalls: lifetime._count._all },
    revenueUsd: isPaying(user.subscription) && user.subscription ? subscriptionRevenueUsd(user.subscription) : 0,
    rfps,
    library: Object.fromEntries(library.map((row) => [row.type, row._count._all])) as Record<string, number>,
    recentCalls: recentCalls.map((call) => ({ ...call, costUsd: call.costMicros / 1e6 })),
    costSeries: fillDays(cost, 30, now),
  };
}

/* ------------------------------------------------------------------ */
/* AI costs                                                            */
/* ------------------------------------------------------------------ */

export async function getAiCosts() {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const since30 = startOfDayUtc(new Date(now.getTime() - 29 * DAY_MS));

  const [byModel, byAction, topUsers, proposalRows, dailyByAction] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["model"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true, inputTokens: true, cachedInputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["action"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true },
      _count: { _all: true },
    }),
    prisma.aiUsage.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true },
      _count: { _all: true },
      orderBy: { _sum: { costMicros: "desc" } },
      take: 8,
    }),
    prisma.$queryRaw<{ proposals: number; cost: number; p95: number | null }[]>`
      SELECT COUNT(*)::int AS proposals,
             COALESCE(SUM(cost), 0)::float8 AS cost,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY cost)::float8 AS p95
      FROM (
        SELECT "rfpId", SUM("costMicros") / 1e6 AS cost
        FROM "AiUsage" WHERE "createdAt" >= ${monthStart} AND "rfpId" IS NOT NULL
        GROUP BY "rfpId"
      ) per_proposal`,
    prisma.$queryRaw<{ day: Date; action: string; value: number }[]>`
      SELECT date_trunc('day', "createdAt") AS day, action, (SUM("costMicros") / 1e6)::float8 AS value
      FROM "AiUsage" WHERE "createdAt" >= ${since30} GROUP BY 1, 2 ORDER BY 1`,
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: topUsers.map((row) => row.userId) } },
    select: { id: true, email: true, agencyName: true, subscription: { select: { tier: true } } },
  });
  const userBy = new Map(users.map((user) => [user.id, user]));

  const totalUsd = byModel.reduce((sum, row) => sum + (row._sum.costMicros ?? 0), 0) / 1e6;
  const cacheSavingsUsd = byModel.reduce((sum, row) => {
    const [input, cached] = modelRates(row.model);
    return sum + ((row._sum.cachedInputTokens ?? 0) * (input - cached)) / 1e6;
  }, 0);
  const inputTokens = byModel.reduce((sum, row) => sum + (row._sum.inputTokens ?? 0), 0);
  const cachedTokens = byModel.reduce((sum, row) => sum + (row._sum.cachedInputTokens ?? 0), 0);
  const proposals = proposalRows[0] ?? { proposals: 0, cost: 0, p95: null };

  const actions = ["extract", "full_draft", "revision"] as const;
  const days = fillDays([], 30, now).map((point) => point.day);
  const stacked = days.map((day) => {
    const entry: Record<string, number | string> = { day };
    for (const action of actions) {
      entry[action] =
        dailyByAction.find(
          (row) => startOfDayUtc(new Date(row.day)).toISOString().slice(0, 10) === day && row.action === action,
        )?.value ?? 0;
    }
    return entry;
  });

  return {
    totalUsd,
    calls: byModel.reduce((sum, row) => sum + row._count._all, 0),
    avgPerProposalUsd: proposals.proposals > 0 ? proposals.cost / proposals.proposals : 0,
    p95PerProposalUsd: proposals.p95 ?? 0,
    proposals: proposals.proposals,
    cacheSavingsUsd,
    cacheHitPct: inputTokens > 0 ? (cachedTokens / inputTokens) * 100 : 0,
    byModel: byModel
      .map((row) => ({
        model: row.model,
        costUsd: (row._sum.costMicros ?? 0) / 1e6,
        calls: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byAction: actions.map((action) => {
      const row = byAction.find((item) => item.action === action);
      return { action, costUsd: (row?._sum.costMicros ?? 0) / 1e6, calls: row?._count._all ?? 0 };
    }),
    topUsers: topUsers.map((row) => {
      const user = userBy.get(row.userId);
      const tier = user?.subscription?.tier ?? "free";
      const costUsd = (row._sum.costMicros ?? 0) / 1e6;
      return {
        userId: row.userId,
        email: user?.email ?? "deleted user",
        company: user?.agencyName ?? "—",
        tier,
        costUsd,
        calls: row._count._all,
        capPct: (costUsd / monthlySpendCapUsd[tier]) * 100,
      };
    }),
    stacked,
  };
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export async function getAlerts() {
  const now = new Date();
  const [customers, locked, heavyRfps] = await Promise.all([
    getCustomers(),
    prisma.user.findMany({
      where: { aiBusyUntil: { gt: now } },
      select: { id: true, email: true, agencyName: true, aiBusyUntil: true },
    }),
    prisma.rfp.findMany({
      where: { OR: [{ fullDraftCount: { gte: 2 } }, { revisionCount: { gte: 10 } }, { extractCount: { gte: 2 } }] },
      select: {
        id: true,
        title: true,
        extractCount: true,
        fullDraftCount: true,
        revisionCount: true,
        user: { select: { id: true, email: true, subscription: { select: { tier: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const exhausted = heavyRfps
    .map((rfp) => {
      const allowance = proposalAllowance(rfp.user.subscription?.tier ?? "free");
      const used: string[] = [];
      if (rfp.extractCount >= allowance.extract) used.push("extractions");
      if (rfp.fullDraftCount >= allowance.full_draft) used.push("full drafts");
      if (rfp.revisionCount >= allowance.revision) used.push("revisions");
      return { rfpId: rfp.id, title: rfp.title, userId: rfp.user.id, email: rfp.user.email, used };
    })
    .filter((rfp) => rfp.used.length > 0);

  return {
    atCap: customers.filter((row) => row.flags.includes("at-cap")),
    nearCap: customers.filter((row) => row.flags.includes("near-cap")),
    upsell: customers.filter((row) => row.flags.includes("upsell")),
    inactivePaying: customers.filter((row) => row.revenueUsd > 0 && row.flags.includes("inactive")),
    locked: locked.map((user) => ({ ...user, aiBusyUntil: user.aiBusyUntil?.toISOString() ?? null })),
    exhausted,
  };
}

export async function getAlertCount() {
  const alerts = await getAlerts();
  return alerts.atCap.length + alerts.nearCap.length + alerts.locked.length + alerts.upsell.length;
}

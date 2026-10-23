import { prisma } from "@/lib/db";
import { resolvePlan, type PlanDef } from "@/lib/plans";
import type { PlanId } from "@/types";

export type SubscriptionTerms = {
  tier: PlanId;
  planVersion?: string | null;
  accessEndsAt?: Date | null;
} | null | undefined;

export type ProposalAllowance = {
  plan: PlanDef;
  used: number;
  /** Null: no limit (legacy Team only). */
  limit: number | null;
  /** Null: no limit. */
  remaining: number | null;
  /** True once a one-time plan's access window has closed. */
  accessEnded: boolean;
  accessEndsAt: Date | null;
  /** USD price per extra proposal when over the limit, or null when the limit is hard. */
  overagePriceUsd: number | null;
  /** Short description of the period, for the dashboard header: "this month", "on your trial", … */
  periodLabel: string;
};

function startOfMonthUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the counting window for a plan's proposal limit; undefined means all time. */
export function allowancePeriodStart(subscription: SubscriptionTerms, now = new Date()): Date | undefined {
  const plan = resolvePlan(subscription);
  if (plan.proposals.per === "month") return startOfMonthUtc(now);
  const accessEndsAt = subscription?.accessEndsAt;
  if (plan.proposals.per === "access_period" && plan.billing.kind === "one_time" && accessEndsAt) {
    return new Date(accessEndsAt.getTime() - plan.billing.accessDays * 24 * 60 * 60 * 1000);
  }
  return undefined;
}

/** The allowance, given how many proposals were used in the plan's counting window. */
export function computeAllowance(subscription: SubscriptionTerms, used: number, now = new Date()): ProposalAllowance {
  const plan = resolvePlan(subscription);
  const accessEndsAt = subscription?.accessEndsAt ?? null;
  const accessEnded = plan.billing.kind === "one_time" && (!accessEndsAt || accessEndsAt <= now);
  const periodLabel =
    plan.proposals.per === "month"
      ? "this month"
      : plan.proposals.per === "access_period"
        ? "on your pass"
        : plan.billing.kind === "free"
          ? "on your free trial"
          : "in total";
  const limit = plan.proposals.limit;
  return {
    plan,
    used,
    limit,
    remaining: accessEnded ? 0 : limit === null ? null : Math.max(0, limit - used),
    accessEnded,
    accessEndsAt,
    overagePriceUsd: !accessEnded && plan.overage ? plan.overage.usd : null,
    periodLabel,
  };
}

/** How many proposals the plan includes, how many are used, and what happens past the limit. */
export async function getProposalAllowance(
  userId: string,
  subscription: SubscriptionTerms,
  now = new Date(),
): Promise<ProposalAllowance> {
  const since = allowancePeriodStart(subscription, now);
  const used = await prisma.proposalUsage.count({
    where: { userId, ...(since ? { createdAt: { gte: since } } : {}) },
  });
  return computeAllowance(subscription, used, now);
}

export type UploadDecision =
  | { ok: true; overageCents: number | null }
  | { ok: false; status: 402 | 403; error: string; overagePriceUsd?: number };

/**
 * Whether a new proposal may start. Past the limit, plans with overage need
 * the user to confirm the shown price first (`confirmedOverageUsd`).
 */
export function decideUpload(allowance: ProposalAllowance, confirmedOverageUsd?: number | null): UploadDecision {
  if (allowance.accessEnded) {
    return {
      ok: false,
      status: 403,
      error: "Your pass has ended. Subscribe to keep drafting proposals; your existing RFPs and drafts are still here.",
    };
  }
  if (allowance.remaining === null || allowance.remaining > 0) return { ok: true, overageCents: null };

  const price = allowance.overagePriceUsd;
  if (price === null) {
    const message =
      allowance.plan.billing.kind === "free"
        ? "Your free trial includes one proposal, and you have used it. Choose a plan to draft your next one; your first RFP and draft are still here."
        : allowance.plan.billing.kind === "one_time"
          ? "Your pass includes one proposal, and you have used it. Subscribe to draft more; if you subscribe within 30 days of buying the pass, its price is credited to your first invoice."
          : "You have used all the proposals your plan includes this period. Upgrade your plan to upload more.";
    return { ok: false, status: 403, error: message };
  }
  if (confirmedOverageUsd !== price) {
    return {
      ok: false,
      status: 402,
      error: `You have used the ${allowance.limit} proposals your plan includes ${allowance.periodLabel}. This one will cost $${price} extra.`,
      overagePriceUsd: price,
    };
  }
  return { ok: true, overageCents: Math.round(price * 100) };
}

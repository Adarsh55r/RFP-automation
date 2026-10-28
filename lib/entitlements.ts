import { prisma } from "@/lib/db";
import { resolvePlan, type PlanDef } from "@/lib/plans";
import type { PlanId } from "@/types";

export type SubscriptionTerms = {
  tier: PlanId;
  planVersion?: string | null;
  accessEndsAt?: Date | null;
  /** Dodo's subscription status; "on_hold" or "paused" means a renewal payment failed. */
  providerStatus?: string | null;
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
  /** True while a failed renewal payment holds the subscription: new proposals wait until it is paid. */
  paymentOnHold: boolean;
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
    paymentOnHold: subscription?.providerStatus === "on_hold" || subscription?.providerStatus === "paused",
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
  | { ok: true; useExtra: boolean }
  | { ok: false; status: 402 | 403; error: string; overagePriceUsd?: number };

/**
 * Whether a new proposal may start. Past the limit, an extra proposal the user
 * has already paid for (`extrasAvailable`) is used; plans that sell extras ask
 * for one to be bought first (402); other plans stop there (403).
 */
export function decideUpload(allowance: ProposalAllowance, extrasAvailable = 0): UploadDecision {
  if (allowance.paymentOnHold) {
    return {
      ok: false,
      status: 403,
      error:
        "Your last subscription payment did not go through, so new proposals are paused. Update your payment method under Manage billing on the billing page; your RFPs and drafts are all still here.",
    };
  }
  const withinPlan = !allowance.accessEnded && (allowance.remaining === null || allowance.remaining > 0);
  if (withinPlan) return { ok: true, useExtra: false };
  if (extrasAvailable > 0) return { ok: true, useExtra: true };
  if (allowance.accessEnded) {
    return {
      ok: false,
      status: 403,
      error: "Your pass has ended. Subscribe to keep drafting proposals; your existing RFPs and drafts are still here.",
    };
  }

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
  return {
    ok: false,
    status: 402,
    error: `You have used the ${allowance.limit} proposals your plan includes ${allowance.periodLabel}. Buy an extra proposal for $${price} to upload this one.`,
    overagePriceUsd: price,
  };
}

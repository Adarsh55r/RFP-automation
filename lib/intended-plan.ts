import { isSellablePlan } from "@/lib/plans";
import type { PlanId } from "@/types";

export const INTENDED_PLAN_COOKIE = "dw_intended_plan";
export const INTENDED_PLAN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** A plan a new customer may pick (hidden and retired plans are refused). */
export function isPlanId(value: string | undefined | null): value is PlanId {
  return isSellablePlan(value);
}

/**
 * Sign-up links from before the 2026-10 pricing used plan IDs that are no
 * longer sold: the old Team plan (`agency`, also written `team`) and Growth.
 * They now land on the closest current plan instead of a silent free trial.
 */
const RETIRED_PLAN_ALIASES: Record<string, PlanId> = { agency: "pro", team: "pro", growth: "starter" };

export function parsePlanId(value: string | undefined | null): PlanId | undefined {
  if (isPlanId(value)) return value;
  const alias = value ? RETIRED_PLAN_ALIASES[value.toLowerCase()] : undefined;
  return alias && isPlanId(alias) ? alias : undefined;
}

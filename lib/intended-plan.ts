import { plans } from "@/lib/plans";
import type { PlanId } from "@/types";

export const INTENDED_PLAN_COOKIE = "dw_intended_plan";
export const INTENDED_PLAN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function isPlanId(value: string | undefined | null): value is PlanId {
  return Boolean(value && plans.some((plan) => plan.id === value));
}

export function parsePlanId(value: string | undefined | null): PlanId | undefined {
  return isPlanId(value) ? value : undefined;
}

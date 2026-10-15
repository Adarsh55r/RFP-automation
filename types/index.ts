export type RfpId = string;

export type PlanId = "free" | "starter" | "growth" | "agency";

export type BillingCycle = "monthly" | "annual";

export type Currency = "usd" | "gbp";

export type Plan = {
  id: PlanId;
  name: string;
  /** Monthly list price per currency. */
  monthly: Record<Currency, number>;
  summary: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

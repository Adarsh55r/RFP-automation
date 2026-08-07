export type RfpId = string;

export type PlanId = "free" | "starter" | "growth" | "agency";

export type BillingCycle = "monthly" | "annual";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyInr: number;
  summary: string;
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
};

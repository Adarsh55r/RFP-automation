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
  /**
   * Not offered to new customers. Kept so accounts already on it (set by an
   * admin) keep their name, price and limits.
   */
  retired?: boolean;
};

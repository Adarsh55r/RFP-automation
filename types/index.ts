export type RfpId = string;

/** Same values as the SubscriptionTier enum in prisma/schema.prisma. */
export type PlanId = "free" | "starter" | "growth" | "agency" | "single_bid" | "pro" | "consultant" | "pilot";

export type BillingCycle = "monthly" | "annual";

export type Currency = "usd" | "gbp";

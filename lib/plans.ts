import type { BillingCycle, Currency, PlanId } from "@/types";

/**
 * The single source of truth for plans: the pricing page, signup, limit
 * enforcement, the billing page and the admin panel all read from here.
 *
 * Plan IDs are stable: they are stored on each subscription. Subscriptions
 * created before the October 2026 pricing carry planVersion "legacy" and keep
 * the terms in LEGACY_PLANS (grandfathered); everything else uses PLANS.
 */

export const CURRENT_PLAN_VERSION = "2026-10";

/** A price in each currency. `gbp: null` means "not set": GBP is hidden until every public price has one. */
export type Money = { usd: number; gbp: number | null };

export type PlanBilling =
  | { kind: "free" }
  | { kind: "subscription"; monthly: Money; annual: Money }
  | { kind: "one_time"; price: Money; accessDays: number };

export type PlanDef = {
  id: PlanId;
  name: string;
  summary: string;
  ctaLabel: string;
  highlighted?: boolean;
  /**
   * public: on the pricing page. hidden: exists but not sold yet (needs a
   * feature that has not shipped). private: sold only by direct link.
   * retired: no longer sold; kept for accounts already on it.
   */
  visibility: "public" | "hidden" | "private" | "retired";
  billing: PlanBilling;
  proposals: { limit: number | null; per: "month" | "lifetime" | "access_period" };
  /** Price of each proposal beyond the limit, charged only after the user confirms. Null: hard limit. */
  overage: Money | null;
  /** Most library items allowed; null means no item limit (the character limit still applies). */
  libraryItems: number | null;
  features: string[];
};

// GBP prices are placeholders until the founder confirms them (FOUNDER_TODO):
// {{GBP_PRICE_SINGLE_BID}}, {{GBP_PRICE_STARTER_MONTHLY}}, {{GBP_PRICE_STARTER_ANNUAL}},
// {{GBP_PRICE_PRO_MONTHLY}}, {{GBP_PRICE_PRO_ANNUAL}}, {{GBP_PRICE_OVERAGE}}, {{GBP_PRICE_SETUP}}.
const usd = (amount: number): Money => ({ usd: amount, gbp: null });

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free trial",
    summary: "Run one real RFP end to end before you pay anything.",
    ctaLabel: "Start free",
    visibility: "public",
    billing: { kind: "free" },
    proposals: { limit: 1, per: "lifetime" },
    overage: null,
    libraryItems: null,
    features: [
      "1 proposal, on an RFP of your choice",
      "Your full content library for that proposal",
      "Requirements checklist you confirm",
      "Draft with gaps flagged, plus a compliance review",
      "Word and PDF export",
      "No credit card",
    ],
  },
  single_bid: {
    id: "single_bid",
    name: "Single-bid pass",
    summary: "One proposal with 30 days of access, for a bid you need to answer now.",
    ctaLabel: "Get a single-bid pass",
    visibility: "public",
    billing: { kind: "one_time", price: usd(149), accessDays: 30 },
    proposals: { limit: 1, per: "access_period" },
    overage: null,
    libraryItems: null,
    features: [
      "1 proposal within 30 days",
      "Your full content library",
      "Requirements checklist and compliance review",
      "Word and PDF export",
      "$149 credited to your first invoice if you subscribe within 30 days",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    summary: "For teams answering a few RFPs a month.",
    ctaLabel: "Choose Starter",
    visibility: "public",
    billing: { kind: "subscription", monthly: usd(99), annual: usd(990) },
    proposals: { limit: 4, per: "month" },
    overage: usd(29),
    libraryItems: 50,
    features: [
      "4 proposals per month",
      "Extra proposals $29 each, only after you confirm",
      "Library of up to 50 items: case studies, bios, certifications, answers",
      "Requirements checklist and compliance review",
      "Word and PDF export",
      "1 user",
      "Email support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    summary: "For teams that bid every week.",
    ctaLabel: "Choose Pro",
    highlighted: true,
    visibility: "public",
    billing: { kind: "subscription", monthly: usd(249), annual: usd(2490) },
    proposals: { limit: 12, per: "month" },
    overage: usd(25),
    libraryItems: null,
    features: [
      "12 proposals per month",
      "Extra proposals $25 each, only after you confirm",
      "Larger library with no item limit",
      "Requirements checklist and compliance review",
      "Word and PDF export",
      "1 user",
      "Same-day email support (US and UK business hours)",
      "Done-with-you setup included on annual billing",
    ],
  },
  consultant: {
    id: "consultant",
    name: "Consultant",
    summary: "For proposal consultants answering RFPs for several clients.",
    ctaLabel: "Choose Consultant",
    // Needs separate client workspaces, which have not shipped. Hidden until they do.
    visibility: "hidden",
    billing: { kind: "subscription", monthly: usd(499), annual: usd(4990) },
    proposals: { limit: 30, per: "month" },
    overage: usd(25),
    libraryItems: null,
    features: [
      "30 proposals per month",
      "Extra proposals $25 each, only after you confirm",
      "Separate workspaces for each client",
      "Word and PDF export",
      "Same-day email support (US and UK business hours)",
    ],
  },
  pilot: {
    id: "pilot",
    name: "Paid pilot",
    summary: "60 days on Pro limits, with setup done with you.",
    ctaLabel: "Start the pilot",
    // Offered by private link or coupon only; never on the pricing page.
    visibility: "private",
    billing: { kind: "one_time", price: usd(299), accessDays: 60 },
    proposals: { limit: 12, per: "month" },
    overage: null,
    libraryItems: null,
    features: ["Pro limits for 60 days", "Done-with-you setup included"],
  },
  // Retired plans. New subscriptions cannot choose them; see LEGACY_PLANS for existing ones.
  growth: {
    id: "growth",
    name: "Growth",
    summary: "Legacy plan for existing accounts.",
    ctaLabel: "Get started",
    visibility: "retired",
    billing: { kind: "subscription", monthly: { usd: 149, gbp: 119 }, annual: { usd: 1490, gbp: 1190 } },
    proposals: { limit: 20, per: "month" },
    overage: null,
    libraryItems: null,
    features: ["20 proposals per month"],
  },
  agency: {
    id: "agency",
    name: "Team",
    summary: "Legacy plan for existing accounts.",
    ctaLabel: "Get started",
    // Unlimited proposals with uncapped AI cost: no longer sold. Existing accounts keep it.
    visibility: "retired",
    billing: { kind: "subscription", monthly: { usd: 349, gbp: 279 }, annual: { usd: 3490, gbp: 2790 } },
    proposals: { limit: null, per: "month" },
    overage: null,
    libraryItems: null,
    features: ["Unlimited proposals"],
  },
};

/**
 * Terms of subscriptions created before the October 2026 pricing. They keep
 * these limits and prices for as long as they stay on the plan.
 */
export const LEGACY_PLANS: Partial<Record<PlanId, PlanDef>> = {
  free: {
    ...PLANS.free,
    name: "Free (legacy)",
    summary: "One proposal each month, as when you signed up.",
    visibility: "retired",
    proposals: { limit: 1, per: "month" },
    libraryItems: null,
    features: ["1 proposal per month"],
  },
  starter: {
    ...PLANS.starter,
    name: "Starter (legacy)",
    summary: "Your original Starter plan and price.",
    visibility: "retired",
    billing: { kind: "subscription", monthly: { usd: 49, gbp: 39 }, annual: { usd: 490, gbp: 390 } },
    proposals: { limit: 5, per: "month" },
    overage: null,
    libraryItems: null,
    features: ["5 proposals per month"],
  },
  growth: PLANS.growth,
  agency: PLANS.agency,
};

/** One-time add-on, sold alongside a plan. */
export const SETUP_ADDON = {
  name: "Done-with-you setup",
  price: usd(500),
  description:
    "We load your past proposals, case studies, résumés and certifications into your library, then run your first bid with you.",
  waivedOn: "Pro on annual billing",
};

/** Plans a new customer can choose on the pricing page, in display order. */
export const publicPlans: PlanDef[] = (["free", "single_bid", "starter", "pro"] as const).map((id) => PLANS[id]);

/** Every plan definition that exists for an ID today. */
export const plans: PlanDef[] = Object.values(PLANS);

/** The terms that apply to a subscription: legacy terms if it predates the current pricing. */
export function resolvePlan(subscription: { tier: PlanId; planVersion?: string | null } | null | undefined): PlanDef {
  if (!subscription) return PLANS.free;
  if (subscription.planVersion === "legacy") return LEGACY_PLANS[subscription.tier] ?? PLANS[subscription.tier];
  return PLANS[subscription.tier] ?? PLANS.free;
}

/** A plan a new customer may sign up for or buy (public or private-link). */
export function isSellablePlan(id: string | null | undefined): id is PlanId {
  const plan = id ? PLANS[id as PlanId] : undefined;
  return Boolean(plan && (plan.visibility === "public" || plan.visibility === "private"));
}

export const currencies: { value: Currency; label: string }[] = [
  { value: "usd", label: "USD $" },
  { value: "gbp", label: "GBP £" },
];

function moneyList(plan: PlanDef): Money[] {
  const { billing } = plan;
  const prices = billing.kind === "subscription" ? [billing.monthly, billing.annual] : billing.kind === "one_time" ? [billing.price] : [];
  return plan.overage ? [...prices, plan.overage] : prices;
}

/** GBP is offered only once every public price has a confirmed GBP amount. */
export const gbpAvailable =
  publicPlans.every((plan) => moneyList(plan).every((price) => price.gbp !== null)) && SETUP_ADDON.price.gbp !== null;

const currencyLocale: Record<Currency, { locale: string; code: string }> = {
  usd: { locale: "en-US", code: "USD" },
  gbp: { locale: "en-GB", code: "GBP" },
};

export function formatPrice(amount: number, currency: Currency) {
  const { locale, code } = currencyLocale[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** The headline price of a plan, as shown on cards: per month for subscriptions (annual shown as a monthly equivalent). */
export function displayPrice(plan: PlanDef, currency: Currency, cycle: BillingCycle) {
  const { billing } = plan;
  if (billing.kind === "free") return { amount: 0, suffix: "" };
  if (billing.kind === "one_time") {
    return { amount: billing.price[currency] ?? billing.price.usd, suffix: ` one-time · ${billing.accessDays} days` };
  }
  if (cycle === "annual") {
    const yearly = billing.annual[currency] ?? billing.annual.usd;
    return { amount: Math.round(yearly / 12), suffix: "/mo, billed yearly", yearly };
  }
  return { amount: billing.monthly[currency] ?? billing.monthly.usd, suffix: "/mo" };
}

/** The monthly price in USD that a subscription brings in (for admin revenue estimates). */
export function monthlyRevenueUsd(plan: PlanDef, cycle: string | null | undefined) {
  const { billing } = plan;
  if (billing.kind !== "subscription") return 0;
  return cycle === "annual" ? billing.annual.usd / 12 : billing.monthly.usd;
}

export function signupHref(planId: PlanId) {
  return `/sign-up?plan=${planId}`;
}

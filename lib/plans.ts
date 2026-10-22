import type { BillingCycle, Currency, Plan, PlanId } from "@/types";

/**
 * Canonical tier breakdown for DraftBid AI.
 * Prices are set per currency (not FX-converted) so each market sees round numbers.
 * Annual billing = 10 × monthly (2 months free).
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthly: { usd: 0, gbp: 0 },
    summary: "Answer one real RFP end to end and see the results.",
    ctaLabel: "Start free",
    features: [
      "1 proposal per month",
      "1 seat",
      "Upload PDF or Word RFPs (scans need OCR first)",
      "Editable compliance checklist",
      "Library for 3 case studies, bios, or saved answers",
      "Word and PDF export",
      "Email support within 2 business days",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthly: { usd: 49, gbp: 39 },
    summary: "For founders and sales leads answering a few RFPs a month.",
    ctaLabel: "Get started",
    features: [
      "5 proposals per month",
      "2 team seats (coming soon)",
      "Upload PDF or Word RFPs (scans need OCR first)",
      "Editable compliance checklist",
      "Library for 25 case studies, bios, and saved answers",
      "Word and PDF export with cover page and contents",
      "90-day proposal history",
      "Email support next business day",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: { usd: 149, gbp: 119 },
    summary: "For small teams that bid every week.",
    ctaLabel: "Get started",
    highlighted: true,
    features: [
      "20 proposals per month",
      "5 team seats (coming soon)",
      "Upload PDF or Word RFPs (scans need OCR first)",
      "Editable compliance checklist",
      "Large library: up to 200,000 characters of saved content",
      "Your letterhead on exports (coming soon)",
      "12-month proposal history",
      "Shared comments on a draft (coming soon)",
      "Same-day email support (US & UK hours)",
    ],
  },
  {
    id: "agency",
    name: "Team",
    monthly: { usd: 349, gbp: 279 },
    summary: "For multiple bid owners sharing one library and brand.",
    ctaLabel: "Get started",
    features: [
      "Unlimited proposals",
      "15 team seats (coming soon)",
      "Upload PDF or Word RFPs (scans need OCR first)",
      "Editable compliance checklist",
      "Shared library with folders and per-team access (coming soon)",
      "Your letterhead on exports (coming soon)",
      "Full proposal history",
      "Shared comments plus an approver step (coming soon)",
      "Priority support (US & UK hours)",
      "Onboarding call for your bid lead",
    ],
  },
];

export const currencies: { value: Currency; label: string }[] = [
  { value: "usd", label: "USD $" },
  { value: "gbp", label: "GBP £" },
];

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

export function pricePerMonth(monthly: number, cycle: BillingCycle) {
  if (monthly === 0) return 0;
  if (cycle === "monthly") return monthly;
  return Math.round((monthly * 10) / 12);
}

export function annualTotal(monthly: number) {
  return monthly * 10;
}

export function signupHref(planId: PlanId) {
  return `/sign-up?plan=${planId}`;
}

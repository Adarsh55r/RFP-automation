import type { BillingCycle, Currency, Plan, PlanId } from "@/types";

/**
 * Canonical tier breakdown for DraftWin.
 * Prices are set per currency (not FX-converted) so each market sees round numbers.
 * Annual billing = 10 × monthly (2 months free).
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthly: { usd: 0, gbp: 0 },
    summary: "Run one live bid end-to-end and see if the workflow fits.",
    ctaLabel: "Start free",
    features: [
      "1 proposal per month",
      "1 seat",
      "Upload PDF or Word RFPs, including scans",
      "Editable compliance checklist",
      "Library for 3 case studies, bios, or saved answers",
      "DOCX export with a DraftWin footer",
      "Email support within 2 business days",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthly: { usd: 49, gbp: 39 },
    summary: "A founder or sales lead answering a few RFPs a month.",
    ctaLabel: "Choose plan",
    features: [
      "5 proposals per month",
      "2 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable compliance checklist",
      "Library for 25 case studies, bios, and saved answers",
      "Clean DOCX export — no DraftWin footer",
      "90-day proposal history",
      "Email support next business day",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: { usd: 149, gbp: 119 },
    summary: "The usual plan for a small team that bids every week.",
    ctaLabel: "Choose plan",
    highlighted: true,
    features: [
      "20 proposals per month",
      "5 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable compliance checklist",
      "Unlimited library and saved answers",
      "DOCX export with your letterhead, header, and footer",
      "12-month proposal history",
      "Shared comments on a draft before export",
      "Same-day email support (US & UK hours)",
    ],
  },
  {
    id: "agency",
    name: "Team",
    monthly: { usd: 349, gbp: 279 },
    summary: "Several bid owners sharing one library and brand kit.",
    ctaLabel: "Choose plan",
    features: [
      "Unlimited proposals",
      "15 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable compliance checklist",
      "Shared library with folders and per-team access",
      "DOCX export with your letterhead, header, and footer",
      "Full proposal history",
      "Shared comments plus a simple approver step",
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

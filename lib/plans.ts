import type { BillingCycle, Plan, PlanId } from "@/types";

/**
 * Canonical tier breakdown for DraftWin.
 * Annual billing = 10 × monthly (2 months free).
 */
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyInr: 0,
    summary: "Run one live RFP end-to-end and see if the workflow fits.",
    ctaLabel: "Start free",
    features: [
      "1 proposal per month",
      "1 seat",
      "Upload PDF or Word RFPs, including scans",
      "Editable requirement extraction",
      "Library for 3 case studies or bios",
      "DOCX export with a DraftWin footer",
      "Email support within 2 IST business days",
      "Private-sector RFPs only — not GeM or tenders",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyInr: 1999,
    summary: "A two-person pre-sales desk answering a few packs a month.",
    ctaLabel: "Choose plan",
    features: [
      "5 proposals per month",
      "2 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable requirement extraction",
      "Library for 10 case studies, bios, and stack pages",
      "Clean DOCX export — no DraftWin footer",
      "90-day proposal history",
      "Email support next IST business day",
      "Private-sector RFPs only — not GeM or tenders",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyInr: 5999,
    summary: "The usual plan for a delivery-led IT services agency.",
    ctaLabel: "Choose plan",
    highlighted: true,
    features: [
      "20 proposals per month",
      "3 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable requirement extraction",
      "Unlimited library items",
      "DOCX export with your letterhead, header, and footer",
      "12-month proposal history",
      "Shared comments on a draft before export",
      "Same-day email support on IST business days",
      "Private-sector RFPs only — not GeM or tenders",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    monthlyInr: 11999,
    summary: "Several pursuit teams sharing one library and brand kit.",
    ctaLabel: "Choose plan",
    features: [
      "Unlimited proposals",
      "10 seats",
      "Upload PDF or Word RFPs, including scans",
      "Editable requirement extraction",
      "Shared library with folders and per-team access",
      "DOCX export with your letterhead, header, and footer",
      "Full proposal history",
      "Shared comments plus a simple approver step",
      "Priority email support on IST hours",
      "Onboarding call for your pre-sales lead",
      "Private-sector RFPs only — not GeM or tenders",
    ],
  },
];

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function pricePerMonth(monthlyInr: number, cycle: BillingCycle) {
  if (monthlyInr === 0) return 0;
  if (cycle === "monthly") return monthlyInr;
  return Math.round((monthlyInr * 10) / 12);
}

export function annualTotal(monthlyInr: number) {
  return monthlyInr * 10;
}

export function signupHref(planId: PlanId) {
  return `/sign-up?plan=${planId}`;
}

"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import {
  annualTotal,
  formatInr,
  plans,
  pricePerMonth,
  signupHref,
} from "@/lib/plans";
import { useAnimatedNumber } from "@/lib/use-animated-number";
import type { BillingCycle, Plan } from "@/types";

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Monthly plans stop at the end of the current billing month. Annual plans are prepaid for the year; you can cancel renewal and keep access until that year runs out. We do not lock you into a multi-year contract.",
  },
  {
    question: "What happens if I go over my RFP limit?",
    answer:
      "New drafts pause once you hit the monthly proposal cap. Finished proposals stay downloadable. Upgrade in place — Growth and Agency lift the cap immediately — or wait until the next billing month. We will not silently delete work.",
  },
  {
    question: "Do you support GST invoices?",
    answer:
      "Yes. Paid plans get a GST tax invoice with DraftWin’s GSTIN, your billing GSTIN if you add it, and HSN/SAC on the line items. Invoices go to the billing email on the account, usually within one IST business day of payment.",
  },
  {
    question: "Is my data secure?",
    answer:
      "RFP files, library items, and drafts are private to your workspace. Seats only see what you invite them to. We do not train public models on your documents. You can export and delete a workspace; deletion removes source files and generated drafts from our systems.",
  },
  {
    question: "Can I switch plans mid-cycle?",
    answer:
      "Upgrades take effect immediately and we charge the difference for the rest of the cycle. Downgrades apply at the next renewal so you keep the higher limits you already paid for. Seats above the new plan’s cap must be removed before the downgrade date.",
  },
  {
    question: "Do you work with GeM or government tenders?",
    answer:
      "No. DraftWin is built for private-sector packs — vendor empanelment, security questionnaires, and agency pitches from enterprise clients. Government tender portals, bid bonds, and GeM workflows are out of scope on purpose.",
  },
];

function AnimatedPrice({ amount }: { amount: number }) {
  const value = useAnimatedNumber(amount);

  return (
    <span className="font-display text-4xl font-medium text-ink tabular-nums">
      {formatInr(value)}
    </span>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: BillingCycle }) {
  const monthly = pricePerMonth(plan.monthlyInr, cycle);
  const yearly = annualTotal(plan.monthlyInr);
  const paid = plan.monthlyInr > 0;

  return (
    <Card
      className={cn(
            "flex h-full flex-col transition-shadow duration-hover ease-out hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]",
        plan.highlighted && "border-accent shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-sans text-lg font-semibold text-ink">{plan.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">{plan.summary}</p>
        </div>
        {plan.highlighted ? <Badge variant="accent">Most popular</Badge> : null}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-end gap-2">
          <AnimatedPrice amount={monthly} />
          <span className="pb-1 font-sans text-sm font-medium text-slate">
            {paid ? "/mo" : "forever"}
          </span>
        </div>
        <p className="mt-2 min-h-10 font-mono text-xs tracking-wide text-slate">
          {paid && cycle === "annual"
            ? `${formatInr(yearly)} billed yearly · 2 months free`
            : paid
              ? "Billed monthly"
              : "No card required"}
        </p>
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-ink">
            <Check
              aria-hidden
              className="size-4 shrink-0 text-brand"
              strokeWidth={1.75}
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        asChild
        className="mt-8 w-full"
        variant={plan.highlighted ? "primary" : "secondary"}
      >
        <Link href={signupHref(plan.id)}>{plan.ctaLabel}</Link>
      </Button>
    </Card>
  );
}

export function PricingView() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <>
      <Section>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Pricing
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium text-ink md:text-5xl">
          Four rupee plans. Pick the one that matches how many RFPs you actually answer.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate md:text-lg">
          Annual billing is ten months for the price of twelve. GST invoices on
          every paid plan. No USD seat math.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            role="group"
            aria-label="Billing cycle"
            className="inline-flex rounded-control border border-border bg-surface-raised p-2"
          >
            {(
              [
                ["monthly", "Monthly"],
                ["annual", "Annual"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={cycle === value}
                onClick={() => setCycle(value)}
                className={cn(
                  "rounded-control px-4 py-2 text-sm font-semibold transition-colors duration-hover ease-out",
                  cycle === value
                    ? "bg-brand text-surface-raised"
                    : "text-slate hover:text-ink",
                  focusRing,
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {cycle === "annual" ? (
            <p className="font-mono text-xs tracking-wide text-brand">
              2 months free on paid plans
            </p>
          ) : (
            <p className="font-mono text-xs tracking-wide text-slate">
              Switch to annual to see the discounted monthly rate
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} cycle={cycle} />
          ))}
        </div>
      </Section>

      <Section className="pt-0 md:pt-0">
        <h2 className="font-display text-3xl font-medium text-ink md:text-4xl">
          Questions teams ask before they pick a plan
        </h2>
        <div className="mt-8 rounded-card border border-border bg-surface-raised px-6">
          <Accordion type="single" collapsible>
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Section>
    </>
  );
}

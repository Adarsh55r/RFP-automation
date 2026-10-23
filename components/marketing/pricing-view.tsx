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
  currencies,
  formatPrice,
  plans,
  pricePerMonth,
  signupHref,
} from "@/lib/plans";
import { faqs } from "@/lib/faqs";
import { useAnimatedNumber } from "@/lib/use-animated-number";
import type { BillingCycle, Currency, Plan } from "@/types";

function AnimatedPrice({
  amount,
  currency,
}: {
  amount: number;
  currency: Currency;
}) {
  const value = useAnimatedNumber(amount);

  return (
    <span className="font-display text-4xl font-medium text-ink tabular-nums">
      {formatPrice(value, currency)}
    </span>
  );
}

function PlanCard({
  plan,
  cycle,
  currency,
}: {
  plan: Plan;
  cycle: BillingCycle;
  currency: Currency;
}) {
  const monthly = pricePerMonth(plan.monthly[currency], cycle);
  const yearly = annualTotal(plan.monthly[currency]);
  const paid = plan.monthly[currency] > 0;

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
        {plan.highlighted ? <Badge variant="accent">Recommended</Badge> : null}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-end gap-2">
          <AnimatedPrice amount={monthly} currency={currency} />
          <span className="pb-1 font-sans text-sm font-medium text-slate">
            {paid ? "/mo" : "forever"}
          </span>
        </div>
        <p className="mt-2 min-h-10 font-mono text-xs tracking-wide text-slate">
          {paid && cycle === "annual"
            ? `${formatPrice(yearly, currency)} billed yearly · 2 months free`
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
  const [currency, setCurrency] = useState<Currency>("usd");

  return (
    <>
      <Section>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Pricing
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium text-ink md:text-5xl">
          Simple pricing for small teams that bid.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate md:text-lg">
          Start free with one full proposal. Upgrade when RFPs become a weekly
          habit. Month-to-month, cancel anytime — or pay annually and get two
          months free. Priced in US dollars and British pounds.
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
          <div
            role="group"
            aria-label="Currency"
            className="inline-flex rounded-control border border-border bg-surface-raised p-2"
          >
            {currencies.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={currency === value}
                onClick={() => setCurrency(value)}
                className={cn(
                  "rounded-control px-4 py-2 text-sm font-semibold transition-colors duration-hover ease-out",
                  currency === value
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
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              currency={currency}
            />
          ))}
        </div>
      </Section>

      <Section className="pt-0 md:pt-0">
        <h2 className="font-display text-3xl font-medium text-ink md:text-4xl">
          Questions small teams ask before they start
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

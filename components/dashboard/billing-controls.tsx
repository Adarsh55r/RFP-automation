"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAlert } from "@/components/ui/sweet-alert";
import { buyExtraProposal, choosePlan, openBillingPortal } from "@/lib/actions/billing";
import type { BillingCycle } from "@/types";

type Result = { ok: true; url: string } | { ok: true; message: string } | { ok: false; error: string };

/** Runs a billing action: follows a checkout or portal link, or shows its message. */
function useBillingAction() {
  const router = useRouter();
  const alert = useAlert();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        alert.error("That didn't go through", result.error);
      } else if ("url" in result) {
        window.location.assign(result.url);
      } else {
        alert.success("Plan change requested", result.message);
        router.refresh();
      }
    });
  return { pending, run };
}

export type PlanOption = {
  id: string;
  name: string;
  features: string[];
  kind: "free" | "subscription" | "one_time";
  monthly: string;
  annualPerMonth: string | null;
  annualTotal: string | null;
  suffix: string;
  /** "current" for the plan and cycle the account is on; "intended" for the one picked on the pricing page. */
  state: "current" | "intended" | null;
};

/** Plan cards with a monthly/annual switch; each button starts checkout or a plan change. */
export function PlanPicker({ options, initialCycle }: { options: PlanOption[]; initialCycle: BillingCycle }) {
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const { pending, run } = useBillingAction();
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold text-ink">Plans</h2>
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-surface-raised/80 p-1 shadow-sm backdrop-blur">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={cycle === option}
              onClick={() => setCycle(option)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${cycle === option ? "bg-brand-gradient text-on-brand shadow-[0_6px_16px_-6px_rgb(var(--glow)/0.7)]" : "text-slate hover:text-ink"}`}
            >
              {option === "monthly" ? "Monthly" : "Annual · 2 months free"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const annual = option.kind === "subscription" && cycle === "annual";
          const price = annual ? option.annualPerMonth! : option.monthly;
          const suffix = option.kind === "subscription" ? (annual ? "/mo, billed yearly" : "/mo") : option.suffix;
          const current = option.state === "current" && (option.kind !== "subscription" || annual === (initialCycle === "annual"));
          return (
            <Card
              key={option.id}
              data-highlight={option.state === "intended" || option.state === "current" ? "true" : undefined}
              className={`hover-lift glow-ring flex flex-col gap-4 ${option.state === "intended" ? "border-brand/60" : ""}`}
            >
              <div>
                <h3 className="font-sans text-base font-semibold text-ink">{option.name}</h3>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
                  {price}
                  <span className="ml-1 font-sans text-xs font-medium text-slate">{suffix}</span>
                </p>
                {annual && option.annualTotal ? <p className="mt-1 text-xs text-slate">{option.annualTotal} a year</p> : null}
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm leading-relaxed text-slate">
                {option.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
                    {feature}
                  </li>
                ))}
              </ul>
              {current ? (
                <Badge variant="success" className="w-fit">Current plan</Badge>
              ) : option.kind === "free" ? null : (
                <Button
                  type="button"
                  variant={option.state === "intended" ? "primary" : "secondary"}
                  className="w-full"
                  disabled={pending}
                  onClick={() => {
                    setChosen(option.id);
                    run(() => choosePlan(option.id, cycle));
                  }}
                >
                  {pending && chosen === option.id ? "Opening checkout…" : `Choose ${option.name}`}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** Opens Dodo's customer portal: invoices, payment method, cancellation. */
export function ManageBillingButton({ variant = "secondary", children }: { variant?: ButtonVariant; children?: ReactNode }) {
  const { pending, run } = useBillingAction();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} className="w-fit" disabled={pending} onClick={() => run(openBillingPortal)}>
        {pending ? "Opening…" : (children ?? "Manage billing")}
      </Button>
    </div>
  );
}

/** Pays for one extra proposal at checkout; the next upload past the limit uses it. */
export function BuyExtraProposalButton({ priceUsd }: { priceUsd: number }) {
  const { pending, run } = useBillingAction();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className="w-fit" disabled={pending} onClick={() => run(buyExtraProposal)}>
        {pending ? "Opening checkout…" : `Buy an extra proposal for $${priceUsd}`}
      </Button>
    </div>
  );
}

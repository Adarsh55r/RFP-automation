"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buyExtraProposal, choosePlan, openBillingPortal } from "@/lib/actions/billing";
import type { BillingCycle } from "@/types";

type Result = { ok: true; url: string } | { ok: true; message: string } | { ok: false; error: string };

/** Runs a billing action: follows a checkout or portal link, or shows its message. */
function useBillingAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const run = (action: () => Promise<Result>) =>
    startTransition(async () => {
      setNotice(null);
      const result = await action();
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
      } else if ("url" in result) {
        window.location.assign(result.url);
      } else {
        setNotice({ tone: "info", text: result.message });
        router.refresh();
      }
    });
  return { pending, notice, run };
}

function Notice({ notice }: { notice: { tone: "info" | "error"; text: string } | null }) {
  if (!notice) return null;
  return (
    <p role={notice.tone === "error" ? "alert" : "status"} className={notice.tone === "error" ? "text-sm text-danger" : "text-sm text-ink"}>
      {notice.text}
    </p>
  );
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
  const { pending, notice, run } = useBillingAction();
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-sans text-lg font-semibold text-ink">Plans</h2>
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-surface-raised p-1">
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={cycle === option}
              onClick={() => setCycle(option)}
              className={`rounded-full px-4 py-1 text-sm ${cycle === option ? "bg-brand text-surface-raised" : "text-slate hover:text-ink"}`}
            >
              {option === "monthly" ? "Monthly" : "Annual · 2 months free"}
            </button>
          ))}
        </div>
      </div>
      <Notice notice={notice} />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const annual = option.kind === "subscription" && cycle === "annual";
          const price = annual ? option.annualPerMonth! : option.monthly;
          const suffix = option.kind === "subscription" ? (annual ? "/mo, billed yearly" : "/mo") : option.suffix;
          const current = option.state === "current" && (option.kind !== "subscription" || annual === (initialCycle === "annual"));
          return (
            <Card key={option.id} className={`flex flex-col gap-4 ${option.state === "intended" ? "border-brand" : ""}`}>
              <div>
                <h3 className="font-sans text-base font-semibold text-ink">{option.name}</h3>
                <p className="mt-2 font-display text-2xl font-medium text-ink">
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
  const { pending, notice, run } = useBillingAction();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variant} className="w-fit" disabled={pending} onClick={() => run(openBillingPortal)}>
        {pending ? "Opening…" : (children ?? "Manage billing")}
      </Button>
      <Notice notice={notice} />
    </div>
  );
}

/** Pays for one extra proposal at checkout; the next upload past the limit uses it. */
export function BuyExtraProposalButton({ priceUsd }: { priceUsd: number }) {
  const { pending, notice, run } = useBillingAction();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className="w-fit" disabled={pending} onClick={() => run(buyExtraProposal)}>
        {pending ? "Opening checkout…" : `Buy an extra proposal for $${priceUsd}`}
      </Button>
      <Notice notice={notice} />
    </div>
  );
}

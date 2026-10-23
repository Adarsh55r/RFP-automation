import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { COMPANY } from "@/lib/company";
import { requireDashboardUser } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { getProposalAllowance } from "@/lib/entitlements";
import { displayPrice, formatPrice, publicPlans, SETUP_ADDON } from "@/lib/plans";
import { recordFirst } from "@/lib/funnel";
import { PlanRequestLink } from "@/components/dashboard/plan-request-link";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

const statusLabel: Record<string, string> = {
  active: "Active",
  canceled: "Canceled",
  past_due: "Past due",
  incomplete: "Incomplete",
  trialing: "Trial",
};

function requestHref(planName: string) {
  return `mailto:${COMPANY.contactEmail}?subject=${encodeURIComponent(`Switch to ${planName}`)}`;
}

export default async function BillingPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  await recordFirst("upgrade_viewed", user.id);
  const [allowance, owed] = await Promise.all([
    getProposalAllowance(user.id, user.subscription),
    prisma.proposalUsage.aggregate({
      where: { userId: user.id, overageCents: { not: null }, overageBilledAt: null },
      _sum: { overageCents: true },
      _count: { _all: true },
    }),
  ]);
  const { plan } = allowance;
  const legacy = user.subscription?.planVersion === "legacy" && plan.billing.kind !== "free";
  const price = displayPrice(plan, "usd", user.subscription?.billingCycle === "annual" ? "annual" : "monthly");
  const owedUsd = (owed._sum.overageCents ?? 0) / 100;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">Billing</p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">Plan and invoices</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Online checkout is not live yet, so nothing is charged automatically. To move to a paid
          plan now, request it below and we will set it up with you.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-slate uppercase">Current plan</p>
              <h2 className="mt-2 font-sans text-xl font-semibold text-ink">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">{plan.summary}</p>
            </div>
            <Badge variant={plan.billing.kind === "free" ? "free" : "success"}>
              {statusLabel[user.subscription?.status ?? "active"]}
            </Badge>
          </div>
          {plan.billing.kind !== "free" ? (
            <p className="font-display text-4xl font-medium text-ink">
              {formatPrice(price.amount, "usd")}
              <span className="ml-1 font-sans text-sm font-medium text-slate">{price.suffix}</span>
            </p>
          ) : null}
          {legacy ? (
            <p className="text-sm leading-relaxed text-slate">
              You are on our earlier pricing. You keep this plan, its limits and its price for as long
              as you stay on it.
            </p>
          ) : null}
          <p className="font-mono text-xs tracking-wide text-slate">
            {allowance.remaining === null
              ? `${allowance.used} proposals ${allowance.periodLabel} · no limit`
              : `${allowance.used} of ${allowance.limit} proposals used ${allowance.periodLabel}`}
            {allowance.accessEndsAt ? ` · access ${allowance.accessEnded ? "ended" : "ends"} ${allowance.accessEndsAt.toISOString().slice(0, 10)}` : ""}
          </p>
          {owed._count._all > 0 ? (
            <p className="text-sm leading-relaxed text-ink">
              Extra proposals you confirmed: {owed._count._all}, totalling {formatPrice(owedUsd, "usd")}, to be
              invoiced.
            </p>
          ) : null}
        </Card>
        <EmptyState
          icon={Receipt}
          headline="No invoices yet"
          description="Invoices and receipts, with VAT or sales tax where it applies, will appear here once checkout is live."
        />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-sans text-lg font-semibold text-ink">Plans</h2>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {publicPlans.map((option) => {
            const optionPrice = displayPrice(option, "usd", "monthly");
            const current = option.id === plan.id && !legacy;
            return (
              <Card key={option.id} className="flex flex-col gap-4">
                <div>
                  <h3 className="font-sans text-base font-semibold text-ink">{option.name}</h3>
                  <p className="mt-2 font-display text-2xl font-medium text-ink">
                    {formatPrice(optionPrice.amount, "usd")}
                    <span className="ml-1 font-sans text-xs font-medium text-slate">{optionPrice.suffix}</span>
                  </p>
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
                ) : option.billing.kind === "free" ? null : (
                  <Button asChild variant="secondary" className="w-full">
                    <PlanRequestLink href={requestHref(option.name)}>Request {option.name}</PlanRequestLink>
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
        <Card className="flex flex-col gap-2">
          <h3 className="font-sans text-base font-semibold text-ink">
            {SETUP_ADDON.name} · {formatPrice(SETUP_ADDON.price.usd, "usd")} one-time
          </h3>
          <p className="text-sm leading-relaxed text-slate">
            {SETUP_ADDON.description} Included free with {SETUP_ADDON.waivedOn}.
          </p>
          <Button asChild variant="secondary" className="w-fit">
            <a href={requestHref(SETUP_ADDON.name)}>Request setup</a>
          </Button>
        </Card>
      </section>
    </div>
  );
}

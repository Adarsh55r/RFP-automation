import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ManageBillingButton, PlanPicker, type PlanOption } from "@/components/dashboard/billing-controls";
import { COMPANY } from "@/lib/company";
import { requireDashboardUser } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { dodoConfigured } from "@/lib/dodo";
import { getProposalAllowance } from "@/lib/entitlements";
import { displayPrice, formatPrice, publicPlans } from "@/lib/plans";
import { recordFirst } from "@/lib/funnel";
import { parsePlanId } from "@/lib/intended-plan";
import { PlanRequestLink } from "@/components/dashboard/plan-request-link";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

const statusLabel: Record<string, string> = {
  active: "Active",
  canceled: "Canceled",
  past_due: "Payment due",
  incomplete: "Incomplete",
  trialing: "Trial",
};

function requestHref(planName: string) {
  return `mailto:${COMPANY.contactEmail}?subject=${encodeURIComponent(`Switch to ${planName}`)}`;
}

const day = (date: Date) => date.toISOString().slice(0, 10);

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; checkout?: string }>;
}) {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }
  const params = await searchParams;

  await recordFirst("upgrade_viewed", user.id);
  const [allowance, owed, extras] = await Promise.all([
    getProposalAllowance(user.id, user.subscription),
    prisma.proposalUsage.aggregate({
      where: { userId: user.id, overageCents: { not: null }, overageBilledAt: null },
      _sum: { overageCents: true },
      _count: { _all: true },
    }),
    prisma.extraProposal.count({ where: { userId: user.id, usedAt: null } }),
  ]);
  const { plan } = allowance;
  const subscription = user.subscription;
  const legacy = subscription?.planVersion === "legacy" && plan.billing.kind !== "free";
  const cycle = subscription?.billingCycle === "annual" ? "annual" : "monthly";
  const price = displayPrice(plan, "usd", cycle);
  const owedUsd = (owed._sum.overageCents ?? 0) / 100;
  const live = dodoConfigured();
  const intended = parsePlanId(params.plan);

  const options: PlanOption[] = publicPlans.map((option) => {
    const monthly = displayPrice(option, "usd", "monthly");
    const annual = option.billing.kind === "subscription" ? displayPrice(option, "usd", "annual") : null;
    return {
      id: option.id,
      name: option.name,
      features: option.features,
      kind: option.billing.kind,
      monthly: formatPrice(monthly.amount, "usd"),
      annualPerMonth: annual ? formatPrice(annual.amount, "usd") : null,
      annualTotal: annual && "yearly" in annual && annual.yearly ? formatPrice(annual.yearly, "usd") : null,
      suffix: monthly.suffix,
      state: option.id === plan.id && !legacy ? "current" : option.id === intended ? "intended" : null,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">Billing</p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">Plan and invoices</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          {live
            ? "Payments are handled by Dodo Payments, our reseller and merchant of record, which adds VAT or sales tax where it applies and issues your invoices. We never see your full card number."
            : "Online checkout is not live yet, so nothing is charged automatically. To move to a paid plan now, request it below and we will set it up with you."}
        </p>
      </header>

      {params.checkout === "done" ? (
        <Card className="border-brand">
          <p className="text-sm leading-relaxed text-ink">
            Thank you. Your payment is being confirmed; your plan updates here within a minute or two. Refresh the page if
            it has not changed yet.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-slate uppercase">Current plan</p>
              <h2 className="mt-2 font-sans text-xl font-semibold text-ink">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">{plan.summary}</p>
            </div>
            <Badge variant={plan.billing.kind === "free" ? "free" : subscription?.status === "past_due" ? "danger" : "success"}>
              {statusLabel[subscription?.status ?? "active"]}
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
          {allowance.paymentOnHold ? (
            <p role="alert" className="text-sm leading-relaxed text-danger">
              Your last payment did not go through, so new proposals are paused. Update your payment method under
              Manage billing to continue.
            </p>
          ) : null}
          {plan.billing.kind === "subscription" && subscription?.currentPeriodEnd && !legacy ? (
            <p className="text-sm leading-relaxed text-slate">
              {subscription.cancelAtPeriodEnd
                ? `Cancelled: your plan stays active until ${day(subscription.currentPeriodEnd)}, then moves to the free plan.`
                : `Renews on ${day(subscription.currentPeriodEnd)}.`}
            </p>
          ) : null}
          <p className="font-mono text-xs tracking-wide text-slate">
            {allowance.remaining === null
              ? `${allowance.used} proposals ${allowance.periodLabel} · no limit`
              : `${allowance.used} of ${allowance.limit} proposals used ${allowance.periodLabel}`}
            {allowance.accessEndsAt ? ` · access ${allowance.accessEnded ? "ended" : "ends"} ${day(allowance.accessEndsAt)}` : ""}
            {extras > 0 ? ` · ${extras} paid extra proposal${extras === 1 ? "" : "s"} ready to use` : ""}
          </p>
          {owed._count._all > 0 ? (
            <p className="text-sm leading-relaxed text-ink">
              Extra proposals you confirmed before online checkout opened: {owed._count._all}, totalling{" "}
              {formatPrice(owedUsd, "usd")}, to be invoiced.
            </p>
          ) : null}
          {live && subscription?.dodoCustomerId ? <ManageBillingButton /> : null}
        </Card>
        {live && subscription?.dodoCustomerId ? (
          <EmptyState
            icon={Receipt}
            headline="Invoices and receipts"
            description="Your invoices, receipts and payment method are in the billing portal, run by Dodo Payments. Cancel there at any time: your plan stays active until the end of the period you paid for."
          />
        ) : (
          <EmptyState
            icon={Receipt}
            headline="No invoices yet"
            description={
              live
                ? "Invoices and receipts, with VAT or sales tax where it applies, appear in the billing portal after your first payment."
                : "Invoices and receipts, with VAT or sales tax where it applies, will appear here once checkout is live."
            }
          />
        )}
      </div>

      {live ? (
        <section className="flex flex-col gap-4">
          <PlanPicker options={options} initialCycle={cycle} />
          {plan.id === "single_bid" && allowance.accessEndsAt && !allowance.accessEnded ? (
            <p className="text-sm text-slate">
              Subscribing before {day(allowance.accessEndsAt)}? The $29 you paid for your pass is taken off your first
              invoice at checkout.
            </p>
          ) : null}
        </section>
      ) : (
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
        </section>
      )}
    </div>
  );
}

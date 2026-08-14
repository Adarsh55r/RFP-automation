import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDashboardUser } from "@/lib/dashboard";
import { monthlyRfpLimit } from "@/lib/plan-limits";
import { formatInr, plans } from "@/lib/plans";
import { getRfpUploadQuota } from "@/lib/rfps";
import type { SubscriptionTier } from "@/lib/generated/prisma";

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

export default async function BillingPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const tier: SubscriptionTier = user.subscription?.tier ?? "free";
  const plan = plans.find((item) => item.id === tier) ?? plans[0];
  const quota = await getRfpUploadQuota(user.id, tier);
  const limit = monthlyRfpLimit[tier];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Billing
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
          Plan and invoices
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Paid checkout is not live yet. You can review your current plan and
          compare rupee tiers on the public pricing page.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-slate uppercase">
                Current plan
              </p>
              <h2 className="mt-2 font-sans text-xl font-semibold text-ink">
                {plan.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {plan.summary}
              </p>
            </div>
            <Badge variant={tier === "free" ? "free" : "success"}>
              {statusLabel[user.subscription?.status ?? "active"]}
            </Badge>
          </div>

          <p className="font-display text-4xl font-medium text-ink">
            {formatInr(plan.monthlyInr)}
            <span className="ml-1 font-sans text-sm font-medium text-slate">
              {plan.monthlyInr === 0 ? "forever" : "/mo"}
            </span>
          </p>

          <p className="font-mono text-xs tracking-wide text-slate">
            {limit === null
              ? `${quota.usedThisMonth} RFPs uploaded this month · unlimited on Agency`
              : `${quota.usedThisMonth} of ${quota.limit} RFPs used this month`}
          </p>

          <Button asChild className="w-full sm:w-fit">
            <Link href="/pricing">Compare plans</Link>
          </Button>
        </Card>

        <EmptyState
          icon={Receipt}
          headline="No invoices yet"
          description="GST invoices will appear here after a paid plan is charged. Until checkout is connected, nothing is billed."
        />
      </div>
    </div>
  );
}

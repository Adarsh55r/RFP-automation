import { BadgeDollarSign, Bot, FileText, Percent, Sparkles, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { FlagBadge, PlanBadge } from "@/components/admin/badges";
import { Funnel, PlanDonut, TrendChart } from "@/components/admin/charts";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/admin/admin-shell";
import { SpotlightCard, Stagger } from "@/components/admin/spotlight-card";
import { AllClear, CardHeader, Pill } from "@/components/admin/ui";
import { getAdminOverview, getCustomers } from "@/lib/admin-data";
import { relativeTime } from "@/lib/admin-format";

export default async function AdminOverviewPage() {
  const [overview, customers] = await Promise.all([getAdminOverview(), getCustomers()]);
  const { kpis, series } = overview;

  const signupDelta =
    kpis.newUsersPrev7 > 0 ? ((kpis.newUsers7 - kpis.newUsersPrev7) / kpis.newUsersPrev7) * 100 : null;
  const attention = customers
    .filter((row) => row.flags.some((flag) => flag === "at-cap" || flag === "near-cap" || flag === "upsell"))
    .sort((a, b) => b.capPct - a.capPct)
    .slice(0, 5);
  const recent = customers.slice(0, 5);
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  return (
    <>
      <PageHeader
        eyebrow={today}
        title="Business overview"
        description="Sales, usage and AI spend across every DraftWin account, updated live from the database."
        actions={<Pill>Revenue estimated from list prices · Stripe not connected</Pill>}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Est. MRR"
          value={kpis.mrrUsd}
          format="usd0"
          icon={BadgeDollarSign}
          hint={`ARR ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(kpis.mrrUsd * 12)}`}
          accent="#34d399"
        />
        <KpiCard
          label="Paying customers"
          value={kpis.payingCustomers}
          icon={Users}
          hint={`${kpis.totalUsers ? ((kpis.payingCustomers / kpis.totalUsers) * 100).toFixed(1) : "0"}% of accounts`}
          accent="#3987e5"
        />
        <KpiCard
          label="Accounts"
          value={kpis.totalUsers}
          icon={UserPlus}
          delta={signupDelta}
          hint={`${kpis.newUsers7} new in 7 days`}
          spark={series.signups.map((point) => point.value)}
          accent="#2dd4bf"
        />
        <KpiCard
          label="Proposals this month"
          value={kpis.rfpsThisMonth}
          icon={FileText}
          hint={`${kpis.totalRfps.toLocaleString("en-US")} all time`}
          spark={series.proposals.map((point) => point.value)}
          accent="#d95926"
        />
        <KpiCard
          label="AI spend this month"
          value={kpis.aiCostMonthUsd}
          format="usd"
          icon={Bot}
          hint={`${kpis.aiCallsMonth.toLocaleString("en-US")} model calls`}
          spark={series.aiCost.map((point) => point.value)}
          accent="#f5b547"
        />
        <KpiCard
          label="Gross margin after AI"
          value={kpis.grossMarginPct}
          format="pct"
          icon={Percent}
          hint={kpis.grossMarginPct == null ? "No paying customers yet" : "Est. revenue minus AI spend"}
          accent="#a78bfa"
        />
      </Stagger>

      <Stagger className="mt-4 grid gap-4 lg:grid-cols-3">
        <SpotlightCard className="p-5 lg:col-span-2" interactive={false}>
          <TrendChart
            metrics={[
              { key: "signups", label: "Sign-ups", color: "#2dd4bf", data: series.signups },
              { key: "proposals", label: "Proposals", color: "#3987e5", data: series.proposals },
              { key: "cost", label: "AI spend", color: "#c98500", money: true, data: series.aiCost },
            ]}
          />
        </SpotlightCard>
        <SpotlightCard className="p-5">
          <CardHeader title="Plan mix" description="Accounts on each plan right now" />
          <PlanDonut data={overview.planMix} />
        </SpotlightCard>
      </Stagger>

      <Stagger className="mt-4 grid gap-4 lg:grid-cols-3">
        <SpotlightCard className="p-5">
          <CardHeader title="Activation funnel" description="How far accounts get, all time" icon={Sparkles} />
          <Funnel stages={overview.funnel} />
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader
            title="Needs attention"
            description="Near their AI cap or ready to upgrade"
            href="/admin/alerts"
            tone="var(--a-amber)"
          />
          {attention.length === 0 ? (
            <AllClear message="Nobody is near a limit." />
          ) : (
            <ul className="-mx-2 space-y-1">
              {attention.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/customers/${row.id}`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-(--a-text)">{row.company !== "—" ? row.company : row.email}</div>
                      <div className="text-xs tabular-nums text-(--a-muted)">{row.capPct.toFixed(0)}% of AI cap</div>
                    </div>
                    <div className="flex gap-1">
                      {row.flags
                        .filter((flag) => flag !== "inactive")
                        .map((flag) => (
                          <FlagBadge key={flag} flag={flag} />
                        ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title="Newest accounts" description="Latest sign-ups" href="/admin/customers" />
          {recent.length === 0 ? (
            <AllClear message="No accounts yet." />
          ) : (
            <ul className="-mx-2 space-y-1">
              {recent.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/customers/${row.id}`}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-(--a-text)">{row.company !== "—" ? row.company : row.email}</div>
                      <div className="text-xs text-(--a-muted)">Joined {relativeTime(row.createdAt)}</div>
                    </div>
                    <PlanBadge tier={row.tier} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SpotlightCard>
      </Stagger>
    </>
  );
}

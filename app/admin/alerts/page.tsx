import { AlertOctagon, AlertTriangle, Lock, Moon, RotateCcw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PlanBadge } from "@/components/admin/badges";
import { ResetAllowanceButton, UnlockAiButton } from "@/components/admin/customer-actions";
import { PageHeader } from "@/components/admin/admin-shell";
import { SpotlightCard, Stagger } from "@/components/admin/spotlight-card";
import { AllClear, CardHeader } from "@/components/admin/ui";
import { getAlerts, type CustomerRow } from "@/lib/admin-data";
import { relativeTime, usd } from "@/lib/admin-format";

function CustomerList({ rows, detail }: { rows: CustomerRow[]; detail: (row: CustomerRow) => string }) {
  return (
    <ul className="-mx-2 space-y-1">
      {rows.slice(0, 12).map((row) => (
        <li key={row.id}>
          <Link
            href={`/admin/customers/${row.id}`}
            className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-(--a-text)">{row.company !== "—" ? row.company : row.email}</div>
              <div className="truncate text-xs tabular-nums text-(--a-muted)">{detail(row)}</div>
            </div>
            <PlanBadge tier={row.tier} />
          </Link>
        </li>
      ))}
      {rows.length > 12 ? <li className="px-2 pt-1 text-xs text-(--a-muted)">and {rows.length - 12} more</li> : null}
    </ul>
  );
}

export default async function AdminAlertsPage() {
  const alerts = await getAlerts();
  const capDetail = (row: CustomerRow) => `${usd(row.aiCostMonthUsd)} of ${usd(row.capUsd, 0)} · ${row.capPct.toFixed(0)}%`;

  return (
    <>
      <PageHeader
        eyebrow="Watchlist"
        title="Alerts"
        description="Accounts that hit a limit, look ready to upgrade, or have gone quiet. Fix stuck locks and reset allowances right here."
      />

      <Stagger className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SpotlightCard className="p-5">
          <CardHeader title={`At AI cap · ${alerts.atCap.length}`} description="AI features paused until next month" icon={AlertOctagon} tone="var(--a-red)" />
          {alerts.atCap.length ? <CustomerList rows={alerts.atCap} detail={capDetail} /> : <AllClear message="Nobody has hit their cap." />}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title={`Near AI cap · ${alerts.nearCap.length}`} description="80% or more of this month's cap used" icon={AlertTriangle} tone="var(--a-amber)" />
          {alerts.nearCap.length ? <CustomerList rows={alerts.nearCap} detail={capDetail} /> : <AllClear message="No one is close to a cap." />}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title={`Upsell candidates · ${alerts.upsell.length}`} description="Free accounts that used their monthly proposal" icon={TrendingUp} tone="var(--a-teal)" />
          {alerts.upsell.length ? (
            <CustomerList rows={alerts.upsell} detail={(row) => `${row.rfpsThisMonth} ${row.rfpsThisMonth === 1 ? "proposal" : "proposals"} this month · ${row.libraryItems} library ${row.libraryItems === 1 ? "item" : "items"}`} />
          ) : (
            <AllClear message="No free accounts at their limit." />
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title={`Stuck AI locks · ${alerts.locked.length}`} description="A task is marked as running for this account" icon={Lock} tone="#3987e5" />
          {alerts.locked.length ? (
            <ul className="space-y-3">
              {alerts.locked.map((user) => (
                <li key={user.id} className="rounded-xl border border-(--a-border) p-3">
                  <Link href={`/admin/customers/${user.id}`} className="block truncate text-sm text-(--a-text) hover:text-(--a-teal)">
                    {user.agencyName || user.email}
                  </Link>
                  <p className="mb-2 text-xs text-(--a-muted)">Lock expires {relativeTime(user.aiBusyUntil)}</p>
                  <UnlockAiButton userId={user.id} locked />
                </li>
              ))}
            </ul>
          ) : (
            <AllClear message="No AI tasks are running." />
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title={`Allowance used up · ${alerts.exhausted.length}`} description="Proposals out of extractions, drafts or revisions" icon={RotateCcw} tone="#d95926" />
          {alerts.exhausted.length ? (
            <ul className="-mx-2 space-y-1">
              {alerts.exhausted.slice(0, 12).map((rfp) => (
                <li key={rfp.rfpId} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
                  <Link href={`/admin/customers/${rfp.userId}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm text-(--a-text)">{rfp.title}</div>
                    <div className="truncate text-xs text-(--a-muted)">
                      Used all {rfp.used.join(", ")} · {rfp.email}
                    </div>
                  </Link>
                  <ResetAllowanceButton userId={rfp.userId} rfpId={rfp.rfpId} />
                </li>
              ))}
            </ul>
          ) : (
            <AllClear message="Every proposal has allowance left." />
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title={`Quiet paying accounts · ${alerts.inactivePaying.length}`} description="No activity for 14+ days, churn risk" icon={Moon} tone="var(--a-muted)" />
          {alerts.inactivePaying.length ? (
            <CustomerList rows={alerts.inactivePaying} detail={(row) => `Last active ${relativeTime(row.lastActiveAt)} · ${usd(row.revenueUsd, 0)}/mo`} />
          ) : (
            <AllClear message="Every paying account is active." />
          )}
        </SpotlightCard>
      </Stagger>
    </>
  );
}

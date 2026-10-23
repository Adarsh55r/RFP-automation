import { Bot, Cpu, FileText, PiggyBank, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { PlanBadge, capTone } from "@/components/admin/badges";
import { BarList, CostByActionChart, Meter } from "@/components/admin/charts";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/admin/admin-shell";
import { SpotlightCard, Stagger } from "@/components/admin/spotlight-card";
import { AllClear, CardHeader, Pill } from "@/components/admin/ui";
import { getAiCosts } from "@/lib/admin-data";
import { compact, usd } from "@/lib/admin-format";

const ACTION_LABELS: Record<string, string> = {
  extract: "Requirement extraction",
  full_draft: "Full drafts",
  revision: "Section revisions",
};

export default async function AdminCostsPage() {
  const costs = await getAiCosts();

  return (
    <>
      <PageHeader
        eyebrow="Unit economics"
        title="AI costs"
        description="Every model call is metered with its tokens and cost. Figures cover the current calendar month (UTC)."
        actions={<Pill>{costs.calls.toLocaleString("en-US")} calls this month</Pill>}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Spend this month" value={costs.totalUsd} format="usd" icon={Bot} accent="#f5b547" hint="all accounts" />
        <KpiCard label="Avg cost per proposal" value={costs.avgPerProposalUsd} format="usd" icon={FileText} accent="#d95926" hint={`p95 ${usd(costs.p95PerProposalUsd, 2)} · ${costs.proposals} proposals touched`} />
        <KpiCard label="Model calls" value={costs.calls} icon={Zap} accent="#3987e5" hint={costs.calls ? `${usd(costs.totalUsd / costs.calls, 4)} per call` : undefined} />
        <KpiCard label="Saved by prompt caching" value={costs.cacheSavingsUsd} format="usd" icon={PiggyBank} accent="#34d399" hint={`${costs.cacheHitPct.toFixed(0)}% of input tokens cached`} />
      </Stagger>

      <Stagger className="mt-4 grid gap-4 lg:grid-cols-3">
        <SpotlightCard className="p-5 lg:col-span-2" interactive={false}>
          <CardHeader title="Daily spend by task" description="Last 30 days, stacked" />
          <CostByActionChart data={costs.stacked} />
        </SpotlightCard>
        <SpotlightCard className="p-5">
          <CardHeader title="Where the money goes" description="This month, by task" />
          <BarList
            color="#d95926"
            money
            items={costs.byAction
              .filter((row) => row.calls > 0)
              .map((row) => ({
                key: row.action,
                label: ACTION_LABELS[row.action] ?? row.action,
                value: row.costUsd,
                sub: `${row.calls} calls · ${row.calls ? usd(row.costUsd / row.calls, 3) : "$0"} each`,
              }))}
          />
        </SpotlightCard>
      </Stagger>

      <Stagger className="mt-4 grid gap-4 lg:grid-cols-2">
        <SpotlightCard className="p-0" interactive={false}>
          <div className="p-5 pb-0">
            <CardHeader title="By model" description="Tokens and cost per model this month" icon={Cpu} tone="#3987e5" />
          </div>
          {costs.byModel.length === 0 ? (
            <AllClear message="No model calls this month." />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-(--a-muted)">
                <tr className="border-y border-(--a-border)">
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-3 py-3 text-right font-medium">Calls</th>
                  <th className="px-3 py-3 text-right font-medium">Input</th>
                  <th className="px-3 py-3 text-right font-medium">Output</th>
                  <th className="px-5 py-3 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {costs.byModel.map((row) => (
                  <tr key={row.model} className="border-b border-(--a-border) transition-colors last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3 font-mono text-xs text-(--a-text)">{row.model}</td>
                    <td className="px-3 py-3 text-right text-(--a-text-2)">{row.calls}</td>
                    <td className="px-3 py-3 text-right text-(--a-text-2)">{compact(row.inputTokens)}</td>
                    <td className="px-3 py-3 text-right text-(--a-text-2)">{compact(row.outputTokens)}</td>
                    <td className="px-5 py-3 text-right font-medium text-(--a-text)">{usd(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SpotlightCard>

        <SpotlightCard className="p-5">
          <CardHeader title="Top spenders" description="Highest AI cost this month, with cap usage" icon={Trophy} tone="var(--a-amber)" />
          {costs.topUsers.length === 0 ? (
            <AllClear message="No usage yet this month." />
          ) : (
            <ul className="-mx-2 space-y-1">
              {costs.topUsers.map((row) => (
                <li key={row.userId}>
                  <Link href={`/admin/customers/${row.userId}`} className="block rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-(--a-text)">{row.company && row.company !== "—" ? row.company : row.email}</span>
                        <PlanBadge tier={row.tier} />
                      </span>
                      <span className="shrink-0 tabular-nums text-(--a-text)">
                        {usd(row.costUsd)} <span className="text-xs text-(--a-muted)">· {row.capPct.toFixed(0)}% cap</span>
                      </span>
                    </div>
                    <Meter pct={row.capPct} color={capTone(row.capPct)} label={`${row.capPct.toFixed(0)}% of AI cap`} />
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

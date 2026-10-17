import { ArrowLeft, BadgeDollarSign, Bot, Coins, FileText, Library, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanBadge, capTone } from "@/components/admin/badges";
import { Meter, TrendChart } from "@/components/admin/charts";
import { PlanSwitcher, ResetAllowanceButton, ResetReviewPromptButton, UnlockAiButton } from "@/components/admin/customer-actions";
import { KpiCard } from "@/components/admin/kpi-card";
import { SpotlightCard, Stagger } from "@/components/admin/spotlight-card";
import { AllClear, CardHeader } from "@/components/admin/ui";
import { getCustomerDetail } from "@/lib/admin-data";
import { dateLabel, relativeTime, usd } from "@/lib/admin-format";

const ACTION_LABELS: Record<string, string> = {
  extract: "Extraction",
  full_draft: "Full draft",
  revision: "Revision",
};

const REVIEW_LABELS: Record<string, string> = {
  reviewed: "Clicked “Leave a review”",
  feedback: "Sent private feedback",
  later: "Chose “Maybe later”",
  declined: "Chose “Don’t ask again”",
};

const LIBRARY_LABELS: Record<string, string> = {
  case_study: "Case studies",
  team_bio: "Team bios",
  certification: "Certifications",
  company_profile: "Company profile",
  saved_answer: "Saved answers",
};

function UsageCell({ used, allowed }: { used: number; allowed: number }) {
  const pct = (used / allowed) * 100;
  return (
    <div className="w-24">
      <div className="mb-1 text-xs tabular-nums text-(--a-text)">
        {used}
        <span className="text-(--a-muted)"> / {allowed}</span>
      </div>
      <Meter pct={pct} color={capTone(pct)} label={`${used} of ${allowed} used`} />
    </div>
  );
}

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();

  const { user, month, lifetime, allowance } = detail;
  const name = user.agencyName?.trim() || user.email;
  const capPct = (month.aiCostUsd / month.capUsd) * 100;
  const rfpsLeft = month.rfpLimit === null ? null : Math.max(month.rfpLimit - month.rfpsThisMonth, 0);

  return (
    <>
      <Link
        href="/admin/customers"
        className="group mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm text-(--a-text-2) outline-none transition-colors hover:text-(--a-text) focus-visible:ring-2 focus-visible:ring-(--a-teal)/60"
      >
        <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" />
        All customers
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgb(45_212_191/0.35),rgb(57_135_229/0.35))] text-xl font-semibold uppercase ring-1 ring-white/15 shadow-[0_0_40px_rgb(45_212_191/0.2)]">
          {(user.agencyName?.trim() || user.email.split("@")[1] || user.email).slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="admin-gradient-text">{name}</span>
            </h1>
            <PlanBadge tier={user.tier} />
            {user.status !== "active" ? (
              <span className="rounded-full bg-(--a-amber)/12 px-2 py-0.5 text-xs text-(--a-amber)">{user.status.replace("_", " ")}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-(--a-text-2)">
            {user.email} · joined {dateLabel(user.createdAt)}
            {user.teamSize ? ` · team of ${user.teamSize}` : ""}
          </p>
        </div>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Est. revenue / month" value={detail.revenueUsd} format="usd0" icon={BadgeDollarSign} accent="#34d399" hint={detail.revenueUsd ? "list price" : "not paying"} />
        <KpiCard
          label="AI spend this month"
          value={month.aiCostUsd}
          format="usd"
          icon={Bot}
          accent="#f5b547"
          hint={`${capPct.toFixed(0)}% of ${usd(month.capUsd, 0)} cap`}
          spark={detail.costSeries.map((point) => point.value)}
        />
        <KpiCard label="AI calls this month" value={month.aiCalls} icon={Zap} accent="#3987e5" hint={`${lifetime.aiCalls.toLocaleString("en-US")} lifetime`} />
        <KpiCard
          label="Proposals this month"
          value={month.rfpsThisMonth}
          icon={FileText}
          accent="#d95926"
          hint={rfpsLeft === null ? "unlimited plan" : `${rfpsLeft} of ${month.rfpLimit} left`}
        />
      </Stagger>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Stagger className="space-y-4 xl:col-span-2">
          <SpotlightCard className="p-5" interactive={false}>
            <TrendChart metrics={[{ key: "cost", label: "AI spend", color: "#c98500", money: true, data: detail.costSeries }]} height={200} />
          </SpotlightCard>

          <SpotlightCard className="p-0" interactive={false}>
            <div className="p-5 pb-0">
              <CardHeader
                title="Proposals"
                description={`Per-proposal allowance on this plan: ${allowance.extract} extractions, ${allowance.full_draft} full drafts, ${allowance.revision} revisions`}
                icon={FileText}
              />
            </div>
            {detail.rfps.length === 0 ? (
              <AllClear message="No proposals uploaded yet." />
            ) : (
              <div className="admin-scroll overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-(--a-muted)">
                    <tr className="border-y border-(--a-border)">
                      <th className="px-5 py-3 font-medium">Proposal</th>
                      <th className="px-3 py-3 font-medium">Extractions</th>
                      <th className="px-3 py-3 font-medium">Full drafts</th>
                      <th className="px-3 py-3 font-medium">Revisions</th>
                      <th className="px-5 py-3 text-right font-medium">Allowance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.rfps.map((rfp) => {
                      const used = rfp.extractCount + rfp.fullDraftCount + rfp.revisionCount;
                      return (
                        <tr key={rfp.id} className="border-b border-(--a-border) transition-colors last:border-0 hover:bg-white/[0.03]">
                          <td className="px-5 py-3">
                            <div className="max-w-xs truncate font-medium text-(--a-text)">{rfp.title}</div>
                            <div className="text-xs text-(--a-muted)">
                              {rfp.status} · {rfp.extractedDocumentType?.replace(/_/g, " ") ?? "unclassified"} · {dateLabel(rfp.createdAt)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <UsageCell used={rfp.extractCount} allowed={allowance.extract} />
                          </td>
                          <td className="px-3 py-3">
                            <UsageCell used={rfp.fullDraftCount} allowed={allowance.full_draft} />
                          </td>
                          <td className="px-3 py-3">
                            <UsageCell used={rfp.revisionCount} allowed={allowance.revision} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <ResetAllowanceButton userId={user.id} rfpId={rfp.id} disabled={used === 0} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SpotlightCard>

          <SpotlightCard className="p-0" interactive={false}>
            <div className="p-5 pb-0">
              <CardHeader title="Recent AI calls" description="Last 25 model calls with tokens and cost" icon={Coins} tone="var(--a-amber)" />
            </div>
            {detail.recentCalls.length === 0 ? (
              <AllClear message="No AI calls yet." />
            ) : (
              <div className="admin-scroll overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.08em] text-(--a-muted)">
                    <tr className="border-y border-(--a-border)">
                      <th className="px-5 py-3 font-medium">When</th>
                      <th className="px-3 py-3 font-medium">Action</th>
                      <th className="px-3 py-3 font-medium">Model</th>
                      <th className="px-3 py-3 text-right font-medium">Input</th>
                      <th className="px-3 py-3 text-right font-medium">Cached</th>
                      <th className="px-3 py-3 text-right font-medium">Output</th>
                      <th className="px-5 py-3 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {detail.recentCalls.map((call) => (
                      <tr key={call.id} className="border-b border-(--a-border) transition-colors last:border-0 hover:bg-white/[0.03]">
                        <td className="px-5 py-2.5 text-xs text-(--a-text-2)">{relativeTime(call.createdAt)}</td>
                        <td className="px-3 py-2.5 text-(--a-text)">{ACTION_LABELS[call.action] ?? call.action}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-(--a-text-2)">{call.model}</td>
                        <td className="px-3 py-2.5 text-right text-(--a-text-2)">{call.inputTokens.toLocaleString("en-US")}</td>
                        <td className="px-3 py-2.5 text-right text-(--a-muted)">{call.cachedInputTokens.toLocaleString("en-US")}</td>
                        <td className="px-3 py-2.5 text-right text-(--a-text-2)">{call.outputTokens.toLocaleString("en-US")}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-(--a-text)">{usd(call.costUsd, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SpotlightCard>
        </Stagger>

        <Stagger className="space-y-4">
          <SpotlightCard className="p-5">
            <CardHeader title="Admin actions" description="Manual overrides until Stripe billing is live" icon={ShieldCheck} />
            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-(--a-muted)">Plan</p>
            <PlanSwitcher userId={user.id} tier={user.tier} />
            <p className="mb-2 mt-5 text-xs uppercase tracking-[0.12em] text-(--a-muted)">AI task lock</p>
            <UnlockAiButton userId={user.id} locked={user.aiLocked} />
            <p className="mb-2 mt-5 text-xs uppercase tracking-[0.12em] text-(--a-muted)">Review request</p>
            <ResetReviewPromptButton userId={user.id} asked={user.reviewPromptCount > 0 || Boolean(user.reviewResponse)} />
            <p className="mt-2 text-xs text-(--a-muted)">Shows the review card again after their next export. Handy for testing on your own account.</p>
          </SpotlightCard>

          <SpotlightCard className="p-5">
            <CardHeader title="Limits this month" icon={Zap} tone="var(--a-amber)" />
            <div className="space-y-5">
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-(--a-text-2)">AI spend cap</span>
                  <span className="tabular-nums text-(--a-text)">
                    {usd(month.aiCostUsd)} / {usd(month.capUsd, 0)}
                  </span>
                </div>
                <Meter pct={capPct} color={capTone(capPct)} label={`${capPct.toFixed(0)}% of AI cap`} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-(--a-text-2)">New proposals</span>
                  <span className="tabular-nums text-(--a-text)">
                    {month.rfpsThisMonth} / {month.rfpLimit ?? "∞"}
                  </span>
                </div>
                <Meter
                  pct={month.rfpLimit ? (month.rfpsThisMonth / month.rfpLimit) * 100 : 0}
                  color={capTone(month.rfpLimit ? (month.rfpsThisMonth / month.rfpLimit) * 100 : 0)}
                  label="Proposals used this month"
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 border-t border-(--a-border) pt-4 text-sm">
                <div>
                  <dt className="text-xs text-(--a-muted)">Input tokens</dt>
                  <dd className="tabular-nums text-(--a-text)">{month.inputTokens.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-(--a-muted)">Output tokens</dt>
                  <dd className="tabular-nums text-(--a-text)">{month.outputTokens.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-(--a-muted)">Lifetime AI cost</dt>
                  <dd className="tabular-nums text-(--a-text)">{usd(lifetime.aiCostUsd)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-(--a-muted)">Margin this month</dt>
                  <dd className="tabular-nums text-(--a-text)">{usd(detail.revenueUsd - month.aiCostUsd)}</dd>
                </div>
              </dl>
            </div>
          </SpotlightCard>

          <SpotlightCard className="p-5">
            <CardHeader title="Content library" description="What the AI can draw on" icon={Library} tone="#3987e5" />
            <ul className="space-y-2 text-sm">
              {Object.entries(LIBRARY_LABELS).map(([type, label]) => (
                <li key={type} className="flex justify-between">
                  <span className="text-(--a-text-2)">{label}</span>
                  <span className="tabular-nums text-(--a-text)">{detail.library[type] ?? 0}</span>
                </li>
              ))}
            </ul>
          </SpotlightCard>

          <SpotlightCard className="p-5">
            <CardHeader title="Account" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-(--a-text-2)">Subscription</dt>
                <dd className="text-(--a-text)">{user.status.replace("_", " ")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-(--a-text-2)">Renews</dt>
                <dd className="text-(--a-text)">
                  {user.subscription?.currentPeriodEnd ? dateLabel(user.subscription.currentPeriodEnd) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-(--a-text-2)">Last AI call</dt>
                <dd className="text-(--a-text)">{relativeTime(detail.recentCalls[0]?.createdAt ?? null)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-(--a-text-2)">Review request</dt>
                <dd className="text-right text-(--a-text)">
                  {user.reviewResponse
                    ? `${REVIEW_LABELS[user.reviewResponse] ?? user.reviewResponse} · ${relativeTime(user.reviewRespondedAt)}`
                    : user.reviewPromptCount > 0
                      ? `Shown ${relativeTime(user.reviewPromptedAt)}, no answer`
                      : "Not asked yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-(--a-text-2)">Clerk ID</dt>
                <dd className="truncate font-mono text-xs text-(--a-muted)" title={user.clerkId}>
                  {user.clerkId}
                </dd>
              </div>
            </dl>
          </SpotlightCard>
        </Stagger>
      </div>
    </>
  );
}

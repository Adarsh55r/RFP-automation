import Link from "next/link";
import { PageHeader } from "@/components/admin/admin-shell";
import { SpotlightCard } from "@/components/admin/spotlight-card";
import { CardHeader, Pill } from "@/components/admin/ui";
import { prisma } from "@/lib/db";
import { FUNNEL_EVENTS, funnelBySegment } from "@/lib/funnel";
import { getSegment } from "@/lib/segments";

const PERIODS = [30, 90, 365] as const;

const label = (segment: string) =>
  segment === "none" ? "No segment" : segment === "checklist-tool" ? "Free checklist tool" : (getSegment(segment)?.name ?? segment);

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

/** Which segment converts: visits → sign-ups → first draft → paid → second proposal. */
export default async function AdminFunnelPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const requested = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(requested) ? requested : 90;
  const since = new Date(Date.now() - days * 86_400_000);
  const [rows, counts] = await Promise.all([
    funnelBySegment(since),
    prisma.funnelEvent.groupBy({ by: ["event"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const countOf = (event: string) => counts.find((row) => row.event === event)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Funnel by segment"
        description="From our own event records: no cookies, no document content. Sign-ups are attributed to the ?seg= link or landing page they came from."
        actions={
          <div className="flex gap-2">
            {PERIODS.map((period) => (
              <Link key={period} href={`/admin/funnel?days=${period}`}>
                <Pill>{period === days ? `● ${period} days` : `${period} days`}</Pill>
              </Link>
            ))}
          </div>
        }
      />

      <SpotlightCard className="p-5" interactive={false}>
        <CardHeader title="Conversion by segment" description={`Last ${days} days. Percentages are of the step before.`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-(--a-muted)">
              <tr>
                {["Segment", "Visits", "Sign-ups", "First draft", "Paid", "Second proposal"].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.segment} className="border-t border-(--a-border)">
                  <td className="px-4 py-3 font-medium">{label(row.segment)}</td>
                  <td className="px-4 py-3">{row.visits}</td>
                  <td className="px-4 py-3">
                    {row.signups} <span className="text-(--a-muted)">{pct(row.signups, row.visits)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.firstDraft} <span className="text-(--a-muted)">{pct(row.firstDraft, row.signups)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.paid} <span className="text-(--a-muted)">{pct(row.paid, row.firstDraft)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.secondProposal} <span className="text-(--a-muted)">{pct(row.secondProposal, row.paid || row.firstDraft)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-(--a-muted)">
          Visits are page views of marketing pages, not unique people. &quot;No segment&quot; visits came without a ?seg= link. Second
          proposal is shown against paid accounts, or against first drafts where none paid.
        </p>
      </SpotlightCard>

      <SpotlightCard className="mt-4 p-5" interactive={false}>
        <CardHeader title="All events" description={`Last ${days} days`} />
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {FUNNEL_EVENTS.map((event) => (
            <div key={event}>
              <dt className="text-xs text-(--a-muted)">{event.replace(/_/g, " ")}</dt>
              <dd className="mt-1 text-xl font-semibold">{countOf(event)}</dd>
            </div>
          ))}
        </dl>
      </SpotlightCard>
    </>
  );
}

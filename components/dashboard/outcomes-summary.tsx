import { Card } from "@/components/ui/card";
import type { summarizeOutcomes } from "@/lib/outcomes";

type Summary = ReturnType<typeof summarizeOutcomes>;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/** The user's own bid results. Shown once at least one outcome is recorded. */
export function OutcomesSummary({ summary }: { summary: Summary }) {
  if (summary.tracked === 0) return null;
  const values = Object.entries(summary.wonValue);
  const stats = [
    { label: "Bids submitted", value: String(summary.submitted) },
    { label: "Awaiting a decision", value: String(summary.pending) },
    { label: "Won / lost", value: `${summary.won} / ${summary.lost}` },
    {
      label: "Your win rate",
      value: summary.winRate === null ? "—" : `${Math.round(summary.winRate * 100)}%`,
      note: summary.winRate === null ? "Shown once a bid is won or lost" : `Of ${summary.won + summary.lost} decided bids`,
    },
    {
      label: "Value won",
      value: values.length === 0 ? "—" : values.map(([currency, amount]) => money(amount, currency)).join(" + "),
    },
    {
      label: "Hours saved (your estimates)",
      value: summary.hoursSavedTotal === null ? "—" : String(Math.round(summary.hoursSavedTotal)),
      note: summary.hoursReported > 0 ? `From ${summary.hoursReported} bid${summary.hoursReported === 1 ? "" : "s"}` : undefined,
    },
  ];
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">Your bid results</p>
        <p className="mt-1 text-sm text-slate">From the outcomes you record on each RFP. Only you see these.</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-slate">{stat.label}</dt>
            <dd className="mt-1 font-display text-2xl font-medium text-ink">{stat.value}</dd>
            {stat.note ? <dd className="text-xs text-slate">{stat.note}</dd> : null}
          </div>
        ))}
      </dl>
    </Card>
  );
}

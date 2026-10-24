import { Card } from "@/components/ui/card";

export type AllowanceSummary = {
  planName: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  periodLabel: string;
  overagePriceUsd: number | null;
  accessEnded: boolean;
};

export function StatCards({
  allowance,
  draftsInProgress,
}: {
  allowance: AllowanceSummary;
  draftsInProgress: number;
}) {
  const { planName, used, limit, remaining, periodLabel, overagePriceUsd, accessEnded } = allowance;
  const remainingHint = accessEnded
    ? "Your pass has ended"
    : remaining === 0 && overagePriceUsd !== null
      ? `Extra proposals are $${overagePriceUsd} each, after you confirm`
      : periodLabel === "this month"
        ? "Resets on the 1st of each month (UTC)"
        : `Included ${periodLabel}`;

  const stats = [
    {
      label: `Proposals used ${periodLabel}`,
      value: String(used),
      hint: `${planName} plan`,
    },
    {
      label: "Proposals left",
      value: remaining === null ? "No limit" : `${remaining} of ${limit}`,
      hint: remainingHint,
    },
    {
      label: "Drafts in progress",
      value: String(draftsInProgress),
      hint: "RFPs in drafting or drafted status",
    },
  ];

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            {stat.label}
          </p>
          <p className="mt-4 font-display text-4xl font-medium text-ink">
            {stat.value}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate">{stat.hint}</p>
        </Card>
      ))}
    </div>
  );
}

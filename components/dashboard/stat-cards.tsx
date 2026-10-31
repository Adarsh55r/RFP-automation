import { FileStack, Gauge, PenLine } from "lucide-react";
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
      ? `Extra proposals are $${overagePriceUsd} each, paid before the upload`
      : periodLabel === "this month"
        ? "Resets on the 1st of each month (UTC)"
        : `Included ${periodLabel}`;

  const stats = [
    {
      label: `Proposals used ${periodLabel}`,
      icon: Gauge,
      value: String(used),
      hint: `${planName} plan`,
    },
    {
      label: "Proposals left",
      icon: FileStack,
      value: remaining === null ? "No limit" : `${remaining} of ${limit}`,
      hint: remainingHint,
    },
    {
      label: "Drafts in progress",
      icon: PenLine,
      value: String(draftsInProgress),
      hint: "RFPs in drafting or drafted status",
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className="hover-lift glow-ring animate-fade-up relative overflow-hidden"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(circle,rgb(var(--glow)/0.14),transparent_70%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <p className="font-mono text-[11px] tracking-[0.14em] text-slate uppercase">{stat.label}</p>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                <Icon aria-hidden className="size-[18px]" strokeWidth={1.9} />
              </span>
            </div>
            <p className="relative mt-3 font-display text-4xl font-semibold tracking-tight text-ink">{stat.value}</p>
            <p className="relative mt-2 text-sm leading-relaxed text-slate">{stat.hint}</p>
          </Card>
        );
      })}
    </div>
  );
}

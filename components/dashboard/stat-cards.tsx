import { Card } from "@/components/ui/card";

type StatCardsProps = {
  rfpsThisMonth: number;
  rfpsRemaining: number | null;
  rfpsLimit: number | null;
  draftsInProgress: number;
};

export function StatCards({
  rfpsThisMonth,
  rfpsRemaining,
  rfpsLimit,
  draftsInProgress,
}: StatCardsProps) {
  const remainingLabel =
    rfpsRemaining === null
      ? "Unlimited"
      : `${rfpsRemaining} of ${rfpsLimit ?? "—"}`;

  const stats = [
    {
      label: "RFPs this month",
      value: String(rfpsThisMonth),
      hint: "Uploaded in the current billing month",
    },
    {
      label: "RFPs remaining on plan",
      value: remainingLabel,
      hint:
        rfpsRemaining === null
          ? "Agency plan — no monthly cap"
          : "Resets on the 1st of each month",
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

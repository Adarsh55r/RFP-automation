import Link from "next/link";
import { getProposalAllowance, type SubscriptionTerms } from "@/lib/entitlements";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

/**
 * Proposals left on the plan, shown in the dashboard header. A server
 * component rendered inside Suspense, so it never delays the page.
 */
export async function AllowanceBadge({ userId, subscription }: { userId: string; subscription: SubscriptionTerms }) {
  const allowance = await getProposalAllowance(userId, subscription);
  const label = allowance.accessEnded
    ? "Pass ended"
    : allowance.remaining === null
      ? `${allowance.used} proposals ${allowance.periodLabel}`
      : `${allowance.remaining} of ${allowance.limit} proposals left`;
  const low = allowance.accessEnded || allowance.remaining === 0;
  return (
    <Link
      href="/dashboard/billing"
      title={`${allowance.plan.name}: ${allowance.used} used ${allowance.periodLabel}`}
      className={cn(
        "hidden items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors duration-200 hover:border-brand/50 lg:inline-flex",
        low ? "border-accent/50 bg-accent/10 text-ink" : "border-border bg-surface-raised/70 text-slate",
        focusRing,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", low ? "bg-accent" : "bg-brand shadow-[0_0_8px_rgb(var(--glow)/0.9)]")} />
      {label}
    </Link>
  );
}

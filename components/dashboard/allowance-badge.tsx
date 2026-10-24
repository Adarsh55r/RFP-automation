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
        "hidden rounded-full border px-3 py-1 font-mono text-xs tracking-wide md:inline-flex",
        low ? "border-accent/50 bg-accent/10 text-ink" : "border-border text-slate",
        focusRing,
      )}
    >
      {label}
    </Link>
  );
}

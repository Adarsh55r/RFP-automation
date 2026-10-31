import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Shown where a new proposal would start once the plan's limit is reached and
 * the plan has no pay-per-proposal option: explains why, and what to do next.
 */
export function PlanLimitNotice({ title, message }: { title: string; message: string }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="text-sm leading-relaxed text-slate">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/dashboard/billing">Compare plans</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </Card>
  );
}

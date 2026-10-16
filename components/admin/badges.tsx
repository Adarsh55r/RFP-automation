import type { CustomerRow } from "@/lib/admin-data";
import { cn } from "@/lib/cn";

export const PLAN_COLORS: Record<string, string> = {
  free: "#3987e5",
  starter: "#d95926",
  growth: "#199e70",
  agency: "#c98500",
};

const PLAN_LABELS: Record<string, string> = { free: "Free", starter: "Starter", growth: "Growth", agency: "Team" };

export function PlanBadge({ tier, className }: { tier: string; className?: string }) {
  const color = PLAN_COLORS[tier] ?? "#6b778a";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-(--a-border-strong) bg-white/[0.03] px-2 py-0.5 text-xs font-medium text-(--a-text)",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {PLAN_LABELS[tier] ?? tier}
    </span>
  );
}

const FLAG_META: Record<CustomerRow["flags"][number], { label: string; tone: string }> = {
  "at-cap": { label: "At AI cap", tone: "text-(--a-red) bg-(--a-red)/12 ring-(--a-red)/25" },
  "near-cap": { label: "Near cap", tone: "text-(--a-amber) bg-(--a-amber)/12 ring-(--a-amber)/25" },
  upsell: { label: "Upsell", tone: "text-(--a-teal) bg-(--a-teal)/12 ring-(--a-teal)/25" },
  "power-user": { label: "Power user", tone: "text-[#93c5fd] bg-[#3987e5]/15 ring-[#3987e5]/30" },
  inactive: { label: "Inactive", tone: "text-(--a-muted) bg-white/[0.04] ring-white/10" },
};

export function FlagBadge({ flag }: { flag: CustomerRow["flags"][number] }) {
  const meta = FLAG_META[flag];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", meta.tone)}>
      {meta.label}
    </span>
  );
}

/** Spend vs cap; colour reflects state (reserved status colours), the number carries the meaning. */
export function capTone(pct: number) {
  if (pct >= 100) return "var(--a-red)";
  if (pct >= 80) return "var(--a-amber)";
  return "var(--a-teal)";
}

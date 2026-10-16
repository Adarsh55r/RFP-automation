import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { CountUp, type CountFormat } from "@/components/admin/count-up";
import { Sparkline } from "@/components/admin/sparkline";
import { SpotlightCard } from "@/components/admin/spotlight-card";
import { cn } from "@/lib/cn";

export type KpiCardProps = {
  label: string;
  value: number | null;
  format?: CountFormat;
  icon: LucideIcon;
  /** Percent change vs the previous period; positive is good unless `invertDelta`. */
  delta?: number | null;
  invertDelta?: boolean;
  hint?: string;
  spark?: number[];
  accent?: string;
};

export function KpiCard({
  label,
  value,
  format = "int",
  icon: Icon,
  delta,
  invertDelta,
  hint,
  spark,
  accent = "#2dd4bf",
}: KpiCardProps) {
  const good = delta == null ? null : invertDelta ? delta <= 0 : delta >= 0;

  return (
    <SpotlightCard className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-(--a-text-2)">{label}</span>
        <span
          className="flex size-8 items-center justify-center rounded-lg ring-1 ring-white/10"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        >
          <Icon aria-hidden className="size-4" style={{ color: accent }} />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold tracking-tight text-(--a-text)">
            {value == null ? <span className="text-(--a-muted)">—</span> : <CountUp value={value} format={format} />}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            {delta != null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                  good ? "bg-(--a-green)/12 text-(--a-green)" : "bg-(--a-red)/12 text-(--a-red)",
                )}
              >
                {delta >= 0 ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
                {Math.abs(delta).toFixed(0)}%
              </span>
            ) : null}
            {hint ? <span className="text-(--a-muted)">{hint}</span> : null}
          </div>
        </div>
        {spark ? <Sparkline values={spark} color={accent} /> : null}
      </div>
    </SpotlightCard>
  );
}

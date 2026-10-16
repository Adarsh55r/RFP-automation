"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PLAN_COLORS } from "@/components/admin/badges";
import { CountUp } from "@/components/admin/count-up";
import { shortDay, usd } from "@/lib/admin-format";
import { cn } from "@/lib/cn";

const AXIS = { fill: "#6b778a", fontSize: 11 };
const GRID = "rgb(255 255 255 / 0.06)";

function moneyTick(value: number) {
  if (value === 0) return "$0";
  if (value >= 10) return `$${Math.round(value)}`;
  return `$${value.toFixed(value < 0.1 ? 3 : 2)}`;
}

type TooltipRow = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number };

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  names,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  formatValue: (value: number) => string;
  names?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((row) => row.value !== undefined);
  return (
    <div className="min-w-36 rounded-xl border border-(--a-border-strong) bg-[#0b1220]/95 px-3 py-2.5 text-xs shadow-2xl backdrop-blur-md">
      {label !== undefined ? (
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-(--a-muted)">
          {typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label) ? shortDay(label) : label}
        </div>
      ) : null}
      {rows.map((row) => (
        <div key={String(row.dataKey ?? row.name)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-(--a-text-2)">
            <span aria-hidden className="size-2 rounded-full" style={{ background: row.color }} />
            {names?.[String(row.dataKey)] ?? row.name}
          </span>
          <span className="font-medium tabular-nums text-(--a-text)">{formatValue(Number(row.value))}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trend: one metric at a time (never two y-scales on one chart).      */
/* ------------------------------------------------------------------ */

export type TrendMetric = {
  key: string;
  label: string;
  color: string;
  money?: boolean;
  data: { day: string; value: number }[];
};

export function TrendChart({ metrics, height = 260 }: { metrics: TrendMetric[]; height?: number }) {
  const [activeKey, setActiveKey] = useState(metrics[0]?.key);
  const metric = metrics.find((item) => item.key === activeKey) ?? metrics[0];
  const gradientId = useId();
  const reduceMotion = useReducedMotion();
  const total = metric.data.reduce((sum, point) => sum + point.value, 0);
  const format = (value: number) => (metric.money ? usd(value) : value.toLocaleString("en-US"));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.12em] text-(--a-text-2)">{metric.label} · last 30 days</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            <CountUp key={metric.key} value={total} format={metric.money ? "usd" : "int"} duration={0.7} />
          </div>
        </div>
        {metrics.length > 1 ? (
        <LayoutGroup id={`trend-${gradientId}`}>
          <div role="tablist" aria-label="Metric" className="flex rounded-xl border border-(--a-border) bg-white/[0.02] p-1">
            {metrics.map((item) => {
              const selected = item.key === metric.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveKey(item.key)}
                  className={cn(
                    "relative rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--a-teal)/60",
                    selected ? "text-(--a-text)" : "text-(--a-text-2) hover:text-(--a-text)",
                  )}
                >
                  {selected ? (
                    <motion.span
                      layoutId="trend-tab"
                      className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  ) : null}
                  <span className="relative flex items-center gap-1.5">
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: item.color }} />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
        ) : null}
      </div>

      <div className="mt-5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={metric.data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={60}
              allowDecimals={Boolean(metric.money)}
              tickFormatter={(value: number) => (metric.money ? moneyTick(value) : String(value))}
            />
            <Tooltip
              cursor={{ stroke: "rgb(255 255 255 / 0.25)", strokeDasharray: "4 4" }}
              content={(props) => (
                <ChartTooltip
                  {...(props as unknown as { active?: boolean; payload?: TooltipRow[]; label?: string })}
                  formatValue={format}
                  names={{ value: metric.label }}
                />
              )}
            />
            <Area
              key={metric.key}
              type="monotone"
              dataKey="value"
              name={metric.label}
              stroke={metric.color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#0d1422", fill: metric.color }}
              isAnimationActive={!reduceMotion}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plan mix donut                                                      */
/* ------------------------------------------------------------------ */

export function PlanDonut({ data }: { data: { tier: string; label: string; value: number }[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const focus = data.find((item) => item.tier === hovered);
  const visible = data.filter((item) => item.value > 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible.length ? visible : [{ tier: "none", label: "No accounts", value: 1 }]}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={visible.length > 1 ? 2 : 0}
              stroke="#0d1422"
              strokeWidth={2}
              cornerRadius={4}
              isAnimationActive={!reduceMotion}
              animationDuration={900}
              onMouseLeave={() => setHovered(null)}
            >
              {(visible.length ? visible : [{ tier: "none" }]).map((item) => (
                <Cell
                  key={item.tier}
                  fill={PLAN_COLORS[item.tier] ?? "rgb(255 255 255 / 0.08)"}
                  opacity={hovered && hovered !== item.tier ? 0.35 : 1}
                  onMouseEnter={() => setHovered(item.tier)}
                  style={{ transition: "opacity 200ms ease", outline: "none" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={focus?.tier ?? "total"}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              className="text-center"
            >
              <div className="text-3xl font-semibold tabular-nums">{focus ? focus.value : total}</div>
              <div className="text-[11px] uppercase tracking-wider text-(--a-text-2)">{focus ? focus.label : "accounts"}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {data.map((item) => {
          const pct = total ? (item.value / total) * 100 : 0;
          return (
            <li
              key={item.tier}
              onMouseEnter={() => setHovered(item.tier)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors",
                hovered === item.tier ? "bg-white/[0.05]" : "",
              )}
            >
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: PLAN_COLORS[item.tier] }} />
              <span className="text-(--a-text)">{item.label}</span>
              <span className="ml-auto tabular-nums text-(--a-text)">{item.value}</span>
              <span className="w-12 text-right tabular-nums text-(--a-muted)">{pct.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stacked daily cost by action                                        */
/* ------------------------------------------------------------------ */

const ACTION_SERIES = [
  { key: "extract", label: "Requirement extraction", color: "#3987e5" },
  { key: "full_draft", label: "Full drafts", color: "#d95926" },
  { key: "revision", label: "Section revisions", color: "#199e70" },
];

export function CostByActionChart({ data, height = 280 }: { data: Record<string, number | string>[]; height?: number }) {
  const reduceMotion = useReducedMotion();
  const names = Object.fromEntries(ACTION_SERIES.map((series) => [series.key, series.label]));
  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-4 text-xs text-(--a-text-2)" aria-label="Legend">
        {ACTION_SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barCategoryGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} minTickGap={28} />
            <YAxis
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={moneyTick}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              content={(props) => (
                <ChartTooltip
                  {...(props as unknown as { active?: boolean; payload?: TooltipRow[]; label?: string })}
                  formatValue={(value) => usd(value, 3)}
                  names={names}
                />
              )}
            />
            {ACTION_SERIES.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                stackId="cost"
                fill={series.color}
                stroke="#0d1422"
                strokeWidth={1}
                radius={index === ACTION_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animated horizontal bars (funnel, ranked lists)                     */
/* ------------------------------------------------------------------ */

export function Funnel({ stages }: { stages: { stage: string; value: number }[] }) {
  const reduceMotion = useReducedMotion();
  const top = Math.max(stages[0]?.value ?? 0, 1);
  return (
    <ol className="space-y-4">
      {stages.map((stage, index) => {
        const pct = (stage.value / top) * 100;
        const previous = index > 0 ? stages[index - 1].value : null;
        const step = previous ? (stage.value / previous) * 100 : null;
        return (
          <li key={stage.stage} className="group">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="text-(--a-text)">{stage.stage}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-semibold tabular-nums">
                  <CountUp value={stage.value} />
                </span>
                {step !== null ? (
                  <span className="text-xs tabular-nums text-(--a-muted)">{step.toFixed(0)}% of previous</span>
                ) : null}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#2dd4bf,#3987e5)] shadow-[0_0_16px_rgb(45_212_191/0.35)] transition-[filter] group-hover:brightness-125"
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.max(pct, stage.value > 0 ? 2 : 0)}%` }}
                transition={{ duration: 1, delay: 0.15 + index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function BarList({
  items,
  money = false,
  color = "#3987e5",
}: {
  items: { key: string; label: React.ReactNode; value: number; sub?: React.ReactNode }[];
  money?: boolean;
  color?: string;
}) {
  const formatValue = (value: number) => (money ? usd(value) : value.toLocaleString("en-US"));
  const reduceMotion = useReducedMotion();
  const max = Math.max(...items.map((item) => item.value), 0.000001);
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-(--a-muted)">No usage recorded this month yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={item.key} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-(--a-text)">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-(--a-text)">{formatValue(item.value)}</span>
          </div>
          {item.sub ? <div className="mb-1 text-xs text-(--a-muted)">{item.sub}</div> : null}
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
            <motion.div
              className="h-full rounded-full transition-[filter] group-hover:brightness-125"
              style={{ background: color }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${Math.max((item.value / max) * 100, 1.5)}%` }}
              transition={{ duration: 0.9, delay: 0.1 + index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Animated progress bar for spend vs cap and allowances. */
export function Meter({ pct, color, label }: { pct: number; color: string; label?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={label}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${Math.min(Math.max(pct, pct > 0 ? 3 : 0), 100)}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronRight, Download, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FlagBadge, PLAN_COLORS, PlanBadge, capTone } from "@/components/admin/badges";
import { Meter } from "@/components/admin/charts";
import type { CustomerRow } from "@/lib/admin-data";
import { relativeTime, usd } from "@/lib/admin-format";
import { cn } from "@/lib/cn";

type SortKey = "company" | "tier" | "rfpsThisMonth" | "aiCallsMonth" | "aiCostMonthUsd" | "capPct" | "revenueUsd" | "lastActiveAt" | "createdAt";

const TIERS = [
  { id: "all", label: "All plans" },
  { id: "free", label: "Free" },
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "agency", label: "Team" },
];

const SEGMENTS = [
  { id: "all", label: "Everyone" },
  { id: "attention", label: "Needs attention" },
  { id: "paying", label: "Paying" },
  { id: "inactive", label: "Inactive 14d+" },
];

const TIER_RANK: Record<string, number> = { free: 0, starter: 1, growth: 2, agency: 3 };

function sortValue(row: CustomerRow, key: SortKey): number | string {
  switch (key) {
    case "company":
      return (row.company === "—" ? row.email : row.company).toLowerCase();
    case "tier":
      return TIER_RANK[row.tier] ?? 0;
    case "lastActiveAt":
      return row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : 0;
    case "createdAt":
      return new Date(row.createdAt).getTime();
    default:
      return row[key];
  }
}

function toCsv(rows: CustomerRow[]) {
  const header = [
    "email",
    "company",
    "plan",
    "status",
    "signed_up",
    "last_active",
    "rfps_total",
    "rfps_this_month",
    "rfp_limit",
    "library_items",
    "ai_calls_month",
    "ai_cost_month_usd",
    "ai_cap_usd",
    "est_revenue_usd",
    "est_margin_usd",
    "review_prompt",
    "flags",
  ];
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((row) =>
    [
      row.email,
      row.company,
      row.tier,
      row.status,
      row.createdAt,
      row.lastActiveAt ?? "",
      row.rfpsTotal,
      row.rfpsThisMonth,
      row.rfpLimit ?? "unlimited",
      row.libraryItems,
      row.aiCallsMonth,
      row.aiCostMonthUsd.toFixed(4),
      row.capUsd,
      row.revenueUsd,
      row.marginUsd.toFixed(2),
      row.reviewResponse ?? "",
      row.flags.join(" "),
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("whitespace-nowrap px-4 py-3 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "group inline-flex items-center gap-1 rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--a-teal)/60",
          active ? "text-(--a-text)" : "hover:text-(--a-text)",
        )}
      >
        {label}
        <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
          {active && sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
        </span>
      </button>
    </th>
  );
}

const PAGE = 50;

export function CustomersTable({ rows, initialQuery = "" }: { rows: CustomerRow[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tier, setTier] = useState("all");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "createdAt", dir: "desc" });
  const [limit, setLimit] = useState(PAGE);

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const row of rows) counts[row.tier] = (counts[row.tier] ?? 0) + 1;
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const result = rows.filter((row) => {
      if (tier !== "all" && row.tier !== tier) return false;
      if (segment === "attention" && !row.flags.some((flag) => flag === "at-cap" || flag === "near-cap" || flag === "upsell")) return false;
      if (segment === "paying" && row.revenueUsd <= 0) return false;
      if (segment === "inactive" && !row.flags.includes("inactive")) return false;
      if (needle && !`${row.email} ${row.company}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const direction = sort.dir === "asc" ? 1 : -1;
    return result.sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      return left < right ? -direction : left > right ? direction : 0;
    });
  }, [rows, query, tier, segment, sort]);

  const onSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "company" ? "asc" : "desc" }));

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `draftwin-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const visible = filtered.slice(0, limit);

  return (
    <div className="admin-card" data-interactive="false">
      <div className="flex flex-col gap-4 border-b border-(--a-border) p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="group relative min-w-56 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--a-muted) group-focus-within:text-(--a-teal)" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search email or company"
              aria-label="Search customers"
              className="h-10 w-full rounded-xl border border-(--a-border) bg-white/[0.03] pl-9 pr-9 text-sm text-(--a-text) placeholder:text-(--a-muted) outline-none transition-all focus:border-(--a-teal)/40 focus:shadow-[0_0_0_4px_rgb(45_212_191/0.08)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-(--a-muted) hover:bg-white/10 hover:text-(--a-text)"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex rounded-xl border border-(--a-border) bg-white/[0.02] p-1" role="group" aria-label="Segment">
            {SEGMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={segment === item.id}
                onClick={() => {
                  setSegment(item.id);
                  setLimit(PAGE);
                }}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--a-teal)/60",
                  segment === item.id ? "text-(--a-text)" : "text-(--a-text-2) hover:text-(--a-text)",
                )}
              >
                {segment === item.id ? (
                  <motion.span layoutId="segment-pill" className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                ) : null}
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-(--a-border) px-3 text-sm text-(--a-text-2) outline-none transition-all hover:border-(--a-teal)/40 hover:text-(--a-text) hover:shadow-[0_0_20px_rgb(45_212_191/0.12)] focus-visible:ring-2 focus-visible:ring-(--a-teal)/60"
          >
            <Download aria-hidden className="size-4" />
            CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Plan">
          {TIERS.map((item) => {
            const selected = tier === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setTier(item.id);
                  setLimit(PAGE);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-(--a-teal)/60",
                  selected
                    ? "border-(--a-teal)/40 bg-(--a-teal)/10 text-(--a-text)"
                    : "border-(--a-border) text-(--a-text-2) hover:border-(--a-border-strong) hover:text-(--a-text)",
                )}
              >
                {item.id !== "all" ? (
                  <span aria-hidden className="size-1.5 rounded-full" style={{ background: PLAN_COLORS[item.id] }} />
                ) : null}
                {item.label}
                <span className="tabular-nums text-(--a-muted)">{tierCounts[item.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="admin-scroll overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-(--a-muted)">
            <tr className="border-b border-(--a-border)">
              <SortHeader label="Customer" column="company" sort={sort} onSort={onSort} />
              <SortHeader label="Plan" column="tier" sort={sort} onSort={onSort} />
              <SortHeader label="RFPs this month" column="rfpsThisMonth" sort={sort} onSort={onSort} />
              <SortHeader label="AI calls" column="aiCallsMonth" sort={sort} onSort={onSort} align="right" />
              <SortHeader label="AI spend vs cap" column="capPct" sort={sort} onSort={onSort} />
              <SortHeader label="Est. revenue" column="revenueUsd" sort={sort} onSort={onSort} align="right" />
              <SortHeader label="Last active" column="lastActiveAt" sort={sort} onSort={onSort} />
              <th scope="col" className="px-4 py-3 font-medium">
                Signals
              </th>
              <th scope="col" className="w-8" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {visible.map((row, index) => {
                const remaining = row.rfpLimit === null ? null : Math.max(row.rfpLimit - row.rfpsThisMonth, 0);
                return (
                  <motion.tr
                    key={row.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 12) * 0.025 } }}
                    exit={{ opacity: 0 }}
                    onClick={() => router.push(`/admin/customers/${row.id}`)}
                    className="group cursor-pointer border-b border-(--a-border) transition-colors last:border-0 hover:bg-white/[0.035]"
                  >
                    <td className="px-4 py-3.5">
                      <a
                        href={`/admin/customers/${row.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          router.push(`/admin/customers/${row.id}`);
                        }}
                        className="flex items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-(--a-teal)/60"
                      >
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold uppercase text-(--a-text) ring-1 ring-white/10 transition-transform group-hover:scale-105"
                          style={{ background: `color-mix(in srgb, ${PLAN_COLORS[row.tier]} 22%, #121b2c)` }}
                        >
                          {(row.company !== "—" ? row.company : row.email.split("@")[1] ?? row.email).slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-64 truncate font-medium text-(--a-text)">{row.company !== "—" ? row.company : row.email}</span>
                          <span className="block max-w-64 truncate text-xs text-(--a-muted)">
                            {row.company !== "—" ? row.email : "No company name yet"}
                          </span>
                        </span>
                      </a>
                    </td>
                    <td className="px-4 py-3.5">
                      <PlanBadge tier={row.tier} />
                      {row.status !== "active" ? <div className="mt-1 text-[11px] text-(--a-amber)">{row.status.replace("_", " ")}</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="tabular-nums text-(--a-text)">
                        {row.rfpsThisMonth}
                        <span className="text-(--a-muted)"> / {row.rfpLimit ?? "∞"}</span>
                      </div>
                      <div className="whitespace-nowrap text-[11px] text-(--a-muted)">
                        {remaining === null ? "unlimited" : `${remaining} left`} · {row.rfpsTotal} all time
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-(--a-text)">{row.aiCallsMonth}</td>
                    <td className="w-48 px-4 py-3.5">
                      <div className="mb-1.5 flex justify-between text-xs tabular-nums">
                        <span className="text-(--a-text)">{usd(row.aiCostMonthUsd)}</span>
                        <span className="text-(--a-muted)">
                          {row.capPct.toFixed(0)}% of {usd(row.capUsd, 0)}
                        </span>
                      </div>
                      <Meter pct={row.capPct} color={capTone(row.capPct)} label={`${row.capPct.toFixed(0)}% of AI cap used`} />
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <div className="text-(--a-text)">{row.revenueUsd ? usd(row.revenueUsd, 0) : "—"}</div>
                      {row.revenueUsd ? (
                        <div className={cn("text-[11px]", row.marginUsd >= 0 ? "text-(--a-muted)" : "text-(--a-red)")}>
                          {usd(row.marginUsd, 0)} margin
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-(--a-text-2)">{relativeTime(row.lastActiveAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <FlagBadge key={flag} flag={flag} />
                        ))}
                      </div>
                    </td>
                    <td className="pr-4">
                      <ChevronRight aria-hidden className="size-4 text-(--a-muted) transition-all group-hover:translate-x-0.5 group-hover:text-(--a-teal)" />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-(--a-text-2)">No customers match these filters.</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-(--a-border) px-5 py-3 text-xs text-(--a-muted)">
        <span>
          Showing {visible.length} of {filtered.length}
          {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
        </span>
        {filtered.length > limit ? (
          <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="rounded-lg px-3 py-1.5 text-(--a-teal) hover:bg-(--a-teal)/10">
            Show {Math.min(PAGE, filtered.length - limit)} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

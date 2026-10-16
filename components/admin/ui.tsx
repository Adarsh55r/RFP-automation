import { CheckCircle2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function CardHeader({
  title,
  description,
  icon: Icon,
  href,
  hrefLabel = "View all",
  tone = "var(--a-teal)",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  tone?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10"
            style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
          >
            <Icon aria-hidden className="size-4" style={{ color: tone }} />
          </span>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-(--a-text)">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-(--a-muted)">{description}</p> : null}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-(--a-teal) outline-none transition-colors hover:bg-(--a-teal)/10 focus-visible:ring-2 focus-visible:ring-(--a-teal)/60"
        >
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

export function AllClear({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <CheckCircle2 aria-hidden className="size-6 text-(--a-green)" />
      <p className="text-sm text-(--a-text-2)">{message}</p>
    </div>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-(--a-border-strong) bg-white/[0.03] px-2.5 py-1 text-xs text-(--a-text-2)",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Skeleton used by every admin loading.tsx. */
export function AdminSkeleton({ kpis = 4, table = false }: { kpis?: number; table?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="admin-shimmer mb-3 h-3 w-28" />
      <div className="admin-shimmer mb-8 h-9 w-72" />
      <div className={cn("grid gap-4", kpis >= 4 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3")}>
        {Array.from({ length: kpis }, (_, index) => (
          <div key={index} className="admin-card p-5" style={{ animationDelay: `${index * 80}ms` }}>
            <div className="admin-shimmer mb-5 h-3 w-24" />
            <div className="admin-shimmer h-8 w-32" />
          </div>
        ))}
      </div>
      {table ? (
        <div className="admin-card mt-6 space-y-3 p-5">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="admin-shimmer h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="admin-card p-5 lg:col-span-2">
            <div className="admin-shimmer h-72 w-full" />
          </div>
          <div className="admin-card p-5">
            <div className="admin-shimmer h-72 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  icon: LucideIcon;
  headline: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  headline,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-card border border-dashed border-border bg-surface-raised/70 px-8 py-16 text-center",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--glow)/0.12),transparent)]" />
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-on-brand shadow-[0_10px_30px_-10px_rgb(var(--glow)/0.7)] float-slow">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="relative mt-6 font-display text-xl font-semibold text-ink">{headline}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
        {description}
      </p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

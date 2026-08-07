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
        "flex flex-col items-center rounded-card border border-border bg-surface-raised px-8 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-card bg-surface text-brand">
        <Icon aria-hidden className="size-6" strokeWidth={1.75} />
      </div>
      <h2 className="mt-6 font-sans text-xl font-semibold text-ink">{headline}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate">
        {description}
      </p>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

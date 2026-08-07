import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const variants = {
  draft: "border-border bg-surface text-slate",
  submitted: "border-brand/20 bg-brand/10 text-brand",
  free: "border-border bg-surface-raised text-slate",
  success: "border-success/20 bg-success/10 text-success",
  danger: "border-danger/20 bg-danger/10 text-danger",
  accent: "border-accent/40 bg-accent/15 text-ink",
} as const;

export type BadgeVariant = keyof typeof variants;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "draft", className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex h-8 items-center rounded-control border px-2 font-mono text-xs font-medium tracking-wide uppercase",
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = "Badge";

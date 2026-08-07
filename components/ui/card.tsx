import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "interactive";
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className, ...props }, ref) => {
    const interactive = variant === "interactive";

    return (
      <div
        ref={ref}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          "rounded-card border border-border bg-surface-raised p-6",
          interactive &&
            "hover-lift cursor-pointer select-none outline-none",
          interactive && focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);

Card.displayName = "Card";

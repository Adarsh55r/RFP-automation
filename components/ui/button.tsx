import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing, focusRingDanger } from "@/lib/focus";

const variants = {
  primary:
    "btn-shine bg-brand-gradient text-on-brand shadow-[0_6px_20px_-6px_rgb(var(--glow)/0.55)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_rgb(var(--glow)/0.7)] active:translate-y-0",
  accent:
    "btn-shine bg-accent text-[#1a1203] shadow-[0_6px_20px_-8px_rgb(240_160_31/0.6)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-8px_rgb(240_160_31/0.7)] active:translate-y-0",
  secondary:
    "border border-border bg-surface-raised/80 text-ink shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-brand/50 hover:text-brand active:translate-y-0",
  ghost:
    "bg-transparent text-ink hover:bg-surface-sunken hover:text-brand",
  danger:
    "bg-danger text-white shadow-[0_6px_20px_-8px_rgb(201_60_55/0.55)] hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 dark:text-[#2a0707]",
} as const;

const sizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      asChild = false,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-control font-sans font-semibold transition-[transform,box-shadow,color,border-color,background-color,filter] duration-200 ease-out",
          "disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none",
          variant === "danger" ? focusRingDanger : focusRing,
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

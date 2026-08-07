import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing, focusRingDanger } from "@/lib/focus";

const variants = {
  primary:
    "bg-brand text-surface-raised shadow-none hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.12)]",
  secondary:
    "border border-border bg-surface-raised text-ink hover:-translate-y-0.5 hover:border-brand",
  ghost:
    "bg-transparent text-ink hover:-translate-y-0.5 hover:text-brand",
  danger:
    "bg-danger text-surface-raised hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.12)]",
} as const;

const sizes = {
  sm: "h-8 px-4 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
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
          "inline-flex items-center justify-center gap-2 rounded-control font-sans font-semibold transition-[transform,box-shadow,color,border-color,background-color] duration-hover ease-out",
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

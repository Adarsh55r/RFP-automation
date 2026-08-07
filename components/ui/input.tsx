import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-10 w-full rounded-control border border-border bg-surface-raised px-4 font-sans text-sm text-ink",
          "placeholder:text-slate",
          "transition-[border-color,box-shadow] duration-hover ease-out",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger",
          focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

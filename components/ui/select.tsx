import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none rounded-control border border-border bg-surface-raised px-4 pr-10 font-sans text-sm text-ink",
            "transition-[border-color,box-shadow] duration-hover ease-out hover:border-brand/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-[invalid=true]:border-danger",
            focusRing,
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-slate"
          strokeWidth={1.75}
        />
      </div>
    );
  },
);

Select.displayName = "Select";

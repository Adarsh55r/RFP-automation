import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-32 w-full resize-y rounded-control border border-border bg-surface-raised px-4 py-2 font-sans text-sm leading-relaxed text-ink",
          "placeholder:text-slate",
          "transition-[border-color,box-shadow] duration-hover ease-out hover:border-brand/60",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
          "aria-[invalid=true]:border-danger",
          focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

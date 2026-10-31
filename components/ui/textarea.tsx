import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { fieldFocus } from "@/lib/focus";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-32 w-full resize-y rounded-control border border-border bg-surface-raised px-4 py-3 font-sans text-sm leading-relaxed text-ink shadow-sm",
          "placeholder:text-slate/70",
          "transition-[border-color,box-shadow] duration-200 ease-out hover:border-brand/50",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
          "aria-[invalid=true]:border-danger",
          fieldFocus,
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

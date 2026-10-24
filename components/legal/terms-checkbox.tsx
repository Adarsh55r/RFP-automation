"use client";

import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const link = "font-semibold text-brand underline underline-offset-4";

/** The explicit "I agree" box used at onboarding and when the Terms change. */
export function TermsCheckbox({
  checked,
  onChange,
  id = "accept-terms",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={cn("mt-1 size-4 shrink-0 accent-brand", focusRing)}
      />
      <label htmlFor={id} className="text-sm leading-relaxed text-slate">
        I agree to the{" "}
        <a className={link} href="/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>{" "}
        and the{" "}
        <a className={link} href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        , on behalf of my company.
      </label>
    </div>
  );
}

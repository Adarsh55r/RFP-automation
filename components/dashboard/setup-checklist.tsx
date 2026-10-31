import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import type { SetupStep } from "@/lib/library-readiness";

/** Getting-started checklist with a progress meter; hidden once every step is done. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const percent = Math.round((done / steps.length) * 100);
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Getting started</p>
          <h2 className="mt-2 font-display text-lg font-semibold text-ink">Give your drafts real material</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate">
            Drafts are written only from your library. The more of it you fill in, the fewer gaps you fill later.
          </p>
        </div>
        <p className="font-mono text-xs text-slate">
          {done} of {steps.length} done
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn("flex items-start gap-3 rounded-control p-2 hover:bg-surface-sunken", focusRing)}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-slate" aria-hidden />
              )}
              <span>
                <span className={cn("block text-sm font-medium", step.done ? "text-slate line-through" : "text-ink")}>
                  {step.label}
                  <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
                </span>
                {!step.done ? <span className="block text-xs text-slate">{step.hint}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export type ProgressStep = {
  id: string;
  label: string;
  /** Extra detail for the step, such as the section being written. */
  detail?: string;
  state: "done" | "active" | "pending";
};

/** A ring that sweeps round a softly pulsing core, in the brand colours. */
export function Spinner({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <span className={cn("relative inline-flex size-14 items-center justify-center", className)} aria-hidden>
      <span className="absolute inset-0 rounded-full border-[3px] border-brand/12" />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent 0deg, #0f6e5b 300deg, #e8a33d 360deg)",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
      />
      <motion.span
        className="size-3 rounded-full bg-brand"
        animate={reduceMotion ? undefined : { scale: [1, 1.45, 1], opacity: [0.9, 0.45, 0.9] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      />
    </span>
  );
}

function useElapsedSeconds(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * Live progress for a long AI task: the step running now, with a spinner, and
 * every step's state underneath. Steps come from the server's own events, so
 * the screen shows what is actually happening, not a timer.
 */
export function ProgressPanel({
  eyebrow,
  steps,
  startedAt,
  hint,
}: {
  eyebrow: string;
  steps: ProgressStep[];
  startedAt: number;
  hint?: string;
}) {
  const reduceMotion = useReducedMotion();
  const elapsed = useElapsedSeconds(startedAt);
  const active = steps.find((step) => step.state === "active") ?? steps.findLast((step) => step.state === "done");
  const done = steps.filter((step) => step.state === "done").length;
  const percent = Math.round(((done + (steps.some((step) => step.state === "active") ? 0.5 : 0)) / Math.max(steps.length, 1)) * 100);

  return (
    <Card className="relative flex flex-col gap-6 overflow-hidden" aria-busy="true">
      <div className="flex items-center gap-5">
        <Spinner />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            {eyebrow} · {elapsed}s
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${active?.id}:${active?.detail ?? ""}`}
              className="mt-1 font-sans text-base font-semibold text-ink"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {active?.label ?? "Starting…"}
              {active?.detail ? <span className="font-normal text-slate"> · {active.detail}</span> : null}
            </motion.p>
          </AnimatePresence>
          {hint ? <p className="mt-1 text-sm text-slate">{hint}</p> : null}
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                step.state === "done" && "border-success bg-success text-surface-raised",
                step.state === "active" && "border-brand bg-brand/10",
                step.state === "pending" && "border-border bg-surface",
              )}
              aria-hidden
            >
              {step.state === "done" ? (
                <motion.span initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 18 }}>
                  <Check className="size-3.5" strokeWidth={3} />
                </motion.span>
              ) : step.state === "active" ? (
                <motion.span
                  className="size-2 rounded-full bg-brand"
                  animate={reduceMotion ? undefined : { scale: [1, 1.6, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              ) : null}
            </span>
            <span className={cn(step.state === "pending" ? "text-slate" : "text-ink", step.state === "active" && "font-semibold")}>
              {step.label}
              {step.detail && step.state !== "pending" ? <span className="font-normal text-slate"> · {step.detail}</span> : null}
              <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "active" ? " (in progress)" : ""}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-brand/10" aria-hidden>
        <motion.div
          className="h-full bg-[linear-gradient(90deg,#0f6e5b,#e8a33d)]"
          animate={{ width: `${Math.min(percent, 98)}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
        />
      </div>
    </Card>
  );
}

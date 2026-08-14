"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type Phase = "messy" | "shuffle" | "settled" | "ready";

const messyFrames = [
  { x: -18, y: 10, rotate: -7, z: 1 },
  { x: 16, y: -8, rotate: 6, z: 2 },
  { x: -8, y: 14, rotate: -3, z: 3 },
] as const;

const shuffleFrames = [
  { x: 14, y: -12, rotate: 9, z: 3 },
  { x: -16, y: 12, rotate: -10, z: 1 },
  { x: 8, y: 14, rotate: 5, z: 2 },
] as const;

function MiniDoc({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised p-3 shadow-[0_8px_20px_rgb(11_31_51_/_0.08)]",
        className,
      )}
    >
      <p className="font-mono text-[9px] tracking-wide text-slate uppercase">
        {label}
      </p>
      <div className="mt-3 space-y-1.5">
        <span className="block h-1.5 w-16 bg-slate/25" />
        <span className="block h-1.5 w-12 bg-slate/15" />
        <span className="block h-1.5 w-14 bg-slate/20" />
      </div>
    </div>
  );
}

function CleanDoc({ ready }: { ready: boolean }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_12px_28px_rgb(11_31_51_/_0.12)]">
      <div className="h-1.5 bg-brand" />
      <div className="flex flex-1 flex-col p-3">
        <p className="font-mono text-[9px] tracking-wide text-slate">
          PROPOSAL · DOCX
        </p>
        <p className="mt-2 font-sans text-xs font-semibold text-ink">
          Technical &amp; commercial proposal
        </p>
        <div className="mt-3 space-y-1.5">
          <span className="block h-1.5 w-full bg-border" />
          <span className="block h-1.5 w-4/5 bg-border" />
          <span className="block h-1.5 w-3/5 bg-border" />
        </div>
        <div className="mt-auto pt-3">
          {ready ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-success uppercase">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Download ready
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wide text-accent uppercase">
              Assembling…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExportDocumentMoment({
  mode,
}: {
  mode: "generating" | "ready";
}) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(
    reduceMotion || mode === "ready" ? "ready" : "messy",
  );

  useEffect(() => {
    if (mode === "ready") {
      setPhase("ready");
      return;
    }

    if (reduceMotion) {
      setPhase("settled");
      return;
    }

    setPhase("messy");
    const timers = [
      window.setTimeout(() => setPhase("shuffle"), 700),
      window.setTimeout(() => setPhase("settled"), 1400),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [mode, reduceMotion]);

  const settled = phase === "settled" || phase === "ready";
  const ready = phase === "ready" || mode === "ready";

  return (
    <div className="relative mx-auto h-[180px] w-full max-w-[200px]" aria-hidden>
      {(["Draft A", "Notes", "Outline"] as const).map((label, index) => {
        const frame =
          phase === "shuffle" ? shuffleFrames[index] : messyFrames[index];
        return (
          <div
            key={label}
            className="absolute top-4 left-1/2 h-[140px] w-[120px] -translate-x-1/2"
          >
            <motion.div
              className="h-full w-full"
              initial={false}
              animate={{
                x: settled ? 0 : frame.x,
                y: settled ? 6 : frame.y,
                rotate: settled ? 0 : frame.rotate,
                opacity: settled ? 0 : 1,
                scale: settled ? 0.94 : 1,
                zIndex: frame.z,
              }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <MiniDoc label={label} />
            </motion.div>
          </div>
        );
      })}

      <div className="absolute top-4 left-1/2 h-[140px] w-[120px] -translate-x-1/2">
        <motion.div
          className="h-full w-full rounded-card"
          initial={false}
          animate={{
            opacity: settled ? 1 : 0,
            scale: settled ? 1 : 0.96,
            y: settled ? 0 : 10,
            zIndex: 10,
            boxShadow: settled
              ? "0 0 0 1px var(--accent), 0 0 32px color-mix(in srgb, var(--accent) 36%, transparent)"
              : "0 0 0 0 transparent",
          }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <CleanDoc ready={ready} />
        </motion.div>
      </div>
    </div>
  );
}

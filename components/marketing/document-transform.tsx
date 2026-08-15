"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

type Phase = "messy" | "shuffle" | "settled";

const messyFrames = [
  { x: -28, y: 18, rotate: -8, z: 1 },
  { x: 30, y: -10, rotate: 7, z: 2 },
  { x: -10, y: 28, rotate: -3, z: 3 },
  { x: 16, y: 10, rotate: 5, z: 4 },
] as const;

const shuffleFrames = [
  { x: 22, y: -18, rotate: 11, z: 3 },
  { x: -26, y: 22, rotate: -12, z: 1 },
  { x: 14, y: 26, rotate: 8, z: 2 },
  { x: -14, y: -14, rotate: -7, z: 4 },
] as const;

function MessyDoc({
  title,
  meta,
  lines,
  className,
}: {
  title: string;
  meta: string;
  lines: readonly string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised p-4 shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]",
        className,
      )}
    >
      <p className="font-mono text-[10px] tracking-wide text-danger uppercase">
        {title}
      </p>
      <p className="mt-2 font-mono text-[10px] text-slate">{meta}</p>
      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <p
            key={line}
            className={cn(
              "text-[11px] leading-snug text-ink",
              index % 2 === 0 ? "font-mono" : "font-sans",
              index === 1 && "ml-4",
              index === 3 && "-ml-1",
            )}
          >
            {line}
          </p>
        ))}
      </div>
      <div className="mt-auto flex gap-2 pt-4">
        <span className="h-2 w-16 bg-slate/25" />
        <span className="h-2 w-10 bg-slate/15" />
      </div>
    </div>
  );
}

function CleanProposal() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-[0_16px_40px_rgb(11_31_51_/_0.12)]">
      <div className="h-2 bg-brand" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-wide text-slate">
              NORTHSTAR RETAIL
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-wide text-slate">
              RFP-2026-0441
            </p>
          </div>
          <span className="size-8 shrink-0 rounded-full bg-brand/15 ring-2 ring-brand/20" />
        </div>
        <p className="mt-4 font-sans text-sm font-semibold text-ink">
          Technical &amp; commercial proposal
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate">
          Cloud migration &amp; AMS · 24 months · Bengaluru / remote
        </p>
        <ul className="mt-4 space-y-2">
          {[
            "Understanding of scope",
            "Three relevant case studies",
            "Named team & CVs",
            "Commercials on your rate card",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-[11px] leading-relaxed text-ink"
            >
              <Check
                aria-hidden
                className="size-4 shrink-0 text-accent"
                strokeWidth={2.25}
              />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <div className="mb-4 h-2 overflow-hidden rounded-control bg-border">
            <div className="h-full w-[92%] bg-brand" />
          </div>
          <Badge variant="accent">Ready to send</Badge>
        </div>
      </div>
    </div>
  );
}

const messyDocs = [
  {
    title: "Corrigendum 3 / Annex C",
    meta: "pg 14 of 67  ·  scanned PDF",
    lines: [
      "12.4.2 bidder shall furnish ISO / SOC evidence",
      "leave blank if N/A — do not delete row",
      "evaluation: tech 70  comm 30 ???",
      "see email thread 18/Mar (missing)",
    ],
  },
  {
    title: "Security questionnaire",
    meta: "xlsx exported to pdf  ·  41 qs",
    lines: [
      "Q41. Describe your SOC 2 Type II…",
      "Q42. Data residency — IN / SG / EU",
      "Attach: VAPT | policy index | DPA",
      "due Friday  17:00  IST  —",
    ],
  },
  {
    title: "Vendor empanelment",
    meta: "Part B commercials  ·  pg 22",
    lines: [
      "rate card in INR, exclusive of GST",
      "onshore / offshore split mandatory",
      "staff-aug vs fixed bid — both?",
      "signatory: director only",
    ],
  },
  {
    title: "Agency pitch pack",
    meta: "slides + word dump  ·  28 pp",
    lines: [
      "why us / logos / 3 case studies min.",
      "named PM + architect CVs",
      "transition plan week 0–6",
      "do not include public-sector refs",
    ],
  },
] as const;

export function DocumentTransform() {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduceMotion ? "settled" : "messy");

  useEffect(() => {
    if (reduceMotion) {
      setPhase("settled");
      return;
    }

    const sequence: { phase: Phase; ms: number }[] = [
      { phase: "messy", ms: 1100 },
      { phase: "shuffle", ms: 700 },
      { phase: "settled", ms: 1800 },
    ];

    let index = 0;
    let timer = 0;

    const tick = () => {
      const step = sequence[index];
      setPhase(step.phase);
      timer = window.setTimeout(() => {
        index = (index + 1) % sequence.length;
        tick();
      }, step.ms);
    };

    tick();
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  const settled = phase === "settled";

  return (
    <div
      className="relative mx-auto h-[400px] w-full max-w-[320px] sm:h-[440px] sm:max-w-[360px]"
      aria-hidden
    >
      {messyDocs.map((doc, index) => {
        const frame =
          phase === "shuffle" ? shuffleFrames[index] : messyFrames[index];

        return (
          <div
            key={doc.title}
            className="absolute top-10 left-1/2 h-[300px] w-[240px] -translate-x-1/2 sm:h-[340px] sm:w-[270px]"
          >
            <motion.div
              className="h-full w-full"
              initial={false}
              animate={{
                x: settled ? 0 : frame.x,
                y: settled ? 8 : frame.y,
                rotate: settled ? 0 : frame.rotate,
                opacity: settled ? 0 : 1,
                scale: settled ? 0.94 : 1,
                zIndex: frame.z,
              }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <MessyDoc {...doc} />
            </motion.div>
          </div>
        );
      })}

      <div className="absolute top-10 left-1/2 h-[300px] w-[240px] -translate-x-1/2 sm:h-[340px] sm:w-[270px]">
        <motion.div
          className="h-full w-full rounded-card"
          initial={false}
          animate={{
            opacity: settled ? 1 : 0,
            scale: settled ? 1 : 0.96,
            y: settled ? 0 : 12,
            zIndex: 10,
            boxShadow: settled
              ? "0 0 0 1px var(--accent), 0 0 48px color-mix(in srgb, var(--accent) 40%, transparent), 0 16px 40px color-mix(in srgb, var(--brand) 28%, transparent)"
              : "0 0 0 0 transparent",
          }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <CleanProposal />
        </motion.div>
      </div>
    </div>
  );
}

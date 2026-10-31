"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileDown, Library, ListChecks, Upload } from "lucide-react";
import { Section } from "@/components/marketing/section";

const steps = [
  {
    icon: Upload,
    title: "Upload the RFP",
    body: "Drop in an RFP, tender or questionnaire as a PDF, Word, Excel or CSV file, or a scan. Add addenda as they arrive and see what changed.",
  },
  {
    icon: ListChecks,
    title: "Check every requirement",
    body: "Mandatory items, scoring weights, deadlines, page limits, and required forms land in one checklist you confirm before a word is written.",
  },
  {
    icon: Library,
    title: "Get a first draft",
    body: "Cover letter, executive summary, approach, team, pricing, and question-by-question answers, written from your past work. Each claim shows its source; anything unsupported is marked for you to fill.",
  },
  {
    icon: FileDown,
    title: "Review, fill gaps, submit",
    body: "Fill the highlighted gaps, revise any section with one click, check it yourself, and export a formatted Word or PDF file.",
  },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <Section id="how-it-works">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">
        How it works
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        From RFP to ready-to-send proposal in four steps.
      </h2>
      <motion.ol
        className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8"
        initial={reduceMotion ? "show" : "hidden"}
        whileInView="show"
        viewport={{ once: true, amount: 0.35 }}
        variants={{
          hidden: {},
          show: {
            transition: reduceMotion ? undefined : { staggerChildren: 0.12 },
          },
        }}
      >
        <div
          aria-hidden
          className="absolute top-6 right-6 left-6 hidden h-px bg-[linear-gradient(90deg,transparent,rgb(var(--glow)/0.6),transparent)] lg:block"
        />
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.title}
              className="relative"
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.45, ease: "easeOut" },
                },
              }}
            >
              <div className="relative z-10 flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-on-brand shadow-[0_10px_26px_-10px_rgb(var(--glow)/0.85)] ring-4 ring-surface">
                <Icon aria-hidden className="size-5" strokeWidth={1.9} />
              </div>
              <p className="mt-6 font-mono text-xs tracking-[0.16em] text-brand">
                STEP 0{index + 1}
              </p>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{step.body}</p>
            </motion.li>
          );
        })}
      </motion.ol>
    </Section>
  );
}

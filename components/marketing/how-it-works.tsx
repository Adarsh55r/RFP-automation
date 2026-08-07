"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileDown, Library, ListChecks, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";

const steps = [
  {
    icon: Upload,
    title: "Upload",
    body: "Drop in the RFP as PDF or Word. Scanned pages, corrigenda, and questionnaire exports are expected — not a special case.",
  },
  {
    icon: ListChecks,
    title: "Extract",
    body: "Requirements, deadlines, evaluation weightage, and questionnaire rows land in a checklist. You edit or drop anything it misread before drafting starts.",
  },
  {
    icon: Library,
    title: "Draft from your library",
    body: "Answers cite your case studies, CVs, and stack write-ups. Nothing is invented to look complete. You choose what gets referenced.",
  },
  {
    icon: FileDown,
    title: "Export",
    body: "Download a Word file with your section order and, on paid plans, your letterhead. Send it as your agency’s document.",
  },
] as const;

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <Section id="how-it-works">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">
        How it works
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        Four steps from inbox PDF to a proposal you can send.
      </h2>
      <motion.ol
        className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
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
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.title}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.45, ease: "easeOut" },
                },
              }}
            >
              <Card className="h-full">
              <div className="flex items-center justify-between gap-4">
                <div className="flex size-10 items-center justify-center rounded-control bg-surface text-brand">
                  <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                </div>
                <span className="font-mono text-xs tracking-wide text-slate">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-6 font-sans text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{step.body}</p>
              </Card>
            </motion.li>
          );
        })}
      </motion.ol>
    </Section>
  );
}

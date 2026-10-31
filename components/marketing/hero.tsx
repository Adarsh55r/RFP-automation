"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentTransform } from "@/components/marketing/document-transform";
import { HeroAtmosphere } from "@/components/marketing/hero-atmosphere";

const trust = ["Free trial", "No credit card", "PDF, Word, Excel and scanned RFPs"];

export function Hero() {
  const reduceMotion = useReducedMotion();
  // Always animate to visible: the server draws these faded out, so with reduced
  // motion they must still be told to show (at once, with no movement).
  const rise = (delay: number) => ({
    initial: reduceMotion ? (false as const) : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] as const },
  });

  return (
    <section className="relative -mt-[68px] overflow-hidden pt-[68px]">
      <HeroAtmosphere />
      <div className="relative mx-auto grid max-w-content items-center gap-14 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:gap-12 md:px-8 md:py-24">
        <div>
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-surface-raised/70 px-3 py-1.5 font-mono text-[11px] tracking-[0.14em] text-brand uppercase shadow-sm backdrop-blur"
          >
            <Sparkles className="size-3.5" aria-hidden />
            RFP response software for small businesses
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl md:text-[3.4rem] md:leading-[1.08]"
          >
            Turn any RFP and your company portfolio into a <span className="text-gradient">compliant first draft</span>.
          </motion.h1>
          <motion.p {...rise(0.16)} className="mt-6 max-w-xl text-base leading-relaxed text-slate sm:text-lg">
            DraftBid AI reads the full RFP and addenda, builds your compliance checklist, and drafts your response from
            your past proposals, case studies and résumés, flagging anything it can&apos;t support. You review, then
            export a formatted Word file.
          </motion.p>
          <motion.div {...rise(0.24)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="group">
              <Link href="/sign-up?plan=free">
                Draft your first proposal free
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/tools/rfp-checklist">Try the free RFP checklist</Link>
            </Button>
          </motion.div>
          <motion.ul {...rise(0.32)} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate">
            {trust.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-brand" aria-hidden />
                {item}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          className="relative"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div aria-hidden className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(closest-side,rgb(var(--glow)/0.28),transparent)] blur-2xl" />
          <p className="sr-only">
            Illustrative example: a stack of messy RFP pages settles into one clean, formatted proposal.
          </p>
          <div className="relative float-slow">
            <DocumentTransform />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentTransform } from "@/components/marketing/document-transform";
import { HeroAtmosphere } from "@/components/marketing/hero-atmosphere";
import { SmoothLink } from "@/components/marketing/smooth-link";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-surface">
      <HeroAtmosphere />
      <div className="relative mx-auto grid max-w-content items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            AI proposal software for small businesses
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl md:text-6xl md:leading-[1.15]">
            Win more RFPs — without a bid team.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate sm:text-lg">
            Upload any RFP and get a compliant first draft in minutes — written
            from your own past work, checked against every requirement, with
            every gap flagged for you. Review it, fill in the blanks, and export
            a polished Word or PDF proposal.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent">
              <Link href="/sign-up?plan=free">Draft my first proposal free</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <SmoothLink href="/#how-it-works">See how it works</SmoothLink>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate">
            Free plan · No credit card · Works with PDF and Word RFPs
          </p>
        </motion.div>

        <div className="relative">
          <p className="sr-only">
            A stack of messy RFP pages settles into one clean, branded proposal.
          </p>
          <DocumentTransform />
        </div>
      </div>
    </section>
  );
}

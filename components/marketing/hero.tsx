"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentTransform } from "@/components/marketing/document-transform";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="overflow-hidden bg-surface">
      <div className="mx-auto grid max-w-content items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            For Indian IT services agencies
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl md:text-6xl md:leading-[1.15]">
            Turn RFPs into proposals your agency actually wins.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate sm:text-lg">
            DraftWin drafts responses to the private-sector packs your clients
            send: vendor empanelment, security questionnaires, and agency pitch
            decks. It is not a GeM or government-tender tool. Upload the file,
            edit the extracted requirements, pull proof from your own case
            studies and bios, and export a Word proposal on your letterhead.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/sign-up?plan=free">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs tracking-wide text-slate">
            Free plan · ₹0 · 1 proposal / month
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

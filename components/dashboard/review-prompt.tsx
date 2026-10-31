"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageSquareText, Star, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { claimReviewPrompt, respondToReviewPrompt } from "@/lib/actions/review";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import { EXPORTED_EVENT, type ReviewResponse } from "@/lib/review-prompt";

type Prompt = { reviewUrl: string; feedbackEmail: string | null };

/** Lets the export's own "download ready" moment land before the card appears. */
const SHOW_DELAY_MS = 1800;

/**
 * Asks for a public review after an export. Every user sees the same choices,
 * whatever their experience (no "rate us first" gating), and unhappy users get
 * an equally visible private-feedback route.
 */
export function ReviewPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const reduceMotion = useReducedMotion();
  const headingId = "review-prompt-title";
  const primaryRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onExported = () => {
      void claimReviewPrompt()
        .then((result) => {
          if (!result.show) return;
          timer = window.setTimeout(() => setPrompt(result), SHOW_DELAY_MS);
        })
        .catch(() => undefined);
    };
    window.addEventListener(EXPORTED_EVENT, onExported);
    return () => {
      window.removeEventListener(EXPORTED_EVENT, onExported);
      window.clearTimeout(timer);
    };
  }, []);

  const close = useCallback((response: ReviewResponse) => {
    setPrompt(null);
    void respondToReviewPrompt(response).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!prompt) return;
    primaryRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close("later");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, close]);

  return (
    <AnimatePresence>
      {prompt ? (
        <motion.aside
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-x-4 bottom-4 z-50 rounded-card border border-border bg-surface-raised p-5 shadow-[var(--shadow-lg)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
        >
          <button
            type="button"
            onClick={() => close("later")}
            aria-label="Close"
            className={cn(
              "absolute top-3 right-3 rounded-control p-1.5 text-slate transition-colors hover:bg-surface-sunken hover:text-ink",
              focusRing,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>

          <div className="flex gap-1 text-accent" aria-hidden>
            {[0, 1, 2, 3, 4].map((index) => (
              <motion.span
                key={index}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.06 }}
              >
                <Star className="size-4 fill-current" />
              </motion.span>
            ))}
          </div>

          <h2 id={headingId} className="mt-3 pr-6 font-sans text-base font-semibold text-ink">
            Your proposal is ready
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">
            Would you share an honest two-line review of DraftBid AI? It takes about two minutes and
            really helps a small team.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <a
              ref={primaryRef}
              href={prompt.reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => close("reviewed")}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-control bg-brand px-4 text-sm font-semibold text-on-brand transition-[transform,box-shadow] duration-hover hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]",
                focusRing,
              )}
            >
              <Star aria-hidden className="size-4" />
              Leave a review
            </a>
            {prompt.feedbackEmail ? (
              <a
                href={`mailto:${prompt.feedbackEmail}?subject=${encodeURIComponent("DraftBid AI feedback")}`}
                onClick={() => close("feedback")}
                className={cn(
                  "inline-flex h-10 items-center justify-center gap-2 rounded-control border border-border bg-surface-raised px-4 text-sm font-semibold text-ink transition-[transform,border-color] duration-hover hover:-translate-y-0.5 hover:border-brand",
                  focusRing,
                )}
              >
                <MessageSquareText aria-hidden className="size-4" />
                Send private feedback
              </a>
            ) : null}
          </div>

          <div className="mt-3 flex justify-between text-xs">
            <button
              type="button"
              onClick={() => close("later")}
              className={cn("rounded px-1 py-0.5 text-slate hover:text-ink", focusRing)}
            >
              Maybe later
            </button>
            <button
              type="button"
              onClick={() => close("declined")}
              className={cn("rounded px-1 py-0.5 text-slate hover:text-ink", focusRing)}
            >
              Don&apos;t ask again
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

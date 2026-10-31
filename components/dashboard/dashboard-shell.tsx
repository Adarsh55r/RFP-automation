"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { ReviewPrompt } from "@/components/dashboard/review-prompt";

type DashboardShellProps = {
  agencyName: string;
  allowance?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ agencyName, allowance, children }: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  return (
    <div className="relative flex min-h-screen bg-surface">
      {/* Slow-moving colour behind the whole workspace, and a faint grid at the top. */}
      <div className="aurora" aria-hidden>
        <span />
      </div>
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]" />

      {/* Pinned to the screen at full height, so only the page content beside it scrolls. */}
      <div className="sticky top-0 z-20 hidden h-dvh shrink-0 md:block">
        <DashboardSidebar />
      </div>

      <AnimatePresence>
        {navOpen ? (
          <div className="fixed inset-0 z-50 md:hidden" role="presentation">
            <motion.button
              type="button"
              className="absolute inset-0 bg-brand-dark/50 backdrop-blur-[2px] focus-visible:outline-none"
              aria-label="Close navigation menu"
              onClick={() => setNavOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative h-full w-72 max-w-[85vw] shadow-[var(--shadow-lg)]"
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <DashboardSidebar onNavigate={() => setNavOpen(false)} className="w-full bg-surface-raised" layoutId="sidebar-active-mobile" />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <DashboardTopbar agencyName={agencyName} allowance={allowance} onOpenNav={() => setNavOpen(true)} />
        <main id="main-content" className="flex-1 px-4 py-8 md:px-8 md:py-10">
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      <ReviewPrompt />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { ReviewPrompt } from "@/components/dashboard/review-prompt";
import { cn } from "@/lib/cn";

type DashboardShellProps = {
  agencyName: string;
  allowance?: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardShell({ agencyName, allowance, children }: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);

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
    <div className="flex min-h-screen bg-surface">
      {/* Pinned to the screen at full height, so only the page content beside it scrolls. */}
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <DashboardSidebar />
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-dark/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-raised focus-visible:ring-inset"
            aria-label="Close navigation menu"
            onClick={() => setNavOpen(false)}
          />
          <div className="relative h-full w-64 shadow-[0_16px_48px_rgb(11_31_51_/_0.24)]">
            <DashboardSidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          agencyName={agencyName}
          allowance={allowance}
          onOpenNav={() => setNavOpen(true)}
        />
        <main
          id="main-content"
          className={cn("flex-1 bg-surface px-4 py-8 md:px-8")}
        >
          {children}
        </main>
      </div>
      <ReviewPrompt />
    </div>
  );
}

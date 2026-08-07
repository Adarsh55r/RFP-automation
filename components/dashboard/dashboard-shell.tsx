"use client";

import { useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { cn } from "@/lib/cn";

type DashboardShellProps = {
  agencyName: string;
  children: React.ReactNode;
};

export function DashboardShell({ agencyName, children }: DashboardShellProps) {
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
      <div className="hidden md:flex">
        <DashboardSidebar />
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-brand-dark/50"
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
          onOpenNav={() => setNavOpen(true)}
        />
        <main className={cn("flex-1 bg-surface px-4 py-8 md:px-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useClerkAppearance } from "@/components/theme/use-clerk-appearance";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

type DashboardTopbarProps = {
  agencyName: string;
  onOpenNav: () => void;
  /** Proposals-left badge, streamed from the server. */
  allowance?: React.ReactNode;
};

export function DashboardTopbar({ agencyName, onOpenNav, allowance }: DashboardTopbarProps) {
  const appearance = useClerkAppearance();
  const userButtonAppearance = {
    ...appearance,
    elements: {
      ...appearance.elements,
      userButtonPopoverCard: "rounded-card border border-border shadow-[var(--shadow-lg)]",
      userButtonPopoverActionButton: "rounded-control font-sans text-sm text-ink hover:bg-surface-sunken",
      userButtonPopoverActionButtonText: "font-sans text-sm text-ink",
      userButtonPopoverFooter: "hidden",
      avatarBox: "size-9 rounded-full ring-2 ring-brand/30",
    },
  };
  const initials = agencyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className={cn(
            "rounded-control p-2 text-ink transition-colors duration-hover ease-out hover:bg-surface-sunken hover:text-brand md:hidden",
            focusRing,
          )}
          aria-label="Open navigation menu"
          onClick={onOpenNav}
        >
          <Menu className="size-6" strokeWidth={1.75} aria-hidden />
        </button>
        <span
          aria-hidden
          className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient font-display text-xs font-semibold text-on-brand sm:inline-flex"
        >
          {initials || "D"}
        </span>
        <p className="truncate font-display text-sm font-semibold text-ink md:text-base">{agencyName}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {allowance}
        <ThemeToggle />
        {/* cn() does not merge classes, so the button's own display would beat "hidden": wrap instead. */}
        <span className="hidden sm:inline-flex">
          <Button asChild size="sm">
            <Link href="/dashboard/rfps/new">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
              New RFP
            </Link>
          </Button>
        </span>
        <span className="inline-flex sm:hidden">
          <Button asChild size="sm">
            <Link href="/dashboard/rfps/new" aria-label="New RFP">
              <Plus className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          </Button>
        </span>
        <UserButton appearance={userButtonAppearance} />
      </div>
    </header>
  );
}

"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const userButtonAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    userButtonPopoverCard: "rounded-card border border-border shadow-none",
    userButtonPopoverActionButton:
      "rounded-control font-sans text-sm text-ink hover:bg-surface",
    userButtonPopoverActionButtonText: "font-sans text-sm text-ink",
    userButtonPopoverFooter: "hidden",
    avatarBox: "size-10 rounded-full ring-2 ring-surface-raised/20",
  },
};

type DashboardTopbarProps = {
  agencyName: string;
  onOpenNav: () => void;
};

export function DashboardTopbar({ agencyName, onOpenNav }: DashboardTopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-raised px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          className={cn(
            "rounded-control p-2 text-ink transition-colors duration-hover ease-out hover:text-brand md:hidden",
            focusRing,
          )}
          aria-label="Open navigation menu"
          onClick={onOpenNav}
        >
          <Menu className="size-6" strokeWidth={1.75} aria-hidden />
        </button>
        <p className="truncate font-sans text-sm font-semibold text-ink md:text-base">
          {agencyName}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/dashboard/rfps/new">
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
            New RFP
          </Link>
        </Button>
        <Button asChild size="sm" className="sm:hidden">
          <Link href="/dashboard/rfps/new" aria-label="New RFP">
            <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          </Link>
        </Button>
        <UserButton appearance={userButtonAppearance} />
      </div>
    </header>
  );
}

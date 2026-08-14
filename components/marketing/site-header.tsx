"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/cn";
import { focusRingOnDark, textLinkOnDark } from "@/lib/focus";

const publicLinks = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  const { isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-brand-dark transition-shadow duration-hover ease-out",
        scrolled && "shadow-[0_8px_24px_rgb(11_31_51_/_0.28)]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-6 md:px-8">
        <Link
          href="/"
          className={cn(textLinkOnDark, "text-base tracking-tight")}
        >
          DraftWin
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-control px-4 py-2 text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                focusRingOnDark,
              )}
            >
              {link.label}
            </Link>
          ))}
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className={cn(
                  "rounded-control px-4 py-2 text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                  focusRingOnDark,
                )}
              >
                Dashboard
              </Link>
              <div className="ml-2">
                <UserButton appearance={clerkAppearance} />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={cn(
                  "rounded-control px-4 py-2 text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                  focusRingOnDark,
                )}
              >
                Log in
              </Link>
              <Button asChild className="ml-2">
                <Link href="/sign-up?plan=free">Start free</Link>
              </Button>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {isSignedIn ? (
            <UserButton appearance={clerkAppearance} />
          ) : (
            <Button asChild size="sm">
              <Link href="/sign-up?plan=free">Start free</Link>
            </Button>
          )}
          <button
            type="button"
            className={cn(
              "rounded-full p-2 text-surface-raised transition-colors duration-hover ease-out hover:text-accent",
              focusRingOnDark,
            )}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X className="size-6" strokeWidth={1.75} aria-hidden />
            ) : (
              <Menu className="size-6" strokeWidth={1.75} aria-hidden />
            )}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-surface-raised/10 px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-2">
            {publicLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "block rounded-control px-4 py-2 text-sm font-medium text-surface-raised/90 transition-colors duration-hover ease-out hover:text-surface-raised",
                    focusRingOnDark,
                  )}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isSignedIn ? (
              <li>
                <Link
                  href="/dashboard"
                  className={cn(
                    "block rounded-control px-4 py-2 text-sm font-medium text-surface-raised/90 transition-colors duration-hover ease-out hover:text-surface-raised",
                    focusRingOnDark,
                  )}
                  onClick={() => setOpen(false)}
                >
                  Dashboard
                </Link>
              </li>
            ) : (
              <li>
                <Link
                  href="/sign-in"
                  className={cn(
                    "block rounded-control px-4 py-2 text-sm font-medium text-surface-raised/90 transition-colors duration-hover ease-out hover:text-surface-raised",
                    focusRingOnDark,
                  )}
                  onClick={() => setOpen(false)}
                >
                  Log in
                </Link>
              </li>
            )}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

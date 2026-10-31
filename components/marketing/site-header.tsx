"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand";
import { SmoothLink } from "@/components/marketing/smooth-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useClerkAppearance } from "@/components/theme/use-clerk-appearance";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const publicLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#who-its-for", label: "Who it's for" },
  { href: "/#pricing", label: "Pricing" },
];

const navLink = cn(
  "rounded-full px-4 py-2 text-sm font-medium text-slate transition-colors duration-200 hover:bg-surface-sunken hover:text-ink",
  focusRing,
);

/** A floating, frosted header that tightens up once the page scrolls. */
export function SiteHeader() {
  const { isSignedIn } = useAuth();
  const appearance = useClerkAppearance();
  const reduceMotion = useReducedMotion();
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
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
      <div
        className={cn(
          "glass mx-auto max-w-content rounded-2xl border transition-all duration-300 ease-out",
          scrolled || open ? "border-border shadow-[var(--shadow-lg)]" : "border-transparent bg-transparent shadow-none",
        )}
      >
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-5">
          <SmoothLink href="/" className={cn("inline-flex rounded-control text-ink", focusRing)}>
            <Logo />
          </SmoothLink>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {publicLinks.map((link) => (
              <SmoothLink key={link.href} href={link.href} className={navLink}>
                {link.label}
              </SmoothLink>
            ))}
            {isSignedIn ? (
              <Link href="/dashboard" className={navLink}>
                Dashboard
              </Link>
            ) : (
              <Link href="/sign-in" className={navLink}>
                Log in
              </Link>
            )}
            <ThemeToggle className="ml-1" />
            {isSignedIn ? (
              <div className="ml-2">
                <UserButton appearance={appearance} />
              </div>
            ) : (
              <Button asChild size="sm" className="ml-2">
                <Link href="/sign-up?plan=free">Try it free</Link>
              </Button>
            )}
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            {isSignedIn ? (
              <UserButton appearance={appearance} />
            ) : (
              <Button asChild size="sm">
                <Link href="/sign-up?plan=free">Try it free</Link>
              </Button>
            )}
            <button
              type="button"
              className={cn("rounded-full p-2 text-ink transition-colors duration-200 hover:bg-surface-sunken", focusRing)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-6" strokeWidth={1.75} aria-hidden /> : <Menu className="size-6" strokeWidth={1.75} aria-hidden />}
              <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.nav
              id="mobile-nav"
              aria-label="Mobile"
              className="overflow-hidden border-t border-border md:hidden"
              initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <ul className="flex flex-col gap-1 p-3">
                {publicLinks.map((link) => (
                  <li key={link.href}>
                    <SmoothLink href={link.href} className={cn(navLink, "block rounded-control")} onClick={() => setOpen(false)}>
                      {link.label}
                    </SmoothLink>
                  </li>
                ))}
                <li>
                  <Link
                    href={isSignedIn ? "/dashboard" : "/sign-in"}
                    className={cn(navLink, "block rounded-control")}
                    onClick={() => setOpen(false)}
                  >
                    {isSignedIn ? "Dashboard" : "Log in"}
                  </Link>
                </li>
              </ul>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}

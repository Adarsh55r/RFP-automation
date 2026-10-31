"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand";
import { dashboardNavItems, isNavActive } from "@/components/dashboard/dashboard-nav";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

type DashboardSidebarProps = {
  onNavigate?: () => void;
  className?: string;
  /** Separate ids keep the desktop and mobile highlights from animating into each other. */
  layoutId?: string;
};

/** Secondary links below the main navigation: plans, the public site, legal. */
const footerLinks = [
  { href: "/pricing", label: "Pricing & plans" },
  { href: "/", label: "DraftBid AI website" },
  { href: "/privacy", label: "Privacy policy" },
];

export function DashboardSidebar({ onNavigate, className, layoutId = "sidebar-active" }: DashboardSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <aside
      className={cn(
        "glass flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border",
        className,
      )}
    >
      <div className="flex h-16 items-center px-6">
        <Link href="/dashboard" onClick={onNavigate} className={cn("inline-flex rounded-control text-ink", focusRing)}>
          <Logo />
        </Link>
      </div>

      <p className="px-7 pt-4 pb-2 font-mono text-[10px] tracking-[0.18em] text-slate uppercase">Workspace</p>
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-3">
        {dashboardNavItems.map((item) => {
          const active = isNavActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-control px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                focusRing,
                active ? "text-on-brand" : "text-slate hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {active ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-control bg-brand-gradient shadow-[0_8px_24px_-10px_rgb(var(--glow)/0.8)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                  aria-hidden
                />
              ) : null}
              <Icon
                aria-hidden
                className={cn(
                  "relative size-[18px] shrink-0 transition-transform duration-200",
                  !active && "group-hover:scale-110 group-hover:text-brand",
                )}
                strokeWidth={1.9}
              />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-card border border-border bg-surface-raised/60 p-2">
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "block rounded-control px-3 py-2 text-sm text-slate transition-colors duration-200 hover:bg-surface-sunken hover:text-ink",
              focusRing,
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

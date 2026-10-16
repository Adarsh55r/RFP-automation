"use client";

import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BellRing, Coins, CreditCard, LayoutDashboard, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/costs", label: "AI costs", icon: Coins },
  { href: "/admin/alerts", label: "Alerts", icon: BellRing },
];

function isActive(pathname: string, item: (typeof navItems)[number]) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavLinks({ pathname, alertCount, layoutId }: { pathname: string; alertCount: number; layoutId: string }) {
  return (
    <LayoutGroup id={layoutId}>
      {navItems.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-(--a-teal)/60",
              active ? "text-(--a-text)" : "text-(--a-text-2) hover:text-(--a-text)",
            )}
          >
            {active ? (
              <motion.span
                layoutId="admin-nav-pill"
                className="absolute inset-0 rounded-xl border border-(--a-teal)/25 bg-[linear-gradient(90deg,rgb(45_212_191/0.16),rgb(57_135_229/0.08))]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : (
              <span className="absolute inset-0 rounded-xl bg-white/0 transition-colors group-hover:bg-white/[0.04]" />
            )}
            <Icon
              aria-hidden
              className={cn(
                "relative size-4 transition-transform duration-300 group-hover:scale-110",
                active ? "text-(--a-teal)" : "text-(--a-muted) group-hover:text-(--a-text-2)",
              )}
            />
            <span className="relative">{item.label}</span>
            {item.href === "/admin/alerts" && alertCount > 0 ? (
              <span className="relative ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-(--a-red)/15 px-1.5 py-0.5 font-mono text-[11px] text-(--a-red) ring-1 ring-(--a-red)/30">
                {alertCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </LayoutGroup>
  );
}

function QuickSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/admin/customers?q=${encodeURIComponent(query)}` : "/admin/customers");
  };

  return (
    <form onSubmit={submit} role="search" className="group relative w-full max-w-sm">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--a-muted) transition-colors group-focus-within:text-(--a-teal)"
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Find a customer by email or company"
        aria-label="Find a customer"
        className="h-10 w-full rounded-xl border border-(--a-border) bg-white/[0.03] pl-9 pr-3 text-sm sm:pr-14 text-(--a-text) placeholder:text-(--a-muted) outline-none transition-all focus:border-(--a-teal)/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgb(45_212_191/0.08)]"
      />
      <kbd className="pointer-events-none absolute hidden sm:block right-3 top-1/2 -translate-y-1/2 rounded-md border border-(--a-border) px-1.5 py-0.5 font-mono text-[10px] text-(--a-muted)">
        ⌘K
      </kbd>
    </form>
  );
}

export function AdminShell({
  adminEmail,
  alertCount,
  children,
}: {
  adminEmail: string;
  alertCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <div className="admin-root font-sans">
      <div aria-hidden className="admin-aurora" />
      <div aria-hidden className="admin-grid" />

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-(--a-border) bg-(--a-bg)/60 px-4 py-5 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-2 px-2">
            <Link href="/admin" className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-(--a-teal)/60">
              <Logo />
            </Link>
            <span className="rounded-md border border-(--a-teal)/30 bg-(--a-teal)/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-(--a-teal)">
              Admin
            </span>
          </div>

          <nav aria-label="Admin" className="mt-8 flex flex-col gap-1">
            <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-(--a-muted)">Command center</p>
            <NavLinks pathname={pathname} alertCount={alertCount} layoutId="admin-desktop" />
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-xl border border-dashed border-(--a-border-strong) p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-(--a-text-2)">
                <CreditCard aria-hidden className="size-3.5 text-(--a-amber)" />
                Stripe not connected
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-(--a-muted)">
                Revenue is estimated from each plan&apos;s list price until billing goes live.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-(--a-text-2) outline-none transition-colors hover:bg-white/[0.04] hover:text-(--a-text) focus-visible:ring-2 focus-visible:ring-(--a-teal)/60"
            >
              <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" />
              Back to the app
            </Link>
            <div className="flex items-center gap-2 border-t border-(--a-border) px-3 pt-3">
              <span className="flex size-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2dd4bf,#3987e5)] text-[11px] font-semibold uppercase text-[#06121a]">
                {adminEmail.slice(0, 1)}
              </span>
              <span className="truncate text-xs text-(--a-muted)" title={adminEmail}>
                {adminEmail}
              </span>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-(--a-border) bg-(--a-bg)/70 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-4 px-4 sm:px-8">
              <div className="flex items-center gap-2 lg:hidden">
                <Logo />
              </div>
              <QuickSearch />
              <div className="ml-auto hidden items-center gap-2 text-xs text-(--a-text-2) sm:flex">
                <span className="admin-pulse" aria-hidden />
                Live data
              </div>
            </div>
            <nav aria-label="Admin" className="admin-scroll flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
              <NavLinks pathname={pathname} alertCount={alertCount} layoutId="admin-mobile" />
            </nav>
          </header>

          <motion.main
            id="main-content"
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-8"
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-(--a-teal)">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="admin-gradient-text">{title}</span>
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-(--a-text-2)">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

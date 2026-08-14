"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand";
import { dashboardNavItems, isNavActive } from "@/components/dashboard/dashboard-nav";
import { cn } from "@/lib/cn";
import { focusRingOnDark, textLinkOnDark } from "@/lib/focus";

type DashboardSidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export function DashboardSidebar({
  onNavigate,
  className,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col bg-brand-dark",
        className,
      )}
    >
      <div className="flex h-16 items-center border-b border-surface-raised/10 px-6">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(textLinkOnDark, "inline-flex")}
        >
          <Logo />
        </Link>
      </div>

      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-2 p-4">
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
                "flex items-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors duration-hover ease-out",
                focusRingOnDark,
                active
                  ? "bg-brand text-surface-raised"
                  : "text-surface-raised/75 hover:bg-surface-raised/10 hover:text-surface-raised",
              )}
            >
              <Icon aria-hidden className="size-6 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

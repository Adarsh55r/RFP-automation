import {
  CreditCard,
  FileText,
  LayoutDashboard,
  Library,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match child routes (e.g. /dashboard/rfps/123) */
  matchPrefix?: boolean;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/rfps",
    label: "RFPs",
    icon: FileText,
    matchPrefix: true,
  },
  {
    href: "/dashboard/library",
    label: "Content Library",
    icon: Library,
    matchPrefix: true,
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: CreditCard,
    matchPrefix: true,
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    matchPrefix: true,
  },
];

export function isNavActive(pathname: string, item: DashboardNavItem) {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (item.matchPrefix) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}

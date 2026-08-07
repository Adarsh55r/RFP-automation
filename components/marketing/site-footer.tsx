import Link from "next/link";
import { focusRingOnDark } from "@/lib/focus";
import { cn } from "@/lib/cn";

const links = [
  { href: "/#product", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/sign-in", label: "Log in" },
  { href: "/sign-up?plan=free", label: "Start free" },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="font-sans text-base font-semibold text-surface-raised">
            DraftWin
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-surface-raised/70">
            Proposals for private-sector RFPs. Built for IT services agencies in
            India.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "inline-flex rounded-control px-4 py-2 text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                  focusRingOnDark,
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-surface-raised/10">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-6 text-sm text-surface-raised/60 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-mono text-xs tracking-wide">
            © 2026 DraftWin
          </p>
          <p>Not affiliated with GeM or any tender portal.</p>
        </div>
      </div>
    </footer>
  );
}

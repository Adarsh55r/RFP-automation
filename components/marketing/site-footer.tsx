import Link from "next/link";
import { Logo } from "@/components/brand";
import { SmoothLink } from "@/components/marketing/smooth-link";
import { focusRingOnDark } from "@/lib/focus";
import { cn } from "@/lib/cn";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#product", label: "Product" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/sign-in", label: "Log in" },
  { href: "/sign-up?plan=free", label: "Start free" },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark">
      <div className="mx-auto flex max-w-content flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <SmoothLink href="/" className={cn(focusRingOnDark, "inline-flex rounded-control text-surface-raised")}>
            <Logo />
          </SmoothLink>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-surface-raised/70">
            Proposals for private-sector RFPs. Built for IT services agencies in
            India.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <SmoothLink
                href={link.href}
                className={cn(
                  "inline-flex rounded-control px-4 py-2 text-sm font-medium text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                  focusRingOnDark,
                )}
              >
                {link.label}
              </SmoothLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-surface-raised/10">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-6 py-6 text-sm text-surface-raised/60 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="font-mono text-xs tracking-wide text-surface-raised/80">
            © 2026 DraftWin
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/privacy"
              className={cn(
                "text-sm text-surface-raised/80 transition-colors duration-hover ease-out hover:text-surface-raised",
                focusRingOnDark,
              )}
            >
              Privacy policy
            </Link>
            <p className="text-surface-raised/80">
              Not affiliated with GeM or any tender portal.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

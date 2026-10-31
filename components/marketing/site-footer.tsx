import Link from "next/link";
import { Logo } from "@/components/brand";
import { SmoothLink } from "@/components/marketing/smooth-link";
import { focusRingOnDark } from "@/lib/focus";
import { cn } from "@/lib/cn";
import { COMPANY } from "@/lib/company";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#product", label: "Why DraftBid AI" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/sign-in", label: "Log in" },
  { href: "/sign-up?plan=free", label: "Try it free" },
];

/** Trust and legal pages, linked from every public page. */
const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/security", label: "Security" },
  { href: "/subprocessors", label: "Subprocessors" },
  { href: "/dpa", label: "DPA" },
  { href: "/about", label: "About" },
  { href: `mailto:${COMPANY.contactEmail}`, label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="marketing-dark-band relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--glow)/0.7),transparent)]" />
      <div className="mx-auto flex max-w-content flex-col gap-8 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <SmoothLink href="/" className={cn(focusRingOnDark, "inline-flex rounded-control text-white")}>
            <Logo />
          </SmoothLink>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
            Compliant first drafts of RFP responses, written from your own
            company documents.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.href}>
              <SmoothLink
                href={link.href}
                className={cn(
                  "inline-flex rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors duration-200 ease-out hover:bg-white/10 hover:text-white",
                  focusRingOnDark,
                )}
              >
                {link.label}
              </SmoothLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-content flex-col gap-4 px-6 py-6 text-sm text-white/60 md:px-8">
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm text-white/80 transition-colors duration-hover ease-out hover:text-white",
                  focusRingOnDark,
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-xs tracking-wide text-white/80">
              © 2026 {COMPANY.productName}
            </p>
            <p className="text-white/80">
              Not affiliated with any government procurement portal.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

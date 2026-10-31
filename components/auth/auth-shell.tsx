import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/cn";
import { focusRing, textLink } from "@/lib/focus";

/** The frame for sign-in, sign-up and onboarding: aurora backdrop, frosted header, centred content. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div className="aurora" aria-hidden>
        <span />
      </div>
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[480px]" />
      <header className="glass relative z-10 border-b border-border">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6 md:px-8">
          <Link href="/" className={cn("inline-flex rounded-control text-ink", focusRing)}>
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AuthFrame>
      <main id="main-content" className="mx-auto flex max-w-content flex-col items-center px-6 py-12 md:px-8 md:py-16">
        <div className="animate-fade-up mb-8 w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate">{subtitle}</p>
        </div>
        <div className="relative w-full max-w-md">
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(var(--glow)/0.18),transparent)] blur-2xl" />
          {children}
        </div>
        {footer ? <div className="mt-8 text-center text-sm text-slate">{footer}</div> : null}
        <p className="mt-8">
          <Link href="/" className={cn(textLink, "text-sm font-semibold")}>
            ← Back to home
          </Link>
        </p>
      </main>
    </AuthFrame>
  );
}

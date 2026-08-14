import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { textLink, textLinkOnDark } from "@/lib/focus";

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
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-content items-center px-6 md:px-8">
          <Link
            href="/"
            className={cn(textLinkOnDark, "text-base")}
          >
            DraftWin
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex max-w-content flex-col items-center px-6 py-12 md:px-8 md:py-16"
      >
        <div className="mb-8 w-full max-w-md text-center">
          <h1 className="font-display text-3xl font-medium text-ink md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate">{subtitle}</p>
        </div>
        <div className="w-full max-w-md">{children}</div>
        {footer ? (
          <div className="mt-8 text-center text-sm text-slate">{footer}</div>
        ) : null}
        <p className="mt-8">
          <Link href="/" className={cn(textLink, "text-sm font-semibold")}>
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}

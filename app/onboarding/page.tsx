import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { cn } from "@/lib/cn";
import { textLinkOnDark } from "@/lib/focus";

export const metadata: Metadata = {
  title: "Set up your agency",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
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
        className="mx-auto max-w-content px-6 py-12 md:px-8 md:py-16"
      >
        <OnboardingFlow />
      </main>
    </div>
  );
}

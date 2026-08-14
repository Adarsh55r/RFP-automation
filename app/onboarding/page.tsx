import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { Logo } from "@/components/brand";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { cn } from "@/lib/cn";
import { requireDashboardUser } from "@/lib/dashboard";
import { textLinkOnDark } from "@/lib/focus";
import { parsePlanId } from "@/lib/intended-plan";
import type { TeamSize } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: "Set up your agency",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const clerkUser = await currentUser();
  const dbUser = await requireDashboardUser();

  if (dbUser) {
    redirect("/dashboard");
  }

  const meta = clerkUser?.unsafeMetadata;
  if (meta?.onboardingCompleted) {
    const agencyName = String(meta.agencyName ?? "").trim();
    const teamSize = String(meta.teamSize ?? "") as TeamSize;
    const intendedPlan = parsePlanId(String(meta.intendedPlan ?? ""));
    let healed: Awaited<ReturnType<typeof completeOnboarding>>;
    try {
      healed = await completeOnboarding({
        agencyName,
        teamSize,
        intendedPlan,
      });
    } catch {
      healed = {
        ok: false as const,
        error: "Could not save your workspace. Complete the form below.",
      };
    }
    if (healed.ok) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-content items-center px-6 md:px-8">
          <Link href="/" className={cn(textLinkOnDark, "inline-flex")}>
            <Logo />
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

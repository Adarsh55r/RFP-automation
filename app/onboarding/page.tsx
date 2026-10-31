import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-shell";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { saveOnboarding } from "@/lib/onboarding-store";
import { requireDashboardUser } from "@/lib/dashboard";
import { parsePlanId } from "@/lib/intended-plan";
import type { TeamSize } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: "Set up your company",
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
    let healed: Awaited<ReturnType<typeof saveOnboarding>>;
    try {
      // Repairing a workspace is not consent: the dashboard asks for Terms acceptance next.
      healed = await saveOnboarding({ agencyName, teamSize, intendedPlan }, false);
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
    <AuthFrame>
      <main id="main-content" className="mx-auto max-w-content px-6 py-12 md:px-8 md:py-16">
        <OnboardingFlow />
      </main>
    </AuthFrame>
  );
}

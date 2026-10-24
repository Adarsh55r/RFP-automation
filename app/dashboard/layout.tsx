import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AcceptTermsGate } from "@/components/dashboard/accept-terms-gate";
import { AllowanceBadge } from "@/components/dashboard/allowance-badge";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireDashboardUser } from "@/lib/dashboard";
import { TERMS_VERSION } from "@/lib/legal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const dbUser = await requireDashboardUser();
  if (!dbUser) {
    redirect("/onboarding");
  }

  return (
    <DashboardShell
      agencyName={dbUser.agencyName ?? "Your company"}
      allowance={
        <Suspense fallback={null}>
          <AllowanceBadge userId={dbUser.id} subscription={dbUser.subscription} />
        </Suspense>
      }
    >
      {dbUser.termsVersion === TERMS_VERSION ? (
        children
      ) : (
        <AcceptTermsGate updated={dbUser.termsVersion !== null} />
      )}
    </DashboardShell>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AcceptTermsGate } from "@/components/dashboard/accept-terms-gate";
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
    <DashboardShell agencyName={dbUser.agencyName ?? "Your company"}>
      {dbUser.termsVersion === TERMS_VERSION ? (
        children
      ) : (
        <AcceptTermsGate updated={dbUser.termsVersion !== null} />
      )}
    </DashboardShell>
  );
}

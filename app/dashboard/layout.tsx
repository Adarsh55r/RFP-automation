import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireDashboardUser } from "@/lib/dashboard";

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
    <DashboardShell agencyName={dbUser.agencyName ?? "Your agency"}>
      {children}
    </DashboardShell>
  );
}

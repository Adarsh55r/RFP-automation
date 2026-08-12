import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireDashboardUser } from "@/lib/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    redirect("/sign-in");
  }

  if (!clerkUser.unsafeMetadata?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const dbUser = await requireDashboardUser();

  const agencyName =
    dbUser?.agencyName ??
    (typeof clerkUser.unsafeMetadata?.agencyName === "string"
      ? clerkUser.unsafeMetadata.agencyName
      : "Your agency");

  return <DashboardShell agencyName={agencyName}>{children}</DashboardShell>;
}

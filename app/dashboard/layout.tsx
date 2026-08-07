import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireDashboardUser } from "@/lib/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "app/dashboard/layout.tsx:11",
      message: "dashboard layout entered",
      data: {},
      timestamp: Date.now(),
      hypothesisId: "H2",
    }),
  }).catch(() => {});
  // #endregion

  const clerkUser = await currentUser();

  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "app/dashboard/layout.tsx:28",
      message: "clerk user resolved",
      data: { hasClerkUser: Boolean(clerkUser) },
      timestamp: Date.now(),
      hypothesisId: "H5",
    }),
  }).catch(() => {});
  // #endregion

  if (!clerkUser) {
    redirect("/sign-in");
  }

  if (!clerkUser.unsafeMetadata?.onboardingCompleted) {
    redirect("/onboarding");
  }

  const dbUser = await requireDashboardUser();

  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "app/dashboard/layout.tsx:52",
      message: "db user resolved",
      data: { hasDbUser: Boolean(dbUser) },
      timestamp: Date.now(),
      hypothesisId: "H2",
    }),
  }).catch(() => {});
  // #endregion

  const agencyName =
    dbUser?.agencyName ??
    (typeof clerkUser.unsafeMetadata?.agencyName === "string"
      ? clerkUser.unsafeMetadata.agencyName
      : "Your agency");

  return <DashboardShell agencyName={agencyName}>{children}</DashboardShell>;
}

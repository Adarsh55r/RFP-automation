import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/dashboard/settings-view";
import { requireDashboardUser } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Settings
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
          Agency profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          This name appears on proposal cover pages. Team size only shapes
          defaults — it is not a seat limit.
        </p>
      </header>

      <SettingsView
        agencyName={user.agencyName ?? ""}
        teamSize={user.teamSize}
        email={user.email}
      />
    </div>
  );
}

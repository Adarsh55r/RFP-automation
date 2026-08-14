import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { RecentRfps } from "@/components/dashboard/recent-rfps";
import { StatCards } from "@/components/dashboard/stat-cards";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getDashboardHomeData } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const data = await getDashboardHomeData();

  if (!data) {
    redirect("/onboarding");
  }

  const firstName =
    data.agencyName.split(" ")[0] === "Your"
      ? "there"
      : data.agencyName.split(" ")[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Dashboard
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Track RFPs for {data.agencyName}, see what is left on your plan, and
          pick up drafts where you left off.
        </p>
      </header>

      <StatCards
        rfpsThisMonth={data.stats.rfpsThisMonth}
        rfpsRemaining={data.stats.rfpsRemaining}
        rfpsLimit={data.stats.rfpsLimit}
        draftsInProgress={data.stats.draftsInProgress}
      />

      {data.recentRfps.length > 0 ? (
        <RecentRfps rfps={data.recentRfps} />
      ) : (
        <EmptyState
          icon={Inbox}
          headline="No RFPs yet"
          description="Upload a private-sector RFP pack — PDF or Word — and DraftWin will extract requirements you can edit before drafting."
          action={
            <Button asChild>
              <Link href="/dashboard/rfps/new">Upload your first RFP</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

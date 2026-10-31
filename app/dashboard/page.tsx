import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { RecentRfps } from "@/components/dashboard/recent-rfps";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { OutcomesSummary } from "@/components/dashboard/outcomes-summary";
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
        <p className="font-mono text-xs tracking-[0.18em] text-brand uppercase">
          Dashboard
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Track RFPs for {data.agencyName}, see what is left on your plan, and
          pick up drafts where you left off.
        </p>
      </header>

      <SetupChecklist steps={data.setup} />

      <StatCards allowance={data.allowance} draftsInProgress={data.draftsInProgress} />

      <OutcomesSummary summary={data.outcomes} />

      {data.recentRfps.length > 0 ? (
        <RecentRfps rfps={data.recentRfps} />
      ) : (
        <EmptyState
          icon={Inbox}
          headline="Upload your first RFP"
          description="Drop in any RFP, tender, or questionnaire (PDF, Word, Excel or CSV). DraftBid AI pulls out every requirement for you to check, then drafts your proposal in minutes."
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

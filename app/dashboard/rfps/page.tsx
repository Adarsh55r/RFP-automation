import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { RecentRfps } from "@/components/dashboard/recent-rfps";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDashboardUser } from "@/lib/dashboard";
import { getRfpsForUser } from "@/lib/rfps";

export const metadata: Metadata = {
  title: "RFPs",
  robots: { index: false, follow: false },
};

export default async function RfpsPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const rfps = await getRfpsForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            RFPs
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
            Your RFP pipeline
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
            Open an uploaded pack to extract requirements, confirm fields, and
            draft the proposal.
          </p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-fit">
          <Link href="/dashboard/rfps/new">Upload RFP</Link>
        </Button>
      </header>

      {rfps.length > 0 ? (
        <RecentRfps rfps={rfps} title="All RFPs" />
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RfpUploadZone } from "@/components/dashboard/rfp-upload-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireDashboardUser } from "@/lib/dashboard";
import { getRfpUploadQuota } from "@/lib/rfps";

export const metadata: Metadata = {
  title: "Upload RFP",
  robots: { index: false, follow: false },
};

export default async function NewRfpPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/sign-in");
  }

  const tier = user.subscription?.tier ?? "free";
  const quota = await getRfpUploadQuota(user.id, tier);

  const atLimit = quota.remaining === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          New RFP
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink">
          Upload an RFP pack
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Drop a private-sector RFP in PDF or Word format. DraftWin stores the
          original file and prepares it for requirement extraction.
        </p>
      </header>

      {atLimit ? (
        <Card className="flex flex-col gap-4">
          <h2 className="font-sans text-lg font-semibold text-ink">
            Monthly limit reached
          </h2>
          <p className="text-sm leading-relaxed text-slate">
            You have used all {quota.limit} RFP uploads on your current plan
            this month. Upgrade to add more capacity.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/billing">View plans</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <RfpUploadZone />
          <p className="font-mono text-xs tracking-wide text-slate">
            {quota.remaining === null
              ? "Unlimited uploads on your plan."
              : `${quota.remaining} of ${quota.limit} uploads remaining this month.`}
          </p>
        </>
      )}
    </div>
  );
}

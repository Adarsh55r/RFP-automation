import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanLimitNotice } from "@/components/dashboard/plan-limit-notice";
import { RfpUploadZone } from "@/components/dashboard/rfp-upload-zone";
import { requireDashboardUser } from "@/lib/dashboard";
import { decideUpload, getProposalAllowance } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Upload RFP",
  robots: { index: false, follow: false },
};

export default async function NewRfpPage() {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const allowance = await getProposalAllowance(user.id, user.subscription);
  const decision = decideUpload(allowance);
  // A hard stop (no pay-per-proposal option) replaces the upload box; an
  // overage plan keeps it and asks for confirmation after the file is chosen.
  const blocked = !decision.ok && decision.status === 403;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          New RFP
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink">
          Upload an RFP
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
          Add an RFP, tender or questionnaire as a PDF or Word file. Next,
          DraftBid AI lists the requirements it finds for you to check before
          drafting.
        </p>
      </header>

      {blocked && !decision.ok ? (
        <PlanLimitNotice
          title={allowance.accessEnded ? "Your pass has ended" : "Proposal limit reached"}
          message={decision.error}
        />
      ) : (
        <>
          <RfpUploadZone />
          <p className="font-mono text-xs tracking-wide text-slate">
            {allowance.remaining === null
              ? `No proposal limit on your ${allowance.plan.name} plan.`
              : allowance.remaining > 0
                ? `${allowance.remaining} of ${allowance.limit} proposals left ${allowance.periodLabel}.`
                : `You have used the ${allowance.limit} proposals included ${allowance.periodLabel}. Extra proposals are $${allowance.overagePriceUsd} each, after you confirm.`}
          </p>
        </>
      )}
    </div>
  );
}

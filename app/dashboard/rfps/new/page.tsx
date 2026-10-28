import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuyExtraProposalButton } from "@/components/dashboard/billing-controls";
import { PlanLimitNotice } from "@/components/dashboard/plan-limit-notice";
import { RfpUploadZone } from "@/components/dashboard/rfp-upload-zone";
import { Card } from "@/components/ui/card";
import { requireDashboardUser } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { dodoConfigured } from "@/lib/dodo";
import { decideUpload, getProposalAllowance } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Upload RFP",
  robots: { index: false, follow: false },
};

export default async function NewRfpPage({ searchParams }: { searchParams: Promise<{ extra?: string }> }) {
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }
  const { extra } = await searchParams;

  const [allowance, extras] = await Promise.all([
    getProposalAllowance(user.id, user.subscription),
    prisma.extraProposal.count({ where: { userId: user.id, usedAt: null } }),
  ]);
  const decision = decideUpload(allowance, extras);
  // A hard stop replaces the upload box. On plans that sell extras, the box stays
  // and an extra proposal is bought first (the upload asks again if needed).
  const blocked = !decision.ok && decision.status === 403;
  const needsExtra = !decision.ok && decision.status === 402;

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

      {extra === "paid" ? (
        <Card className="border-brand">
          <p className="text-sm leading-relaxed text-ink">
            {extras > 0
              ? "Payment received: your extra proposal is ready. Upload the RFP below."
              : "Thank you. Your payment is being confirmed, which usually takes under a minute. Refresh this page, then upload the RFP."}
          </p>
        </Card>
      ) : null}

      {blocked && !decision.ok ? (
        <PlanLimitNotice
          title={allowance.paymentOnHold ? "Payment needed" : allowance.accessEnded ? "Your pass has ended" : "Proposal limit reached"}
          message={decision.error}
        />
      ) : (
        <>
          {needsExtra && !decision.ok && dodoConfigured() && decision.overagePriceUsd ? (
            <Card className="flex flex-col gap-4">
              <p className="text-sm leading-relaxed text-ink">{decision.error}</p>
              <BuyExtraProposalButton priceUsd={decision.overagePriceUsd} />
            </Card>
          ) : null}
          <RfpUploadZone />
          <p className="font-mono text-xs tracking-wide text-slate">
            {allowance.remaining === null
              ? `No proposal limit on your ${allowance.plan.name} plan.`
              : allowance.remaining > 0
                ? `${allowance.remaining} of ${allowance.limit} proposals left ${allowance.periodLabel}.`
                : extras > 0
                  ? `You have used the ${allowance.limit} proposals included ${allowance.periodLabel}. ${extras} paid extra proposal${extras === 1 ? "" : "s"} ready to use.`
                  : `You have used the ${allowance.limit} proposals included ${allowance.periodLabel}. Extra proposals are $${allowance.overagePriceUsd} each, paid before the upload.`}
          </p>
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RfpDraftView } from "@/components/dashboard/rfp-draft-view";
import { Badge } from "@/components/ui/badge";
import { requireDashboardUser } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import { rfpStatusLabel, rfpStatusVariant } from "@/lib/rfp-status";
import { proposalAllowance } from "@/lib/ai-guard";
import {
  hasModelPlan,
  parseDraftPlan,
  resolveCover,
  sectionsForRfp,
} from "@/lib/rfp-draft";
import { getRfpForUser } from "@/lib/rfps";

type DraftPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: DraftPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    return { title: "Draft" };
  }

  const rfp = await getRfpForUser(id, user.id);
  return {
    title: rfp ? `Draft · ${rfp.title}` : "Draft",
    robots: { index: false, follow: false },
  };
}

export default async function RfpDraftPage({ params }: DraftPageProps) {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const rfp = await getRfpForUser(id, user.id);
  if (!rfp) {
    notFound();
  }

  if (
    rfp.status !== "extracted" &&
    rfp.status !== "drafting" &&
    rfp.status !== "drafted" &&
    rfp.status !== "exported"
  ) {
    redirect(`/dashboard/rfps/${rfp.id}`);
  }

  const drafts = await prisma.draft.findMany({
    where: { rfpId: rfp.id },
    orderBy: { createdAt: "asc" },
  });

  const plan = parseDraftPlan(rfp.draftPlan);
  const cover = resolveCover(plan, {
    companyName: user.agencyName?.trim() || "Your company",
    rfpTitle: rfp.title,
  });

  const limits = proposalAllowance(user.subscription?.tier ?? "free");

  const autoStart =
    drafts.length === 0 &&
    (rfp.status === "extracted" || rfp.status === "drafting");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-6">
        <Link
          href={`/dashboard/rfps/${rfp.id}`}
          className={cn(
            textLink,
            "inline-flex w-fit items-center gap-2 text-sm text-slate hover:text-brand",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to requirements
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              Drafting
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
              Write the proposal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
              Drafts come from the full RFP, your extracted requirements, and
              your Content Library. The checklist and compliance review are for
              your eyes only; the optional compliance matrix appendix lists each
              requirement and where your proposal answers it.
            </p>
          </div>
          <Badge variant={rfpStatusVariant[rfp.status]} className="w-fit">
            {rfpStatusLabel[rfp.status]}
          </Badge>
        </div>
      </header>

      <RfpDraftView
        rfpId={rfp.id}
        rfpTitle={rfp.title}
        sections={sectionsForRfp(rfp)}
        initialDrafts={drafts}
        initialCoverageMap={rfp.coverageMap}
        autoStart={autoStart}
        cover={cover}
        legacyDraft={drafts.length > 0 && !hasModelPlan(plan)}
        allowance={{
          fullDrafts: { used: rfp.fullDraftCount, limit: limits.full_draft },
          revisions: { used: rfp.revisionCount, limit: limits.revision },
        }}
      />
    </div>
  );
}

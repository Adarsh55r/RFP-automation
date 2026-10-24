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
  proposalOutline,
  resolveCover,
  verifiedReference,
} from "@/lib/rfp-draft";
import { getRfpForUser } from "@/lib/rfps";
import { credentialsIn } from "@/lib/claim-checks";
import { parseQuestionnaireMap } from "@/lib/spreadsheet";
import { DraftStrengthCard } from "@/components/dashboard/draft-strength-card";
import { storedKeyDetails } from "@/lib/key-details";
import { draftStrength } from "@/lib/library-readiness";
import { pageLimitFrom } from "@/lib/page-limit";

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

  const [drafts, library, source] = await Promise.all([
    prisma.draft.findMany({
      where: { rfpId: rfp.id },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.libraryItem.findMany({ where: { userId: user.id }, select: { type: true, title: true, content: true } }),
    prisma.rfp.findUnique({ where: { id: rfp.id }, select: { sourceText: true } }),
  ]);
  const sourceText = source?.sourceText ?? "";
  // Credentials the bidder's own library mentions; anything else a draft claims gets flagged.
  const supportedCredentials = credentialsIn(library.map((item) => `${item.title}\n${item.content}`).join("\n"));

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

      <DraftStrengthCard
        strength={draftStrength(library, {
          requirementsText: [rfp.extractedEligibility, rfp.extractedDesirable, rfp.extractedSubmission, rfp.extractedEvaluationCriteria]
            .flatMap((list) => (Array.isArray(list) ? list : []))
            .join("\n"),
          keyDetails: storedKeyDetails(rfp.extractedDetails),
          questionCount: Array.isArray(rfp.extractedQuestionnaire) ? rfp.extractedQuestionnaire.length : 0,
        })}
      />

      <RfpDraftView
        rfpId={rfp.id}
        rfpTitle={rfp.title}
        sections={proposalOutline(rfp).map(({ key, kind, title }) => ({ key, kind, title }))}
        initialDrafts={drafts}
        initialCoverageMap={rfp.coverageMap}
        autoStart={autoStart}
        cover={cover}
        referenceNotInRfp={Boolean(cover.solicitationNumber && sourceText.trim() && !verifiedReference(cover.solicitationNumber, sourceText))}
        legacyDraft={drafts.length > 0 && !hasModelPlan(plan)}
        supportedCredentials={supportedCredentials}
        spreadsheet={parseQuestionnaireMap(rfp.questionnaireMap)?.format ?? null}
        pageLimit={pageLimitFrom(storedKeyDetails(rfp.extractedDetails), rfp.extractedSubmission)}
        allowance={{
          fullDrafts: { used: rfp.fullDraftCount, limit: limits.full_draft },
          revisions: { used: rfp.revisionCount, limit: limits.revision },
        }}
      />
    </div>
  );
}

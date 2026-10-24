import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeleteRfpButton } from "@/components/dashboard/delete-rfp-button";
import { RfpExtractionPanel } from "@/components/dashboard/rfp-extraction-panel";
import { SpreadsheetColumnsCard } from "@/components/dashboard/spreadsheet-columns-card";
import { AddendaCard } from "@/components/dashboard/addenda-card";
import { BidOutcomeCard } from "@/components/dashboard/bid-outcome-card";
import { KeyDetailsCard } from "@/components/dashboard/key-details-card";
import { storedKeyDetails } from "@/lib/key-details";
import { prisma } from "@/lib/db";
import { parseExtractionChanges } from "@/lib/requirement-diff";
import { proposalAllowance } from "@/lib/ai-guard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireDashboardUser } from "@/lib/dashboard";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import { rfpStatusLabel, rfpStatusVariant } from "@/lib/rfp-status";
import { getRfpForUser } from "@/lib/rfps";
import { parseQuestionnaireMap } from "@/lib/spreadsheet";
import {
  isRfpDocumentType,
  rfpDocumentTypeLabel,
} from "@/lib/rfp-document-type";

type RfpDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function generateMetadata({
  params,
}: RfpDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    return { title: "RFP" };
  }

  const rfp = await getRfpForUser(id, user.id);
  return {
    title: rfp?.title ?? "RFP",
    robots: { index: false, follow: false },
  };
}

export default async function RfpDetailPage({ params }: RfpDetailPageProps) {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const rfp = await getRfpForUser(id, user.id);
  if (!rfp) {
    notFound();
  }
  const sheetMap = parseQuestionnaireMap(rfp.questionnaireMap);
  const keyDetails = storedKeyDetails(rfp.extractedDetails);
  const addenda = await prisma.rfpFile.findMany({ where: { rfpId: rfp.id }, orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-6">
        <Link
          href="/dashboard/rfps"
          className={cn(
            textLink,
            "inline-flex w-fit items-center gap-2 text-sm text-slate hover:text-brand",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to RFPs
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              RFP detail
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
              {rfp.title}
            </h1>
            <p className="mt-2 font-mono text-xs tracking-wide text-slate">
              Added {formatDate(rfp.createdAt)}
            </p>
          </div>
          <div className="flex w-fit flex-col gap-2 sm:items-end">
            {isRfpDocumentType(rfp.extractedDocumentType) ? (
              <Badge variant="submitted" className="w-fit">
                {rfpDocumentTypeLabel[rfp.extractedDocumentType]}
              </Badge>
            ) : null}
            <Badge variant={rfpStatusVariant[rfp.status]} className="w-fit">
              {rfpStatusLabel[rfp.status]}
            </Badge>
          </div>
        </div>
      </header>

      <Card className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Source file
        </p>
        <p className="font-sans text-sm font-semibold text-ink">{rfp.title}</p>
        {rfp.originalFileUrl ? (
          <a
            href={`/api/rfps/${rfp.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(textLink, "mt-2 inline-block w-fit text-sm")}
          >
            Open uploaded file
          </a>
        ) : (
          <p className="mt-2 text-sm text-slate">File URL not available.</p>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <DeleteRfpButton rfpId={rfp.id} title={rfp.title} />
        </div>
      </Card>

      <RfpExtractionPanel
        rfp={{
          id: rfp.id,
          status: rfp.status,
          originalFileUrl: rfp.originalFileUrl,
          extractCount: rfp.extractCount,
          extractedDocumentType: rfp.extractedDocumentType,
          extractedScope: rfp.extractedScope,
          extractedDeadline: rfp.extractedDeadline,
          extractedEligibility: rfp.extractedEligibility,
          extractedDesirable: rfp.extractedDesirable,
          extractedEvaluationCriteria: rfp.extractedEvaluationCriteria,
          extractedQuestionnaire: rfp.extractedQuestionnaire,
          extractedFlags: rfp.extractedFlags,
          extractedSubmission: rfp.extractedSubmission,
        }}
        extractLimit={proposalAllowance(user.subscription?.tier ?? "free").extract}
      />

      {keyDetails.length > 0 && rfp.status !== "extracting" ? (
        <KeyDetailsCard rfpId={rfp.id} details={keyDetails} />
      ) : null}

      {rfp.originalFileUrl && rfp.status !== "extracting" ? (
        <AddendaCard
          rfpId={rfp.id}
          files={addenda.map((file) => ({
            id: file.id,
            fileName: file.fileName,
            createdAt: file.createdAt.toISOString(),
            included: Boolean(file.includedAt),
          }))}
          changes={parseExtractionChanges(rfp.extractionChanges)}
          extracted={Boolean(rfp.extractedDocumentType)}
        />
      ) : null}

      {rfp.status === "drafted" || rfp.status === "exported" || rfp.submittedAt || rfp.outcome ? (
        <BidOutcomeCard
          rfpId={rfp.id}
          initial={{
            submittedAt: rfp.submittedAt ? rfp.submittedAt.toISOString().slice(0, 10) : "",
            outcome: rfp.outcome ?? "",
            contractValue: rfp.contractValueCents !== null ? String(rfp.contractValueCents / 100) : "",
            contractCurrency: rfp.contractCurrency ?? "USD",
            notes: rfp.outcomeNotes ?? "",
            hoursSaved: rfp.hoursSaved !== null ? String(rfp.hoursSaved) : "",
          }}
        />
      ) : null}

      {sheetMap && rfp.status !== "extracting" ? (
        <SpreadsheetColumnsCard
          key={`${sheetMap.sheet}-${sheetMap.questionColumn}-${sheetMap.answerColumn}-${sheetMap.rows.length}`}
          rfpId={rfp.id}
          columns={{
            format: sheetMap.format,
            sheet: sheetMap.sheet,
            headerRow: sheetMap.headerRow,
            questionColumn: sheetMap.questionColumn,
            answerColumn: sheetMap.answerColumn,
            idColumn: sheetMap.idColumn,
            questionCount: sheetMap.rows.length,
            sheets: sheetMap.sheets ?? [],
          }}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { confirmExtraction } from "@/lib/actions/rfp-extraction";
import { downloadRfpDocx } from "@/lib/download-rfp-docx";
import {
  RFP_DOCUMENT_TYPES,
  isRfpDocumentType,
  rfpDocumentTypeLabel,
  type RfpDocumentType,
} from "@/lib/rfp-document-type";
import {
  formatDeadlineForInput,
  listToEditableText,
  scopeToEditableText,
} from "@/lib/rfp-extract-form";
import type { Rfp, RfpStatus } from "@/lib/generated/prisma";

const STATUS_LINES = [
  "Reading document...",
  "Identifying requirements...",
  "Almost done...",
] as const;

type ExtractionFormState = {
  documentType: RfpDocumentType;
  scope: string;
  deadline: string;
  eligibilityCriteria: string;
  desirableCriteria: string;
  evaluationCriteria: string;
  questionnaireItems: string;
  flaggedForReview: string;
};

function formFromRfp(rfp: Rfp): ExtractionFormState {
  return {
    documentType: isRfpDocumentType(rfp.extractedDocumentType)
      ? rfp.extractedDocumentType
      : "other",
    scope: scopeToEditableText(rfp.extractedScope),
    deadline: formatDeadlineForInput(rfp.extractedDeadline),
    eligibilityCriteria: listToEditableText(rfp.extractedEligibility),
    desirableCriteria: listToEditableText(rfp.extractedDesirable),
    evaluationCriteria: listToEditableText(rfp.extractedEvaluationCriteria),
    questionnaireItems: listToEditableText(rfp.extractedQuestionnaire),
    flaggedForReview: listToEditableText(rfp.extractedFlags),
  };
}

export function RfpExtractionPanel({
  rfp,
}: {
  rfp: Rfp;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<RfpStatus>(rfp.status);
  const [form, setForm] = useState<ExtractionFormState>(() => formFromRfp(rfp));
  const [extracting, setExtracting] = useState(false);
  const [statusLineIndex, setStatusLineIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    scope?: string;
    deadline?: string;
  }>({});
  const [confirmPending, startConfirm] = useTransition();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setStatus(rfp.status);
    setForm(formFromRfp(rfp));
  }, [rfp]);

  useEffect(() => {
    if (!extracting) {
      setStatusLineIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setStatusLineIndex((current) => (current + 1) % STATUS_LINES.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, [extracting]);

  const canExtract = Boolean(rfp.originalFileUrl) && !extracting;

  const showForm =
    !extracting &&
    (status === "extracted" ||
      status === "drafting" ||
      status === "drafted" ||
      status === "exported");

  const canOpenDraft =
    status === "drafting" || status === "drafted" || status === "exported";

  const handleExtract = async () => {
    const statusBeforeExtract = status;
    setExtracting(true);
    setError(null);
    setStatus("extracting");

    try {
      const response = await fetch(`/api/rfps/${rfp.id}/extract`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        extracted?: {
          documentType?: string;
          scope: string;
          deadline: string | null;
          eligibilityCriteria: string[];
          desirableCriteria?: string[];
          evaluationCriteria: string[];
          questionnaireItems?: string[];
          flaggedForReview?: string[];
        };
        status?: RfpStatus;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Extraction failed.");
      }

      if (payload.extracted) {
        setForm({
          documentType: isRfpDocumentType(payload.extracted.documentType)
            ? payload.extracted.documentType
            : "other",
          scope: payload.extracted.scope,
          deadline: payload.extracted.deadline ?? "",
          eligibilityCriteria: payload.extracted.eligibilityCriteria.join("\n"),
          desirableCriteria: (payload.extracted.desirableCriteria ?? []).join(
            "\n",
          ),
          evaluationCriteria: payload.extracted.evaluationCriteria.join("\n"),
          questionnaireItems: (payload.extracted.questionnaireItems ?? []).join(
            "\n",
          ),
          flaggedForReview: (payload.extracted.flaggedForReview ?? []).join(
            "\n",
          ),
        });
      }

      setStatus(payload.status ?? "extracted");
      router.refresh();
    } catch (extractError) {
      setStatus(
        statusBeforeExtract === "extracting" ? "uploaded" : statusBeforeExtract,
      );
      setError(
        extractError instanceof Error
          ? extractError.message
          : "Extraction failed. Try again.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = () => {
    const nextErrors: { scope?: string; deadline?: string } = {};
    const hasBody =
      Boolean(form.scope.trim()) ||
      Boolean(form.eligibilityCriteria.trim()) ||
      Boolean(form.questionnaireItems.trim());
    if (!hasBody) {
      nextErrors.scope =
        "Add a scope summary, eligibility criteria, or questionnaire items.";
    }
    if (form.deadline.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.deadline.trim())) {
      nextErrors.deadline = "Deadline must be a valid date.";
    }

    if (nextErrors.scope || nextErrors.deadline) {
      setFieldErrors(nextErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    startConfirm(async () => {
      const result = await confirmExtraction({
        rfpId: rfp.id,
        documentType: form.documentType,
        scope: form.scope,
        deadline: form.deadline,
        eligibilityCriteria: form.eligibilityCriteria,
        desirableCriteria: form.desirableCriteria,
        evaluationCriteria: form.evaluationCriteria,
        questionnaireItems: form.questionnaireItems,
        flaggedForReview: form.flaggedForReview,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStatus(result.status);
      if (status === "extracted") {
        router.push(`/dashboard/rfps/${rfp.id}/draft`);
        return;
      }
      router.refresh();
    });
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      await downloadRfpDocx(rfp.id);
      setStatus("exported");
      toast({
        title: "Proposal exported",
        description: "Your Word document has downloaded.",
        variant: "success",
      });
      router.refresh();
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Could not export DOCX.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {status === "uploaded" && !extracting ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-sans text-lg font-semibold text-ink">
              Extract requirements
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              DraftWin will classify the pack and pull out scope, deadlines,
              mandatory vs preferred eligibility, evaluation weightage, and
              questionnaire rows. You can edit anything before continuing.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleExtract}
            disabled={!canExtract}
            className="w-full sm:w-fit"
          >
            Extract requirements
          </Button>
          {!rfp.originalFileUrl ? (
            <p className="text-sm text-danger">
              Upload a source file before extracting.
            </p>
          ) : null}
        </Card>
      ) : null}

      {extracting ? (
        <Card className="flex flex-col gap-6" aria-busy="true">
          <div>
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              Extraction in progress
            </p>
            <p
              className="mt-2 font-sans text-base font-semibold text-ink"
              aria-live="polite"
            >
              {STATUS_LINES[statusLineIndex]}
            </p>
            <p className="mt-2 text-sm text-slate">
              Long documents can take 10–20 seconds.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-1/3" />
            <SkeletonText lines={4} />
            <Skeleton className="h-10 w-1/4" />
            <SkeletonText lines={3} />
          </div>
        </Card>
      ) : null}

      {showForm ? (
        <Card className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-sans text-lg font-semibold text-ink">
                Review extracted requirements
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Correct anything that looks off before you continue to drafting.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Badge variant="submitted" className="w-fit">
                {rfpDocumentTypeLabel[form.documentType]}
              </Badge>
              {status === "extracted" || canOpenDraft ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExtract}
                  disabled={!canExtract}
                  className="w-full sm:w-auto"
                >
                  Re-run extraction
                </Button>
              ) : null}
            </div>
          </div>

          {form.flaggedForReview.trim() ? (
            <div className="rounded-control border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="font-mono text-xs tracking-wide text-ink uppercase">
                Flagged for review
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                {form.flaggedForReview.split("\n").filter(Boolean).join(" · ")}
              </p>
            </div>
          ) : null}

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Document type
            </span>
            <Select
              value={form.documentType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  documentType: isRfpDocumentType(event.target.value)
                    ? event.target.value
                    : "other",
                }))
              }
              className="max-w-full sm:max-w-xs"
            >
              {RFP_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {rfpDocumentTypeLabel[type]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">Scope</span>
            <Textarea
              value={form.scope}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  scope: event.target.value,
                }))
              }
              rows={6}
              aria-invalid={Boolean(fieldErrors.scope)}
            />
            {fieldErrors.scope ? (
              <p className="text-sm text-danger">{fieldErrors.scope}</p>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Deadline
            </span>
            <Input
              type="date"
              value={form.deadline}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  deadline: event.target.value,
                }))
              }
              aria-invalid={Boolean(fieldErrors.deadline)}
              className="max-w-full font-mono sm:max-w-xs"
            />
            {fieldErrors.deadline ? (
              <p className="text-sm text-danger">{fieldErrors.deadline}</p>
            ) : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Eligibility criteria
            </span>
            <span className="text-xs text-slate">
              Mandatory / must-have items. One criterion per line.
            </span>
            <Textarea
              value={form.eligibilityCriteria}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  eligibilityCriteria: event.target.value,
                }))
              }
              rows={6}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Desirable criteria
            </span>
            <span className="text-xs text-slate">
              Preferred / good-to-have items. One criterion per line.
            </span>
            <Textarea
              value={form.desirableCriteria}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  desirableCriteria: event.target.value,
                }))
              }
              rows={4}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Evaluation criteria
            </span>
            <span className="text-xs text-slate">One criterion per line.</span>
            <Textarea
              value={form.evaluationCriteria}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  evaluationCriteria: event.target.value,
                }))
              }
              rows={6}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Questionnaire items
            </span>
            <span className="text-xs text-slate">
              Numbered security or vendor questions. One question per line.
            </span>
            <Textarea
              value={form.questionnaireItems}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  questionnaireItems: event.target.value,
                }))
              }
              rows={6}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-medium text-ink">
              Flagged for review
            </span>
            <span className="text-xs text-slate">
              Ambiguous, contradictory, or illegible fields. One flag per line.
            </span>
            <Textarea
              value={form.flaggedForReview}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  flaggedForReview: event.target.value,
                }))
              }
              rows={3}
            />
          </label>

          {status === "extracted" ? (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirmPending}
              className="w-full sm:w-fit"
            >
              {confirmPending ? "Saving…" : "Confirm and continue"}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                variant="secondary"
                onClick={handleConfirm}
                disabled={confirmPending}
                className="w-full sm:w-fit"
              >
                {confirmPending ? "Saving…" : "Save requirements"}
              </Button>
              <Button
                type="button"
                onClick={() => router.push(`/dashboard/rfps/${rfp.id}/draft`)}
                className="w-full sm:w-fit"
              >
                Open draft
              </Button>
              {canOpenDraft ? (
                <Button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={exporting}
                  className="w-full bg-accent text-ink sm:w-fit"
                >
                  {exporting ? "Exporting…" : "Export as DOCX"}
                </Button>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

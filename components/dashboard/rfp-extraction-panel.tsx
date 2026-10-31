"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ProgressPanel, type ProgressStep } from "@/components/ui/progress-panel";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/components/ui/sweet-alert";
import { confirmExtraction } from "@/lib/actions/rfp-extraction";
import { downloadRfpExport } from "@/lib/download-rfp-export";
import type { ExportFormat } from "@/lib/proposal-document";
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

/** The extraction's steps, in the order the server reports them. Addenda appear only when there are some. */
const EXTRACTION_STEPS = [
  { id: "download", label: "Opening your file" },
  { id: "read", label: "Reading the document" },
  { id: "addenda", label: "Reading addenda" },
  { id: "extract", label: "Finding requirements, deadlines and evaluation criteria" },
  { id: "check", label: "Checking dates and page references against the document" },
  { id: "save", label: "Saving your checklist" },
] as const;
type ExtractionStepId = (typeof EXTRACTION_STEPS)[number]["id"];

function extractionSteps(current: ExtractionStepId | null, detail: string | null, sawAddenda: boolean): ProgressStep[] {
  const shown = EXTRACTION_STEPS.filter((step) => step.id !== "addenda" || sawAddenda);
  const at = current ? shown.findIndex((step) => step.id === current) : -1;
  return shown.map((step, index) => ({
    id: step.id,
    label: step.label,
    detail: step.id === current && detail ? detail : undefined,
    state: index < at ? "done" : index === at ? "active" : "pending",
  }));
}

type ExtractPayload = {
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
    submissionRequirements?: string[];
  };
  status?: RfpStatus;
};

type ExtractionFormState = {
  documentType: RfpDocumentType;
  scope: string;
  deadline: string;
  eligibilityCriteria: string;
  desirableCriteria: string;
  evaluationCriteria: string;
  questionnaireItems: string;
  flaggedForReview: string;
  submissionRequirements: string;
};

/** The RFP fields this panel shows. Pages pass only these, so the full document text never reaches the browser. */
export type ExtractionPanelRfp = Pick<
  Rfp,
  | "id"
  | "status"
  | "originalFileUrl"
  | "extractCount"
  | "extractedDocumentType"
  | "extractedScope"
  | "extractedDeadline"
  | "extractedEligibility"
  | "extractedDesirable"
  | "extractedEvaluationCriteria"
  | "extractedQuestionnaire"
  | "extractedFlags"
  | "extractedSubmission"
>;

function formFromRfp(rfp: ExtractionPanelRfp): ExtractionFormState {
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
    submissionRequirements: listToEditableText(rfp.extractedSubmission),
  };
}

export function RfpExtractionPanel({
  rfp,
  extractLimit,
}: {
  rfp: ExtractionPanelRfp;
  /** Requirement extractions allowed for this proposal on the user's plan. */
  extractLimit: number;
}) {
  const router = useRouter();
  const alert = useAlert();
  const [status, setStatus] = useState<RfpStatus>(rfp.status);
  const [form, setForm] = useState<ExtractionFormState>(() => formFromRfp(rfp));
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<{ step: ExtractionStepId | null; detail: string | null; sawAddenda: boolean; startedAt: number }>({
    step: null,
    detail: null,
    sawAddenda: false,
    startedAt: 0,
  });
  const [fieldErrors, setFieldErrors] = useState<{
    scope?: string;
    deadline?: string;
  }>({});
  const [confirmPending, startConfirm] = useTransition();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  useEffect(() => {
    setStatus(rfp.status);
    setForm(formFromRfp(rfp));
  }, [rfp]);

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
    setProgress({ step: null, detail: null, sawAddenda: false, startedAt: Date.now() });
    setStatus("extracting");

    try {
      // The server reports each step as one JSON line, then the result.
      const response = await fetch(`/api/rfps/${rfp.id}/extract`, {
        method: "POST",
        headers: { Accept: "application/x-ndjson" },
      });
      let payload: ExtractPayload = {};
      let resultStatus = response.status;
      if ((response.headers.get("content-type") ?? "").includes("application/x-ndjson") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split("\n");
          buffered = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as
              | { type: "step"; step: ExtractionStepId; detail?: string }
              | { type: "result"; status: number; body: ExtractPayload };
            if (event.type === "step") {
              setProgress((current) => ({
                ...current,
                step: event.step,
                detail: event.detail ?? null,
                sawAddenda: current.sawAddenda || event.step === "addenda",
              }));
            } else {
              resultStatus = event.status;
              payload = event.body;
            }
          }
        }
      } else {
        payload = (await response.json()) as ExtractPayload;
      }

      if (resultStatus >= 400 || !payload.status) {
        throw new Error(payload.error ?? "Extraction did not finish. Try again in a moment.");
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
          submissionRequirements: (
            payload.extracted.submissionRequirements ?? []
          ).join("\n"),
        });
      }

      setStatus(payload.status ?? "extracted");
      alert.success("Requirements extracted", "Check the checklist below, correct anything that looks off, then continue to drafting.");
      router.refresh();
    } catch (extractError) {
      setStatus(
        statusBeforeExtract === "extracting" ? "uploaded" : statusBeforeExtract,
      );
      alert.error(
        "Extraction didn't finish",
        extractError instanceof Error ? extractError.message : "Extraction failed. Try again.",
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
      return;
    }

    setFieldErrors({});
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
        submissionRequirements: form.submissionRequirements,
      });

      if (!result.ok) {
        alert.error("Couldn't save the requirements", result.error);
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

  const handleExport = async (format: ExportFormat) => {
    if (exporting) return;
    setExporting(format);
    try {
      await downloadRfpExport(rfp.id, format);
      setStatus("exported");
      alert.success("Proposal exported", format === "pdf" ? "Your PDF has downloaded." : "Your Word document has downloaded.");
      router.refresh();
    } catch (exportError) {
      alert.error("Export failed", exportError instanceof Error ? exportError.message : "Could not export the proposal.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {(status === "uploaded" || status === "extracting") && !extracting ? (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              {status === "extracting" ? "Extraction did not finish" : "Extract requirements"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate">
              {status === "extracting"
                ? "The last extraction was interrupted before it finished (for example, the page was closed or the server timed out). Try again; if another extraction is still running, wait a few minutes."
                : "DraftBid AI will classify the pack and pull out scope, deadlines, mandatory vs preferred eligibility, evaluation weightage, and questionnaire rows. You can edit anything before continuing."}
            </p>
          </div>
          <Button
            type="button"
            onClick={handleExtract}
            disabled={!canExtract}
            className="w-full sm:w-fit"
          >
            {status === "extracting" ? "Try extraction again" : "Extract requirements"}
          </Button>
          {!rfp.originalFileUrl ? (
            <p className="text-sm text-danger">
              Upload a source file before extracting.
            </p>
          ) : null}
        </Card>
      ) : null}

      {extracting ? (
        <ProgressPanel
          eyebrow="Extracting requirements"
          steps={extractionSteps(progress.step, progress.detail, progress.sawAddenda)}
          startedAt={progress.startedAt}
          hint="Long documents can take a minute or two. You can stay on this page."
        />
      ) : null}

      {showForm ? (
        <Card className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
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
                <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExtract}
                  disabled={!canExtract || rfp.extractCount >= extractLimit}
                  className="w-full sm:w-auto"
                >
                  Re-run extraction
                </Button>
                <span className="font-mono text-xs tracking-wide text-slate">
                  {Math.max(extractLimit - rfp.extractCount, 0)} of {extractLimit} extractions left
                </span>
                </>
              ) : null}
            </div>
          </div>

          {form.flaggedForReview.trim() ? (
            <div className="rounded-control border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="font-mono text-xs tracking-wide text-ink uppercase">
                Flagged for review
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
                {form.flaggedForReview
                  .split("\n")
                  .filter(Boolean)
                  .map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
              </ul>
              <p className="mt-2 text-xs text-slate">
                Check each item against the RFP before you draft. Delete a line once it is resolved.
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
              Submission requirements
            </span>
            <span className="text-xs text-slate">
              Page limits, formatting, required forms and certifications, Q&amp;A
              deadline, submission time and portal. One rule per line.
            </span>
            <Textarea
              value={form.submissionRequirements}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  submissionRequirements: event.target.value,
                }))
              }
              rows={5}
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
                <>
                  <Button
                    type="button"
                    variant="accent"
                    onClick={() => void handleExport("docx")}
                    disabled={exporting !== null}
                    className="w-full sm:w-fit"
                  >
                    {exporting === "docx" ? "Exporting…" : "Export Word"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => void handleExport("pdf")}
                    disabled={exporting !== null}
                    className="w-full sm:w-fit"
                  >
                    {exporting === "pdf" ? "Exporting…" : "Export PDF"}
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

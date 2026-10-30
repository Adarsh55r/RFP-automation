"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  Check,
  Eye,
  FileDown,
  FileText,
  LoaderCircle,
  PencilLine,
  Sparkles,
  Table2,
  Wand2,
} from "lucide-react";
import { ExportDocumentMoment } from "@/components/dashboard/export-document-moment";
import { CoverageMapCard } from "@/components/dashboard/coverage-map-card";
import { CoverDetailsCard } from "@/components/dashboard/cover-details-card";
import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { saveDraftSection, setClaimReviewed } from "@/lib/actions/rfp-draft";
import { parseCitations, type DraftCitations } from "@/lib/citations";
import { downloadRfpExport, type DownloadFormat } from "@/lib/download-rfp-export";
import { unverifiedCredentials } from "@/lib/claim-checks";
import { rateConflicts } from "@/lib/grounding";
import { datesAfterDeadline } from "@/lib/proposal-dates";
import { findPlaceholders } from "@/lib/markdown";
import type { ExportVariant } from "@/lib/proposal-document";
import type { CoverDetails } from "@/lib/rfp-draft";
import type { Draft, DraftSection } from "@/lib/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressPanel, type ProgressStep } from "@/components/ui/progress-panel";
import { SkeletonText } from "@/components/ui/skeleton";
import { useAlert } from "@/components/ui/sweet-alert";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

type SectionState = {
  content: string;
  status: "idle" | "streaming" | "ready" | "error";
  error?: string;
  /** Citation check from the server; null for drafts written before citations existed. */
  citations?: DraftCitations | null;
};

type DraftPhase = "planning" | "writing" | "reviewing";

/** One section of the proposal outline, as the editor needs it. */
export type OutlineSection = { key: string; kind: DraftSection; title: string };

type StreamEvent =
  | { type: "phase"; phase: DraftPhase }
  | { type: "outline"; sections: OutlineSection[] }
  | { type: "section_start"; section: string; label: string }
  | { type: "delta"; section: string; text: string }
  | { type: "section_done"; section: string; content: string; citations: DraftCitations }
  | { type: "section_error"; section: string; message: string }
  | { type: "section_checked"; section: string; citations: DraftCitations }
  | { type: "meta_start"; block: string }
  | { type: "meta_delta"; block: string; text: string }
  | { type: "meta_done"; block: string }
  | { type: "done" }
  | { type: "error"; message: string };

type ExportPhase = "idle" | "generating" | "ready" | "error";

/** Progress of a full draft, built from the server's stream events. */
type DraftProgress = { startedAt: number; written: number; current: string | null; coverage: boolean };

function draftSteps(phase: DraftPhase, progress: DraftProgress, total: number): ProgressStep[] {
  const at = progress.coverage ? 3 : phase === "reviewing" ? 2 : phase === "writing" ? 1 : 0;
  const steps = [
    { id: "planning", label: "Reading the full RFP and planning the bid" },
    {
      id: "writing",
      label: "Writing each section from the RFP and your library",
      detail: at === 1 && total > 0
        ? `${Math.min(progress.written, total)} of ${total} done${progress.current ? ` · now: ${progress.current}` : ""}`
        : at > 1 && total > 0 ? `${total} sections` : undefined,
    },
    { id: "reviewing", label: "Checking every claim and requirement" },
    ...(progress.coverage ? [{ id: "coverage", label: "Building the compliance matrix" }] : []),
  ];
  return steps.map((step, index) => ({ ...step, state: index < at ? "done" : index === at ? "active" : "pending" }));
}

const revisionPresets = [
  "More specific to this buyer",
  "Shorter and tighter",
  "More persuasive",
  "Use UK English",
  "Simpler language",
];

const EMPTY: SectionState = { content: "", status: "idle" };

/** Section state by outline key. Drafts arrive oldest first, so the newest row for a key wins. */
function sectionsFromDrafts(drafts: Draft[]): Record<string, SectionState> {
  const next: Record<string, SectionState> = {};
  for (const draft of drafts) {
    next[draft.sectionKey ?? draft.sectionName] = {
      content: draft.content,
      status: "ready",
      citations: parseCitations(draft.citations),
    };
  }
  return next;
}

/** Statements in a section the bidder must check: uncited facts, figures not in the sources, absolute claims. */
function itemsToCheck(citations: DraftCitations | null | undefined) {
  if (!citations) return [];
  return [
    ...(citations.misstated ?? []).map((item) => ({ text: `${item.claim} (${item.issue})`, claim: item.claim, label: "Does not match its source" })),
    ...citations.unsupported.map((text) => ({ text, claim: text, label: "No source" })),
    ...(citations.figures ?? []).map((text) => ({ text, claim: text, label: "Figure not in your library or the RFP" })),
    ...(citations.overclaims ?? []).map((text) => ({ text, claim: text, label: "Absolute claim" })),
    ...(citations.notes ?? []).map((text) => ({ text, claim: text, label: "Note to you left in the text" })),
  ];
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function DraftSectionCard({
  rfpId,
  section,
  title,
  kind,
  state,
  busy,
  revisionsLeft,
  mode,
  onModeChange,
  onContentChange,
  onCitations,
  onRevise,
}: {
  rfpId: string;
  /** The section's key in the outline. */
  section: string;
  title: string;
  kind: DraftSection;
  state: SectionState;
  busy: boolean;
  revisionsLeft: number;
  mode: "preview" | "edit";
  onModeChange: (mode: "preview" | "edit") => void;
  onContentChange: (section: string, content: string) => void;
  onCitations: (section: string, content: string, citations: DraftCitations) => void;
  onRevise: (section: string, instruction: string) => void;
}) {
  const [saveFlash, setSaveFlash] = useState(false);
  const alert = useAlert();
  const [pending, startTransition] = useTransition();
  const [reviseOpen, setReviseOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const baselineRef = useRef(state.content);

  useEffect(() => {
    if (state.status !== "streaming") {
      baselineRef.current = state.content;
    }
    // Only re-baseline when a generation finishes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const save = () => {
    const next = state.content.trim();
    if (!next || next === baselineRef.current.trim() || state.status === "streaming") {
      return;
    }

    startTransition(async () => {
      const result = await saveDraftSection({ rfpId, sectionKey: section, content: next });
      if (!result.ok) {
        alert.error(`Couldn't save ${title}`, result.error);
        return;
      }
      baselineRef.current = result.draft.content;
      onCitations(section, result.draft.content, result.draft.citations);
      setSaveFlash(true);
      window.setTimeout(() => setSaveFlash(false), 1400);
    });
  };

  const streaming = state.status === "streaming";
  const placeholders = useMemo(() => findPlaceholders(state.content), [state.content]);
  const uncited = itemsToCheck(state.citations).length;
  const hasContent = state.content.trim().length > 0;

  const submitRevision = (text: string) => {
    setReviseOpen(false);
    setInstruction("");
    onRevise(section, text);
  };

  return (
    <Card id={`section-${section}`} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Section</p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">
            {title}
          </h2>
        </div>

        <div className="flex min-h-8 flex-wrap items-center gap-2">
          {streaming ? (
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wide text-brand">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Writing…
            </span>
          ) : null}
          {pending ? (
            <span className="font-mono text-xs tracking-wide text-slate">Saving…</span>
          ) : null}
          {saveFlash ? (
            <span
              className="inline-flex items-center gap-1 text-success"
              style={{ animation: "dw-save-check 1.4s ease-out forwards" }}
              aria-live="polite"
            >
              <Check className="h-4 w-4" aria-hidden />
              <span className="font-mono text-xs tracking-wide">Saved</span>
            </span>
          ) : null}
          {!streaming && hasContent && placeholders.length > 0 ? (
            <Badge variant="accent" className="whitespace-nowrap">
              {placeholders.length} to fill in
            </Badge>
          ) : null}
          {!streaming && hasContent && uncited > 0 ? (
            <Badge variant="danger" className="whitespace-nowrap">
              {uncited} to check
            </Badge>
          ) : null}
          {!streaming && hasContent ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  if (mode === "edit") save();
                  onModeChange(mode === "edit" ? "preview" : "edit");
                }}
              >
                {mode === "edit" ? (
                  <Eye className="h-4 w-4" aria-hidden />
                ) : (
                  <PencilLine className="h-4 w-4" aria-hidden />
                )}
                {mode === "edit" ? "Preview" : "Edit"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy || revisionsLeft <= 0}
                title={revisionsLeft <= 0 ? "No section revisions left for this proposal" : undefined}
                onClick={() => setReviseOpen((open) => !open)}
                aria-expanded={reviseOpen}
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                Revise with AI
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {reviseOpen && !busy ? (
        <form
          className="flex flex-col gap-3 rounded-control border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitRevision(instruction.trim());
          }}
        >
          <label htmlFor={`revise-${section}`} className="text-sm font-medium text-ink">
            What should change in this section?
          </label>
          <Input
            id={`revise-${section}`}
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="e.g. Add our 24/7 help desk and mention the 2-hour response SLA"
            maxLength={1000}
          />
          <div className="flex flex-wrap gap-2">
            {revisionPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => submitRevision(preset)}
                className={cn(
                  "rounded-control border border-border bg-surface-raised px-3 py-1 text-xs text-slate transition-colors hover:text-ink",
                  focusRing,
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate">
            {kind === "responses"
              ? "The AI rewrites only these answers. Long questionnaires are re-answered from scratch, so re-check any answers you edited by hand."
              : "Your manual edits are kept. The AI rewrites only this section."}
          </p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="gap-1.5">
              <Sparkles className="h-4 w-4" aria-hidden />
              Rewrite section
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setReviseOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {streaming && !hasContent ? <SkeletonText lines={5} /> : null}

      {hasContent && (mode === "preview" || streaming) ? (
        <div className="max-h-[42rem] overflow-y-auto rounded-control border border-border bg-surface-raised p-5">
          <MarkdownPreview
            markdown={state.content}
            sources={streaming ? undefined : (state.citations?.sources ?? {})}
          />
        </div>
      ) : null}

      {hasContent && mode === "edit" && !streaming ? (
        <>
          <Textarea
            value={state.content}
            onChange={(event) => onContentChange(section, event.target.value)}
            onBlur={save}
            rows={18}
            className="min-h-64 font-mono text-[13px] leading-relaxed"
            aria-label={`${title} draft`}
          />
          <p className="text-xs text-slate">
            Markdown: <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code>,
            tables with <code>|</code>. Anything in <code>[[double brackets]]</code> is
            highlighted as still needing your input. Markers like <code>[S3]</code> show which
            library passage a claim came from. Changes save when you leave the field.
          </p>
        </>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-danger">{state.error ?? "This section failed to draft."}</p>
      ) : null}

      {!streaming && !hasContent && state.status !== "error" ? (
        <p className="text-sm text-slate">Waiting to generate…</p>
      ) : null}

    </Card>
  );
}

function InputChecklist({
  rfpId,
  sections,
  state,
  onJump,
  onCitations,
}: {
  rfpId: string;
  sections: OutlineSection[];
  state: Record<string, SectionState>;
  onJump: (section: string) => void;
  onCitations: (section: string, content: string, citations: DraftCitations) => void;
}) {
  const [pending, startTransition] = useTransition();
  const alert = useAlert();
  const groups = sections
    .map(({ key, title }) => ({
      section: key,
      title,
      items: findPlaceholders((state[key] ?? EMPTY).content),
      uncited: itemsToCheck(state[key]?.citations),
    }))
    .filter((group) => group.items.length > 0 || group.uncited.length > 0);
  const total = groups.reduce((sum, group) => sum + group.items.length + group.uncited.length, 0);

  const keepClaim = (section: string, claim: string) => {
    startTransition(async () => {
      const result = await setClaimReviewed({ rfpId, sectionKey: section, claim, reviewed: true });
      if (!result.ok) {
        alert.error("Couldn't mark it as checked", result.error);
        return;
      }
      onCitations(section, (state[section] ?? EMPTY).content, result.citations);
    });
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Before you submit</p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">Needs your input</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            Facts DraftBid AI could not find in the RFP or your library (signatures,
            prices, reference contacts, figures to confirm) are highlighted in yellow.
            Listed in red: statements about your company that no library passage
            supports, figures that appear in neither your library nor the RFP, absolute
            claims evaluators distrust, and notes meant for you (&ldquo;to be
            confirmed&rdquo;) that would otherwise reach the buyer. Check each one, then
            fix it or keep it.
          </p>
        </div>
        <Badge variant={total > 0 ? "accent" : "success"} className="w-fit shrink-0 whitespace-nowrap">
          {total > 0 ? `${total} item${total === 1 ? "" : "s"} left` : "Nothing left to fill"}
        </Badge>
      </div>

      {groups.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.section} className="text-sm">
              <button
                type="button"
                onClick={() => onJump(group.section)}
                className={cn("font-semibold text-brand underline-offset-2 hover:underline", focusRing)}
              >
                {group.title}
              </button>
              {group.items.length > 0 ? (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="rounded bg-accent/25 px-2 py-0.5 text-xs text-ink"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {group.uncited.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-2" aria-label="Statements to check">
                  {group.uncited.map(({ text, claim, label }) => (
                    <li
                      key={`${label}:${claim}`}
                      className="flex flex-col gap-2 rounded-control border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-ink sm:flex-row sm:items-start sm:justify-between"
                    >
                      <span>
                        <span className="font-semibold text-danger">{label}: </span>
                        {text}
                      </span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => keepClaim(group.section, claim)}
                        className={cn(
                          "shrink-0 rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-slate hover:text-ink disabled:opacity-50",
                          focusRing,
                        )}
                      >
                        I checked it: keep as written
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function RfpDraftView({
  rfpId,
  rfpTitle,
  sections: initialOutline,
  initialDrafts,
  initialCoverageMap,
  autoStart,
  cover,
  referenceNotInRfp = false,
  legacyDraft,
  supportedCredentials,
  allowance,
  spreadsheet = null,
  pageLimit = null,
}: {
  rfpId: string;
  rfpTitle: string;
  /** The proposal outline: the RFP's own parts when it prescribes them. */
  sections: OutlineSection[];
  initialDrafts: Draft[];
  initialCoverageMap?: string | null;
  autoStart: boolean;
  cover: CoverDetails;
  /** The cover's solicitation number is printed nowhere in the RFP: probably invented or mistyped. */
  referenceNotInRfp?: boolean;
  /** Drafted before bid plans existed: no cover letter, plan, or new structure. */
  legacyDraft: boolean;
  /** Credentials the bidder's library mentions (SOC 2, ISO 27001, ...). */
  supportedCredentials: string[];
  /** The response page limit the RFP states, shown before export and checked after it. */
  pageLimit?: { pages: number; source: string } | null;
  /** Set when the RFP was uploaded as a spreadsheet questionnaire: answers can be exported into it. */
  spreadsheet?: "xlsx" | "csv" | null;
  /** Per-proposal AI allowances: how many were used and the plan's limit. */
  allowance: {
    fullDrafts: { used: number; limit: number };
    revisions: { used: number; limit: number };
  };
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [plannedSections, setPlannedSections] = useState(initialOutline);
  const [sectionState, setSections] = useState(() => sectionsFromDrafts(initialDrafts));
  const sections = (key: string) => sectionState[key] ?? EMPTY;
  const [modes, setModes] = useState<Record<string, "preview" | "edit">>({});
  const [coverageMap, setCoverageMap] = useState(initialCoverageMap ?? "");
  const [coverageStreaming, setCoverageStreaming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<DraftPhase | null>(null);
  const [draftProgress, setDraftProgress] = useState<DraftProgress | null>(null);
  const alert = useAlert();
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportFormat, setExportFormat] = useState<DownloadFormat>("docx");
  const [unansweredRows, setUnansweredRows] = useState<number | null>(null);
  const [pageWarning, setPageWarning] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [includeMatrix, setIncludeMatrix] = useState(true);
  const [exportVariant, setExportVariant] = useState<ExportVariant>("submission");
  const startedRef = useRef(false);

  const hasAnyContent = plannedSections.some(
    (section) => sections(section.key).content.trim().length > 0,
  );
  const canExport = !generating && hasAnyContent;
  const fullDraftsLeft = allowance.fullDrafts.limit - allowance.fullDrafts.used;
  const placeholderTotal = plannedSections.reduce(
    (sum, section) => sum + findPlaceholders(sections(section.key).content).length,
    0,
  );
  const uncitedTotal = plannedSections.reduce(
    (sum, section) => sum + itemsToCheck(sections(section.key).citations).length,
    0,
  );
  const updateCitations = (section: string, content: string, citations: DraftCitations) =>
    setSections((current) => ({
      ...current,
      [section]: { ...(current[section] ?? EMPTY), content, citations },
    }));
  // Credentials the draft names that the library never mentions: possibly claimed without proof.
  const unverifiedClaims = useMemo(() => {
    const where = new Map<string, string[]>();
    for (const section of plannedSections) {
      for (const name of unverifiedCredentials((sectionState[section.key] ?? EMPTY).content, supportedCredentials)) {
        where.set(name, [...(where.get(name) ?? []), section.title]);
      }
    }
    return [...where.entries()];
  }, [plannedSections, sectionState, supportedCredentials]);

  // The same kind of price stated differently in two places ($95 vs $99 per user).
  const conflicts = useMemo(
    () =>
      rateConflicts(
        plannedSections.map((section) => ({ title: section.title, content: (sectionState[section.key] ?? EMPTY).content })),
      ),
    [plannedSections, sectionState],
  );

  // Things on the cover and in the dated parts that would make the bid look wrong or late.
  const coverIssues = useMemo(() => {
    const issues: string[] = [];
    if (referenceNotInRfp) {
      issues.push(
        `The solicitation number on the cover, "${cover.solicitationNumber}", does not appear anywhere in the RFP. Correct it, or clear it in Cover page details if the RFP has none.`,
      );
    }
    const dated = [
      { title: "Cover page", text: cover.submissionDate },
      ...plannedSections
        .filter((section) => section.kind === "cover_letter" || section.kind === "form")
        .map((section) => ({ title: section.title, text: (sectionState[section.key] ?? EMPTY).content })),
    ];
    for (const late of datesAfterDeadline(cover.dueDate, dated)) {
      issues.push(`${late.title} is dated ${late.date}, after the deadline (${cover.dueDate}). A bid dated after its deadline reads as late.`);
    }
    return issues;
  }, [referenceNotInRfp, cover, plannedSections, sectionState]);

  const runGeneration = async (revision?: { section: string; instruction: string }) => {
    setGenerating(true);
    setDraftProgress(revision ? null : { startedAt: Date.now(), written: 0, current: null, coverage: false });
    setExportPhase("idle");
    setCoverageMap("");
    setCoverageStreaming(false);

    // Keep the current text so a failed revision can be put back.
    const previous = sectionState;
    const before = (key: string) => previous[key] ?? EMPTY;
    if (revision) {
      setModes((current) => ({ ...current, [revision.section]: "preview" }));
    } else {
      setSections({});
      setModes({});
    }

    try {
      const response = await fetch(`/api/rfps/${rfpId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          revision
            ? { ...revision, currentContent: before(revision.section).content }
            : {},
        ),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not start drafting.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .map((item) => item.trim())
            .find((item) => item.startsWith("data:"));
          if (!line) continue;

          const payload = JSON.parse(line.slice(5).trim()) as StreamEvent;

          switch (payload.type) {
            case "phase":
              setPhase(payload.phase);
              break;
            case "outline":
              if (payload.sections.length > 0) setPlannedSections(payload.sections);
              break;
            case "section_start":
              setDraftProgress((current) => (current ? { ...current, current: payload.label } : current));
              setSections((current) => ({
                ...current,
                [payload.section]: { content: "", status: "streaming" },
              }));
              break;
            case "delta":
              setSections((current) => ({
                ...current,
                [payload.section]: {
                  content: `${(current[payload.section] ?? EMPTY).content}${payload.text}`,
                  status: "streaming",
                },
              }));
              break;
            case "section_done":
              setDraftProgress((current) => (current ? { ...current, written: current.written + 1 } : current));
              setSections((current) => ({
                ...current,
                [payload.section]: {
                  content: payload.content,
                  status: "ready",
                  citations: payload.citations,
                },
              }));
              break;
            case "section_error":
              setSections((current) => ({
                ...current,
                [payload.section]: {
                  content: before(payload.section).content,
                  status: before(payload.section).content ? "ready" : "error",
                  error: payload.message,
                },
              }));
              setDraftProgress((current) => (current ? { ...current, written: current.written + 1 } : current));
              alert.error(
                `${plannedSections.find((item) => item.key === payload.section)?.title ?? "A section"} didn't draft`,
                `${payload.message} The other sections carry on; revise this one when the draft finishes.`,
              );
              break;
            case "section_checked":
              setSections((current) => ({
                ...current,
                [payload.section]: { ...(current[payload.section] ?? EMPTY), citations: payload.citations },
              }));
              break;
            case "meta_start":
              setDraftProgress((current) => (current ? { ...current, coverage: true } : current));
              setCoverageStreaming(true);
              setCoverageMap("");
              break;
            case "meta_delta":
              setCoverageMap((current) => `${current}${payload.text}`);
              break;
            case "meta_done":
              setCoverageStreaming(false);
              break;
            case "done":
              finished = true;
              break;
            case "error":
              throw new Error(payload.message);
          }
        }
      }

      if (!finished) {
        // The connection dropped or the server hit its time limit mid-draft.
        throw new Error(
          "Drafting stopped before it finished. Sections marked ready were saved; regenerate or revise the rest.",
        );
      }

      router.refresh();
    } catch (generateError) {
      alert.error(
        revision ? "The revision didn't finish" : "Drafting didn't finish",
        generateError instanceof Error ? generateError.message : "Drafting failed.",
      );
      // Restore anything that was mid-stream when the request died.
      setSections((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(next)) {
          if (value.status === "streaming") {
            next[key] = before(key).content
              ? before(key)
              : { content: value.content, status: value.content ? "ready" : "idle" };
          }
        }
        return next;
      });
    } finally {
      setGenerating(false);
      setPhase(null);
      setDraftProgress(null);
      setCoverageStreaming(false);
    }
  };

  const runExport = async (format: DownloadFormat) => {
    if (!canExport || exportPhase === "generating") return;

    // The review copy is for checking these, so it never asks.
    const warnings = exportVariant === "review" && format !== "sheet" ? [] : [
      uncitedTotal > 0
        ? `${uncitedTotal} statement${uncitedTotal === 1 ? " needs" : "s need"} checking: claims with no source in your library, figures found in neither your library nor the RFP, absolute claims, or notes to you left in the text (listed under "Needs your input"). Make sure each one is true.`
        : "",
      placeholderTotal > 0
        ? `${placeholderTotal} item${placeholderTotal === 1 ? "" : "s"} still need your input (highlighted in yellow).`
        : "",
      unverifiedClaims.length > 0
        ? `The draft mentions ${unverifiedClaims.map(([name]) => name).join(", ")}, which your library does not support. Check you are not claiming something you do not hold.`
        : "",
      ...coverIssues,
      conflicts.length > 0
        ? `The draft quotes different prices for the same thing: ${conflicts
            .map((conflict) => `per ${conflict.unit}: ${conflict.amounts.map((item) => `${item.amount} (${item.where.join(", ")})`).join(" vs ")}`)
            .join("; ")}. Make them consistent unless they are different services.`
        : "",
    ].filter(Boolean);
    if (
      warnings.length > 0 &&
      !(await alert.confirm({
        tone: "warning",
        title: "Check these before you export",
        text: warnings.join("\n\n"),
        confirmLabel: "Export anyway",
        cancelLabel: "Go back and fix",
      }))
    ) {
      return;
    }

    setExportFormat(format);
    setExportPhase("generating");
    setExportProgress(8);

    const progressTimer = window.setInterval(() => {
      setExportProgress((current) =>
        current >= 92 ? current : current + 6 + Math.random() * 8,
      );
    }, 280);

    try {
      const [result] = await Promise.all([
        downloadRfpExport(rfpId, format, {
          complianceMatrix: includeMatrix && coverageMap.trim().length > 0,
          variant: format === "sheet" ? "submission" : exportVariant,
        }),
        wait(reduceMotion ? 0 : 1600),
      ]);
      setUnansweredRows(result.unanswered);
      setPageWarning(result.pageWarning);
      setExportProgress(100);
      setExportPhase("ready");
      router.refresh();
    } catch (exportErr) {
      setExportPhase("error");
      alert.error("Export failed", exportErr instanceof Error ? exportErr.message : "Export failed.");
    } finally {
      window.clearInterval(progressTimer);
    }
  };

  useEffect(() => {
    if (!autoStart || startedRef.current || hasAnyContent || fullDraftsLeft <= 0) return;
    startedRef.current = true;
    void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount when empty
  }, [autoStart, hasAnyContent]);

  const jumpTo = (section: string) => {
    setModes((current) => ({ ...current, [section]: "edit" }));
    document
      .getElementById(`section-${section}`)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const showExportMoment = exportPhase === "generating" || exportPhase === "ready";
  const formatName =
    exportFormat === "sheet"
      ? spreadsheet === "csv"
        ? "answered CSV file"
        : "answered spreadsheet"
      : exportFormat === "pdf"
        ? "PDF"
        : "Word document";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Proposal draft</p>
          <h2 className="mt-2 font-sans text-xl font-semibold text-ink">{rfpTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
            DraftBid AI reads the full RFP, plans the bid, writes each section from
            your library, then checks the draft against every requirement. Review
            each section, fill the highlighted items, revise anything with AI, then
            export.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={hasAnyContent ? "secondary" : "primary"}
            onClick={async () => {
              if (
                hasAnyContent &&
                !(await alert.confirm({
                  title: "Regenerate the whole proposal?",
                  text: "This replaces every section, including your manual edits. It uses one of your full drafts.",
                  confirmLabel: "Regenerate",
                  destructive: true,
                }))
              ) {
                return;
              }
              void runGeneration();
            }}
            disabled={generating || exportPhase === "generating" || fullDraftsLeft <= 0}
            className="w-full gap-2 sm:w-fit"
          >
            {generating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {generating ? "Generating…" : hasAnyContent ? "Regenerate all" : "Generate draft"}
          </Button>

          <Button
            type="button"
            variant="accent"
            onClick={() => void runExport("docx")}
            disabled={!canExport || exportPhase === "generating"}
            className="w-full gap-2 sm:w-fit"
          >
            <FileDown className="h-4 w-4" aria-hidden />
            Export Word (.docx)
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void runExport("pdf")}
            disabled={!canExport || exportPhase === "generating"}
            className="w-full gap-2 sm:w-fit"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Export PDF
          </Button>
          {spreadsheet && plannedSections.some((item) => item.kind === "responses" && sections(item.key).content.trim()) ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void runExport("sheet")}
              disabled={!canExport || exportPhase === "generating"}
              className="w-full gap-2 sm:w-fit"
            >
              <Table2 className="h-4 w-4" aria-hidden />
              Export answered {spreadsheet === "csv" ? "CSV" : "spreadsheet (.xlsx)"}
            </Button>
          ) : null}
        </div>

        {pageLimit ? (
          <p className="text-sm text-slate">
            Page limit: <span className="text-ink">“{pageLimit.source}”</span>. Each export is checked against{" "}
            {pageLimit.pages} pages.
          </p>
        ) : null}

        <fieldset className="flex flex-col gap-2 text-sm text-slate">
          <legend className="sr-only">Which copy to export</legend>
          <label className="inline-flex w-fit items-center gap-2">
            <input
              type="radio"
              name="export-variant"
              checked={exportVariant === "submission"}
              onChange={() => setExportVariant("submission")}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Submission copy: clean, without source markers
          </label>
          <label className="inline-flex w-fit items-center gap-2">
            <input
              type="radio"
              name="export-variant"
              checked={exportVariant === "review"}
              onChange={() => setExportVariant("review")}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Internal review copy: source markers plus an appendix of sources and open items
          </label>
        </fieldset>

        {coverageMap.trim() && !coverageStreaming ? (
          <label className="inline-flex w-fit items-center gap-2 text-sm text-slate">
            <input
              type="checkbox"
              checked={includeMatrix}
              onChange={(event) => setIncludeMatrix(event.target.checked)}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Include a compliance matrix appendix (recommended for public-sector bids)
          </label>
        ) : null}

        <p className="font-mono text-xs tracking-wide text-slate">
          Full drafts: {allowance.fullDrafts.used} of {allowance.fullDrafts.limit} used ·
          Section revisions: {allowance.revisions.used} of {allowance.revisions.limit} used
          {fullDraftsLeft <= 0 ? " · Use “Revise with AI” on individual sections" : ""}
        </p>
      </div>

      {generating && draftProgress && phase ? (
        <ProgressPanel
          eyebrow="Drafting your proposal"
          steps={draftSteps(phase, draftProgress, plannedSections.length)}
          startedAt={draftProgress.startedAt}
          hint="A full proposal takes one to three minutes. Sections appear below as they are written."
        />
      ) : null}

      {!generating && unverifiedClaims.length > 0 ? (
        <div
          role="status"
          className="rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink"
        >
          <p className="font-semibold">Check these credentials before you submit</p>
          <p className="mt-1 text-slate">
            The draft mentions them, but your content library does not. If you do not hold one, remove the
            claim; if you do, add the certificate or report to your library so future drafts can use it.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {unverifiedClaims.map(([name, where]) => (
              <li key={name}>
                <span className="font-semibold">{name}</span>
                <span className="text-slate"> (in {[...new Set(where)].join(", ")})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!generating && hasAnyContent && coverIssues.length > 0 ? (
        <div role="status" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">Check the cover and dates</p>
          <ul className="mt-2 list-disc pl-5">
            {coverIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!generating && conflicts.length > 0 ? (
        <div role="status" className="rounded-control border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink">
          <p className="font-semibold">The same price is stated differently</p>
          <p className="mt-1 text-slate">
            Evaluators check prices against each other. Make these consistent, unless they are prices for different services.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {conflicts.map((conflict) => (
              <li key={conflict.unit}>
                <span className="font-semibold">Per {conflict.unit}:</span>{" "}
                {conflict.amounts.map((item) => `${item.amount} in ${item.where.join(", ")}`).join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showExportMoment ? (
        <Card className="overflow-hidden" aria-live="polite" aria-busy={exportPhase === "generating"}>
          <div className="flex flex-col items-center gap-6 px-4 py-8 text-center sm:px-8">
            <ExportDocumentMoment mode={exportPhase === "ready" ? "ready" : "generating"} />
            <div className="max-w-md">
              <p className="font-mono text-xs tracking-wide text-slate uppercase">
                {exportPhase === "ready" ? "Exported" : "Exporting"}
              </p>
              <h3 className="mt-2 font-sans text-lg font-semibold text-ink">
                {exportPhase === "ready" ? "Download ready" : `Building your ${formatName}`}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {exportPhase === "ready"
                  ? exportFormat === "sheet"
                    ? `Your answers are in the ${spreadsheet === "csv" ? "CSV file" : "workbook"}, one per question row.${
                        unansweredRows ? ` ${unansweredRows} question row${unansweredRows === 1 ? " was" : "s were"} left empty: check them before you send it.` : ""
                      }`
                    : exportVariant === "review"
                    ? `Your internal review ${formatName} has downloaded. Do not send it to the buyer; export the submission copy when you are done.`
                    : `Your ${formatName} has downloaded. You can keep editing and export again anytime.`
                  : "Adding a cover page, contents, page numbers, and formatted tables."}
              </p>
            </div>

            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-control bg-border">
              <div
                className="h-full rounded-control bg-brand transition-[width] duration-hover ease-out"
                style={{ width: `${exportPhase === "ready" ? 100 : Math.min(exportProgress, 96)}%` }}
              />
            </div>

            {exportPhase === "ready" && pageWarning ? (
              <p role="alert" className="max-w-md rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-left text-sm text-ink">
                <strong>Over the page limit.</strong> {pageWarning}
              </p>
            ) : null}

            {exportPhase === "ready" ? (
              <Button type="button" variant="secondary" onClick={() => setExportPhase("idle")}>
                Continue editing
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {legacyDraft && hasAnyContent && !generating ? (
        <div className="rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <strong>This draft was written by an earlier version of DraftBid AI.</strong> Click
          “Regenerate all” to get the cover letter, bid plan, compliance review, and a
          structure that follows the RFP&apos;s own outline.
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {hasAnyContent && !generating ? (
          <CoverDetailsCard key={JSON.stringify(cover)} rfpId={rfpId} initialCover={cover} />
        ) : null}

        {hasAnyContent && !generating ? (
          <InputChecklist
            rfpId={rfpId}
            sections={plannedSections}
            state={sectionState}
            onJump={jumpTo}
            onCitations={updateCitations}
          />
        ) : null}

        {coverageStreaming || coverageMap.trim() ? (
          <CoverageMapCard markdown={coverageMap} streaming={coverageStreaming} />
        ) : null}


        {plannedSections.map((section) => (
          <DraftSectionCard
            key={section.key}
            rfpId={rfpId}
            section={section.key}
            title={section.title}
            kind={section.kind}
            state={sections(section.key)}
            busy={generating}
            revisionsLeft={allowance.revisions.limit - allowance.revisions.used}
            mode={modes[section.key] ?? "preview"}
            onModeChange={(mode) => setModes((current) => ({ ...current, [section.key]: mode }))}
            onRevise={(name, instruction) => void runGeneration({ section: name, instruction })}
            onCitations={updateCitations}
            onContentChange={(name, content) =>
              setSections((current) => ({
                ...current,
                [name]: { ...(current[name] ?? EMPTY), content, status: "ready" },
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}

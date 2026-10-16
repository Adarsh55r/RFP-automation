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
  Wand2,
} from "lucide-react";
import { ExportDocumentMoment } from "@/components/dashboard/export-document-moment";
import { CoverageMapCard } from "@/components/dashboard/coverage-map-card";
import { CoverDetailsCard } from "@/components/dashboard/cover-details-card";
import { MarkdownPreview } from "@/components/dashboard/markdown-preview";
import { saveDraftSection } from "@/lib/actions/rfp-draft";
import { downloadRfpExport } from "@/lib/download-rfp-export";
import { findPlaceholders } from "@/lib/markdown";
import type { ExportFormat } from "@/lib/proposal-document";
import { DRAFT_SECTIONS, draftSectionLabel, type CoverDetails } from "@/lib/rfp-draft";
import type { Draft, DraftSection } from "@/lib/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonText } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

type SectionState = {
  content: string;
  status: "idle" | "streaming" | "ready" | "error";
  error?: string;
};

type DraftPhase = "planning" | "writing" | "reviewing";

type StreamEvent =
  | { type: "phase"; phase: DraftPhase }
  | { type: "section_start"; section: DraftSection; label: string }
  | { type: "delta"; section: DraftSection; text: string }
  | { type: "section_done"; section: DraftSection; content: string }
  | { type: "section_error"; section: DraftSection; message: string }
  | { type: "meta_start"; block: string }
  | { type: "meta_delta"; block: string; text: string }
  | { type: "meta_done"; block: string }
  | { type: "done" }
  | { type: "error"; message: string };

type ExportPhase = "idle" | "generating" | "ready" | "error";

const phaseCopy: Record<DraftPhase, string> = {
  planning: "Reading the full RFP and planning the bid…",
  writing: "Writing each section from the RFP and your library…",
  reviewing: "Checking the draft against every requirement…",
};

const revisionPresets = [
  "More specific to this buyer",
  "Shorter and tighter",
  "More persuasive",
  "Use UK English",
  "Simpler language",
];

function emptySections(): Record<DraftSection, SectionState> {
  return Object.fromEntries(
    DRAFT_SECTIONS.map((section) => [section, { content: "", status: "idle" }]),
  ) as Record<DraftSection, SectionState>;
}

function sectionsFromDrafts(drafts: Draft[]): Record<DraftSection, SectionState> {
  const next = emptySections();
  for (const draft of drafts) {
    next[draft.sectionName] = { content: draft.content, status: "ready" };
  }
  return next;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function DraftSectionCard({
  rfpId,
  section,
  state,
  busy,
  mode,
  onModeChange,
  onContentChange,
  onRevise,
}: {
  rfpId: string;
  section: DraftSection;
  state: SectionState;
  busy: boolean;
  mode: "preview" | "edit";
  onModeChange: (mode: "preview" | "edit") => void;
  onContentChange: (section: DraftSection, content: string) => void;
  onRevise: (section: DraftSection, instruction: string) => void;
}) {
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

    setSaveError(null);
    startTransition(async () => {
      const result = await saveDraftSection({ rfpId, sectionName: section, content: next });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      baselineRef.current = next;
      setSaveFlash(true);
      window.setTimeout(() => setSaveFlash(false), 1400);
    });
  };

  const streaming = state.status === "streaming";
  const placeholders = useMemo(() => findPlaceholders(state.content), [state.content]);
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
            {draftSectionLabel[section]}
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
                disabled={busy}
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
            {section === "responses"
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
          <MarkdownPreview markdown={state.content} />
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
            aria-label={`${draftSectionLabel[section]} draft`}
          />
          <p className="text-xs text-slate">
            Markdown: <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code>,
            tables with <code>|</code>. Anything in <code>[[double brackets]]</code> is
            highlighted as still needing your input. Changes save when you leave the field.
          </p>
        </>
      ) : null}

      {state.status === "error" ? (
        <p className="text-sm text-danger">{state.error ?? "This section failed to draft."}</p>
      ) : null}

      {!streaming && !hasContent && state.status !== "error" ? (
        <p className="text-sm text-slate">Waiting to generate…</p>
      ) : null}

      {saveError ? <p className="text-sm text-danger">{saveError}</p> : null}
    </Card>
  );
}

function InputChecklist({
  sections,
  state,
  onJump,
}: {
  sections: DraftSection[];
  state: Record<DraftSection, SectionState>;
  onJump: (section: DraftSection) => void;
}) {
  const groups = sections
    .map((section) => ({ section, items: findPlaceholders(state[section].content) }))
    .filter((group) => group.items.length > 0);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Before you submit</p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">Needs your input</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            Facts DraftWin could not find in the RFP or your library — signatures,
            prices, reference contacts, figures to confirm. They are highlighted in
            yellow in the preview and in the exported file.
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
                {draftSectionLabel[group.section]}
              </button>
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
  sections: plannedSections,
  initialDrafts,
  initialCoverageMap,
  autoStart,
  cover,
  legacyDraft,
}: {
  rfpId: string;
  rfpTitle: string;
  sections: DraftSection[];
  initialDrafts: Draft[];
  initialCoverageMap?: string | null;
  autoStart: boolean;
  cover: CoverDetails;
  /** Drafted before bid plans existed: no cover letter, plan, or new structure. */
  legacyDraft: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [sections, setSections] = useState(() => sectionsFromDrafts(initialDrafts));
  const [modes, setModes] = useState<Partial<Record<DraftSection, "preview" | "edit">>>({});
  const [coverageMap, setCoverageMap] = useState(initialCoverageMap ?? "");
  const [coverageStreaming, setCoverageStreaming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<DraftPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("docx");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [includeMatrix, setIncludeMatrix] = useState(true);
  const startedRef = useRef(false);

  const hasAnyContent = plannedSections.some(
    (section) => sections[section].content.trim().length > 0,
  );
  const canExport = !generating && hasAnyContent;
  const placeholderTotal = plannedSections.reduce(
    (sum, section) => sum + findPlaceholders(sections[section].content).length,
    0,
  );

  const runGeneration = async (revision?: { section: DraftSection; instruction: string }) => {
    setGenerating(true);
    setError(null);
    setExportPhase("idle");
    setCoverageMap("");
    setCoverageStreaming(false);

    // Keep the current text so a failed revision can be put back.
    const previous = sections;
    if (revision) {
      setModes((current) => ({ ...current, [revision.section]: "preview" }));
    } else {
      setSections(emptySections());
      setModes({});
    }

    try {
      const response = await fetch(`/api/rfps/${rfpId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          revision
            ? { ...revision, currentContent: previous[revision.section].content }
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
            case "section_start":
              setSections((current) => ({
                ...current,
                [payload.section]: { content: "", status: "streaming" },
              }));
              break;
            case "delta":
              setSections((current) => ({
                ...current,
                [payload.section]: {
                  content: `${current[payload.section].content}${payload.text}`,
                  status: "streaming",
                },
              }));
              break;
            case "section_done":
              setSections((current) => ({
                ...current,
                [payload.section]: { content: payload.content, status: "ready" },
              }));
              break;
            case "section_error":
              setSections((current) => ({
                ...current,
                [payload.section]: {
                  content: previous[payload.section].content,
                  status: previous[payload.section].content ? "ready" : "error",
                  error: payload.message,
                },
              }));
              setError(`${draftSectionLabel[payload.section]}: ${payload.message}`);
              break;
            case "meta_start":
              setCoverageStreaming(true);
              setCoverageMap("");
              break;
            case "meta_delta":
              setCoverageMap((current) => `${current}${payload.text}`);
              break;
            case "meta_done":
              setCoverageStreaming(false);
              break;
            case "error":
              throw new Error(payload.message);
          }
        }
      }

      router.refresh();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Drafting failed.");
      // Restore anything that was mid-stream when the request died.
      setSections((current) => {
        const next = { ...current };
        for (const section of DRAFT_SECTIONS) {
          if (next[section].status === "streaming") {
            next[section] = previous[section].content
              ? previous[section]
              : { content: next[section].content, status: next[section].content ? "ready" : "idle" };
          }
        }
        return next;
      });
    } finally {
      setGenerating(false);
      setPhase(null);
      setCoverageStreaming(false);
    }
  };

  const runExport = async (format: ExportFormat) => {
    if (!canExport || exportPhase === "generating") return;

    if (
      placeholderTotal > 0 &&
      !window.confirm(
        `${placeholderTotal} item${placeholderTotal === 1 ? "" : "s"} still need your input (highlighted in yellow). Export anyway?`,
      )
    ) {
      return;
    }

    setExportFormat(format);
    setExportPhase("generating");
    setExportError(null);
    setExportProgress(8);

    const progressTimer = window.setInterval(() => {
      setExportProgress((current) =>
        current >= 92 ? current : current + 6 + Math.random() * 8,
      );
    }, 280);

    try {
      await Promise.all([
        downloadRfpExport(rfpId, format, {
          complianceMatrix: includeMatrix && coverageMap.trim().length > 0,
        }),
        wait(reduceMotion ? 0 : 1600),
      ]);
      setExportProgress(100);
      setExportPhase("ready");
      router.refresh();
    } catch (exportErr) {
      setExportPhase("error");
      setExportError(exportErr instanceof Error ? exportErr.message : "Export failed.");
    } finally {
      window.clearInterval(progressTimer);
    }
  };

  useEffect(() => {
    if (!autoStart || startedRef.current || hasAnyContent) return;
    startedRef.current = true;
    void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount when empty
  }, [autoStart, hasAnyContent]);

  const jumpTo = (section: DraftSection) => {
    setModes((current) => ({ ...current, [section]: "edit" }));
    document
      .getElementById(`section-${section}`)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const showExportMoment = exportPhase === "generating" || exportPhase === "ready";
  const formatName = exportFormat === "pdf" ? "PDF" : "Word document";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Proposal draft</p>
          <h2 className="mt-2 font-sans text-xl font-semibold text-ink">{rfpTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
            DraftWin reads the full RFP, plans the bid, writes each section from
            your library, then checks the draft against every requirement. Review
            each section, fill the highlighted items, revise anything with AI, then
            export.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={hasAnyContent ? "secondary" : "primary"}
            onClick={() => {
              if (
                hasAnyContent &&
                !window.confirm(
                  "Regenerate the whole proposal? This replaces every section, including your manual edits.",
                )
              ) {
                return;
              }
              void runGeneration();
            }}
            disabled={generating || exportPhase === "generating"}
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
            variant="secondary"
            onClick={() => void runExport("pdf")}
            disabled={!canExport || exportPhase === "generating"}
            className="w-full gap-2 sm:w-fit"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Export PDF
          </Button>
        </div>

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

        {phase ? (
          <p
            className="inline-flex items-center gap-2 font-mono text-xs tracking-wide text-brand"
            aria-live="polite"
          >
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {phaseCopy[phase]} This can take one to three minutes.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {exportError ? (
        <p className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {exportError}
        </p>
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
                  ? `Your ${formatName} has downloaded. You can keep editing and export again anytime.`
                  : "Adding a cover page, contents, page numbers, and formatted tables."}
              </p>
            </div>

            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-control bg-border">
              <div
                className="h-full rounded-control bg-brand transition-[width] duration-hover ease-out"
                style={{ width: `${exportPhase === "ready" ? 100 : Math.min(exportProgress, 96)}%` }}
              />
            </div>

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
          <strong>This draft was written by an earlier version of DraftWin.</strong> Click
          “Regenerate all” to get the cover letter, bid plan, benefit call-outs, compliance
          review, and the current proposal structure.
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        {hasAnyContent && !generating ? (
          <CoverDetailsCard key={JSON.stringify(cover)} rfpId={rfpId} initialCover={cover} />
        ) : null}

        {hasAnyContent && !generating ? (
          <InputChecklist sections={plannedSections} state={sections} onJump={jumpTo} />
        ) : null}

        {coverageStreaming || coverageMap.trim() ? (
          <CoverageMapCard markdown={coverageMap} streaming={coverageStreaming} />
        ) : null}

        {generating && phase === "planning" ? (
          <Card className="flex flex-col gap-4" aria-busy="true">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">Planning</p>
            <p className="font-sans text-base font-semibold text-ink">
              Identifying the buyer, their priorities, and your win themes…
            </p>
            <SkeletonText lines={4} />
          </Card>
        ) : null}

        {plannedSections.map((section) => (
          <DraftSectionCard
            key={section}
            rfpId={rfpId}
            section={section}
            state={sections[section]}
            busy={generating}
            mode={modes[section] ?? "preview"}
            onModeChange={(mode) => setModes((current) => ({ ...current, [section]: mode }))}
            onRevise={(name, instruction) => void runGeneration({ section: name, instruction })}
            onContentChange={(name, content) =>
              setSections((current) => ({
                ...current,
                [name]: { ...current[name], content, status: "ready" },
              }))
            }
          />
        ))}
      </div>
    </div>
  );
}

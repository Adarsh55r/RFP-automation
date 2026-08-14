"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Check, FileDown, LoaderCircle, Sparkles } from "lucide-react";
import { ExportDocumentMoment } from "@/components/dashboard/export-document-moment";
import { saveDraftSection } from "@/lib/actions/rfp-draft";
import {
  DRAFT_SECTIONS,
  draftSectionLabel,
} from "@/lib/rfp-draft";
import type { Draft, DraftSection } from "@/lib/generated/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SkeletonText } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type SectionState = {
  content: string;
  status: "idle" | "streaming" | "ready" | "saving" | "saved" | "error";
  error?: string;
};

type StreamEvent =
  | { type: "section_start"; section: DraftSection; label: string }
  | { type: "delta"; section: DraftSection; text: string }
  | { type: "section_done"; section: DraftSection }
  | { type: "done" }
  | { type: "error"; message: string };

type ExportPhase = "idle" | "generating" | "ready" | "error";

function emptySections(): Record<DraftSection, SectionState> {
  return {
    exec_summary: { content: "", status: "idle" },
    technical_approach: { content: "", status: "idle" },
    team: { content: "", status: "idle" },
    pricing: { content: "", status: "idle" },
  };
}

function sectionsFromDrafts(drafts: Draft[]): Record<DraftSection, SectionState> {
  const next = emptySections();
  for (const draft of drafts) {
    next[draft.sectionName] = {
      content: draft.content,
      status: "ready",
    };
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
  onContentChange,
}: {
  rfpId: string;
  section: DraftSection;
  state: SectionState;
  onContentChange: (section: DraftSection, content: string) => void;
}) {
  const [saveFlash, setSaveFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const baselineRef = useRef(state.content);

  useEffect(() => {
    baselineRef.current = state.content;
  }, [state.content, state.status]);

  const handleBlur = () => {
    const next = state.content.trim();
    if (!next || next === baselineRef.current.trim()) {
      return;
    }
    if (state.status === "streaming") {
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      const result = await saveDraftSection({
        rfpId,
        sectionName: section,
        content: next,
      });

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
  const showEditor = state.content.length > 0 || state.status === "ready";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            Section
          </p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">
            {draftSectionLabel[section]}
          </h2>
        </div>

        <div className="flex min-h-8 items-center gap-2">
          {streaming ? (
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-wide text-brand">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Writing…
            </span>
          ) : null}
          {pending ? (
            <span className="font-mono text-xs tracking-wide text-slate">
              Saving…
            </span>
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
        </div>
      </div>

      {streaming && !state.content ? <SkeletonText lines={5} /> : null}

      {showEditor ? (
        <Textarea
          value={state.content}
          onChange={(event) => onContentChange(section, event.target.value)}
          onBlur={handleBlur}
          rows={section === "pricing" ? 10 : 8}
          disabled={streaming}
          className={cn(
            "min-h-40 font-sans text-sm leading-relaxed",
            streaming && "opacity-90",
          )}
          aria-label={`${draftSectionLabel[section]} draft`}
        />
      ) : null}

      {!streaming && !showEditor ? (
        <p className="text-sm text-slate">Waiting to generate…</p>
      ) : null}

      {saveError ? (
        <p className="text-sm text-danger">{saveError}</p>
      ) : null}
    </Card>
  );
}

export function RfpDraftView({
  rfpId,
  rfpTitle,
  initialDrafts,
  autoStart,
}: {
  rfpId: string;
  rfpTitle: string;
  initialDrafts: Draft[];
  autoStart: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [sections, setSections] = useState(() =>
    sectionsFromDrafts(initialDrafts),
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportPhase, setExportPhase] = useState<ExportPhase>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [visibleOrder, setVisibleOrder] = useState<DraftSection[]>(() =>
    DRAFT_SECTIONS.filter((section) =>
      initialDrafts.some((draft) => draft.sectionName === section),
    ),
  );
  const startedRef = useRef(false);

  const hasAnyContent = DRAFT_SECTIONS.some(
    (section) => sections[section].content.trim().length > 0,
  );

  const canExport =
    !generating &&
    DRAFT_SECTIONS.every(
      (section) => sections[section].content.trim().length > 0,
    );

  const runGeneration = async () => {
    setGenerating(true);
    setError(null);
    setExportPhase("idle");
    setVisibleOrder([]);
    setSections(emptySections());

    try {
      const response = await fetch(`/api/rfps/${rfpId}/draft`, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not start drafting.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .map((item) => item.trim())
            .find((item) => item.startsWith("data:"));
          if (!line) {
            continue;
          }

          const payload = JSON.parse(line.slice(5).trim()) as StreamEvent;

          if (payload.type === "section_start") {
            setVisibleOrder((current) =>
              current.includes(payload.section)
                ? current
                : [...current, payload.section],
            );
            setSections((current) => ({
              ...current,
              [payload.section]: {
                content: "",
                status: "streaming",
              },
            }));
          }

          if (payload.type === "delta") {
            setSections((current) => ({
              ...current,
              [payload.section]: {
                ...current[payload.section],
                content: `${current[payload.section]?.content ?? ""}${payload.text}`,
                status: "streaming",
              },
            }));
          }

          if (payload.type === "section_done") {
            setSections((current) => ({
              ...current,
              [payload.section]: {
                ...current[payload.section],
                status: "ready",
              },
            }));
          }

          if (payload.type === "error") {
            throw new Error(payload.message);
          }
        }
      }

      router.refresh();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Drafting failed.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const runExport = async () => {
    if (!canExport || exportPhase === "generating") {
      return;
    }

    setExportPhase("generating");
    setExportError(null);
    setExportProgress(8);

    const progressTimer = window.setInterval(() => {
      setExportProgress((current) =>
        current >= 92 ? current : current + 6 + Math.random() * 8,
      );
    }, 280);

    try {
      const [response] = await Promise.all([
        fetch(`/api/rfps/${rfpId}/export`, { method: "POST" }),
        wait(reduceMotion ? 0 : 2400),
      ]);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Could not export DOCX.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? "proposal-draftwin.docx";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setExportPhase("ready");
      router.refresh();
    } catch (exportErr) {
      setExportPhase("error");
      setExportError(
        exportErr instanceof Error ? exportErr.message : "Export failed.",
      );
    } finally {
      window.clearInterval(progressTimer);
    }
  };

  useEffect(() => {
    if (!autoStart || startedRef.current || hasAnyContent) {
      return;
    }
    startedRef.current = true;
    void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once on mount when empty
  }, [autoStart, hasAnyContent]);

  const orderedSections =
    visibleOrder.length > 0
      ? visibleOrder
      : hasAnyContent
        ? DRAFT_SECTIONS.filter((section) => sections[section].content)
        : DRAFT_SECTIONS;

  const showExportMoment =
    exportPhase === "generating" || exportPhase === "ready";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            Proposal draft
          </p>
          <h2 className="mt-2 font-sans text-xl font-semibold text-ink">
            {rfpTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
            Sections stream in as the model writes them, grounded in your
            extracted requirements and Content Library. Click any section to
            edit — changes autosave when you leave the field.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={hasAnyContent ? "secondary" : "primary"}
            onClick={() => void runGeneration()}
            disabled={generating || exportPhase === "generating"}
            className="w-full gap-2 sm:w-fit"
          >
            {generating ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {generating
              ? "Generating…"
              : hasAnyContent
                ? "Regenerate draft"
                : "Generate draft"}
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => void runExport()}
            disabled={!canExport || exportPhase === "generating"}
            className="w-full gap-2 bg-accent text-ink sm:w-fit"
          >
            {exportPhase === "generating" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden />
            )}
            {exportPhase === "generating" ? "Exporting…" : "Export as DOCX"}
          </Button>
        </div>
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
        <Card
          className="overflow-hidden"
          aria-live="polite"
          aria-busy={exportPhase === "generating"}
        >
          <div className="flex flex-col items-center gap-6 px-4 py-8 text-center sm:px-8">
            <ExportDocumentMoment
              mode={exportPhase === "ready" ? "ready" : "generating"}
            />
            <div className="max-w-md">
              <p className="font-mono text-xs tracking-wide text-slate uppercase">
                {exportPhase === "ready" ? "Exported" : "Exporting"}
              </p>
              <h3 className="mt-2 font-sans text-lg font-semibold text-ink">
                {exportPhase === "ready"
                  ? "Download ready"
                  : "Turning drafts into a proposal pack"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {exportPhase === "ready"
                  ? "Your Word document is downloaded. Status is marked exported — you can export again anytime."
                  : "Stacking your four sections into a clean cover page and professional headings."}
              </p>
            </div>

            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-control bg-border">
              <div
                className="h-full rounded-control bg-brand transition-[width] duration-hover ease-out"
                style={{
                  width: `${exportPhase === "ready" ? 100 : Math.min(exportProgress, 96)}%`,
                }}
              />
            </div>

            {exportPhase === "ready" ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setExportPhase("idle")}
              >
                Continue editing
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-6">
        {orderedSections.map((section) => (
          <DraftSectionCard
            key={section}
            rfpId={rfpId}
            section={section}
            state={sections[section]}
            onContentChange={(name, content) =>
              setSections((current) => ({
                ...current,
                [name]: {
                  ...current[name],
                  content,
                  status:
                    current[name].status === "streaming"
                      ? "streaming"
                      : "ready",
                },
              }))
            }
          />
        ))}

        {generating && visibleOrder.length === 0 ? (
          <Card className="flex flex-col gap-4" aria-busy="true">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              Starting draft
            </p>
            <p className="font-sans text-base font-semibold text-ink">
              Reading requirements and your library…
            </p>
            <SkeletonText lines={4} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

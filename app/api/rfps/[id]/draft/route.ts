import { safeErrorSummary } from "@/lib/safe-log";
import { reportError } from "@/lib/monitoring";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { beginAiOperation, refundAllowance } from "@/lib/ai-guard";
import { usageRecorder } from "@/lib/ai-usage";
import {
  analyzeDraft,
  buildSourceIndex,
  parseCitations,
  sourceFromPassage,
  stripCitations,
  type DraftCitations,
} from "@/lib/citations";
import { upsertGeneratedDraftSection } from "@/lib/draft-store";
import { getLibraryItemsForUser } from "@/lib/library-data";
import {
  generateLlmText,
  friendlyLlmError,
  streamLlmText,
  type LlmEffort,
} from "@/lib/llm";
import { normalizeMarkdown } from "@/lib/markdown";
import {
  buildDraftingContext,
  buildPlanTask,
  buildResponsesTask,
  buildReviewTask,
  buildSectionTask,
  draftSectionLabel,
  DRAFTING_SYSTEM,
  hasModelPlan,
  isDraftSection,
  parseDraftPlan,
  RESPONSE_BATCH_SIZE,
  sectionsForRfp,
  type DraftPlan,
  type MetaBlock,
} from "@/lib/rfp-draft";
import { getRfpSourceText } from "@/lib/rfp-extract";
import {
  editableTextToList,
  listToEditableText,
  rfpHasDraftableRequirements,
} from "@/lib/rfp-extract-form";
import {
  DraftSection,
  RfpStatus,
  type Prisma,
} from "@/lib/generated/prisma";

export const runtime = "nodejs";
// Plan, parallel sections, and the compliance review run in one request.
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DraftPhase = "planning" | "writing" | "reviewing";

type StreamEvent =
  | { type: "phase"; phase: DraftPhase }
  | { type: "section_start"; section: DraftSection; label: string }
  | { type: "delta"; section: DraftSection; text: string }
  | { type: "section_done"; section: DraftSection; content: string; citations: DraftCitations }
  | { type: "section_error"; section: DraftSection; message: string }
  | { type: "meta_start"; block: MetaBlock }
  | { type: "meta_delta"; block: MetaBlock; text: string }
  | { type: "meta_done"; block: MetaBlock }
  | { type: "done" }
  | { type: "error"; message: string };

const sectionMaxTokens: Record<DraftSection, number> = {
  cover_letter: 8000,
  exec_summary: 10000,
  technical_approach: 32000,
  team: 16000,
  pricing: 12000,
  responses: 20000,
};

const RESPONSE_BATCH_CONCURRENCY = 3;

function encodeEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Strip wrappers models sometimes add: code fences and a repeated "# Section title". */
function cleanSection(text: string) {
  return normalizeMarkdown(text)
    .trim()
    .replace(/^#\s+[^\n]*\n+/, "")
    .trim();
}

function errorMessage(error: unknown, fallback: string) {
  return friendlyLlmError(error, "drafting", fallback);
}

async function readBody(request: Request) {
  try {
    const body = (await request.json()) as {
      section?: unknown;
      instruction?: unknown;
      currentContent?: unknown;
    };
    return {
      section:
        typeof body.section === "string" && isDraftSection(body.section)
          ? body.section
          : null,
      instruction:
        typeof body.instruction === "string"
          ? body.instruction.trim().slice(0, 1000)
          : "",
      // The editor's latest text, which may not have finished autosaving yet.
      currentContent:
        typeof body.currentContent === "string"
          ? body.currentContent.slice(0, 200_000)
          : null,
    };
  } catch {
    return { section: null, instruction: "", currentContent: null };
  }
}

/** Runs async jobs with a concurrency cap, preserving result order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return Response.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: { select: { tier: true } } },
  });
  if (!user) {
    return Response.json(
      { error: "Complete onboarding before drafting." },
      { status: 403 },
    );
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id, userId: user.id },
  });

  if (!rfp) {
    return Response.json({ error: "RFP not found." }, { status: 404 });
  }

  if (
    rfp.status !== RfpStatus.extracted &&
    rfp.status !== RfpStatus.drafting &&
    rfp.status !== RfpStatus.drafted &&
    rfp.status !== RfpStatus.exported
  ) {
    return Response.json(
      { error: "Confirm extracted requirements before drafting." },
      { status: 400 },
    );
  }

  if (!rfpHasDraftableRequirements(rfp)) {
    return Response.json(
      {
        error:
          "This RFP has no extracted requirements yet. Add a scope, eligibility criteria, or questionnaire items.",
      },
      { status: 400 },
    );
  }

  const { section: onlySection, instruction, currentContent: editorContent } =
    await readBody(request);
  const plannedSections = sectionsForRfp(rfp);
  if (onlySection && !plannedSections.includes(onlySection)) {
    return Response.json(
      { error: "That section is not part of this proposal." },
      { status: 400 },
    );
  }
  const targets = onlySection ? [onlySection] : plannedSections;
  const operation = onlySection ? "revision" : "full_draft";

  const guard = await beginAiOperation({
    user,
    tier: user.subscription?.tier ?? "free",
    rfpId: rfp.id,
    operation,
  });
  if (!guard.ok) {
    return Response.json({ error: guard.error }, { status: guard.status });
  }
  const onUsage = usageRecorder({ userId: user.id, rfpId: rfp.id, action: operation });

  // Everything before streaming starts must release the AI lock if it fails.
  const prepare = async () => {
    await prisma.rfp.update({
      where: { id: rfp.id },
      data: { status: RfpStatus.drafting },
    });

    const [libraryItems, source, existingDrafts] = await Promise.all([
      getLibraryItemsForUser(user.id),
      getRfpSourceText(rfp),
      prisma.draft.findMany({ where: { rfpId: rfp.id } }),
    ]);
    if (source.fetched && source.text) {
      await prisma.rfp.update({
        where: { id: rfp.id },
        data: { sourceText: source.text },
      });
    }

    const companyName = user.agencyName?.trim() || "Our company";
    const sharedContext = buildDraftingContext({
      companyName,
      rfp,
      libraryItems,
      sourceText: source.text,
    });
    const currentContent = new Map(
      existingDrafts.map((draft) => [draft.sectionName, draft.content]),
    );
    if (onlySection && editorContent?.trim()) {
      currentContent.set(onlySection, editorContent);
    }
    const questions = editableTextToList(listToEditableText(rfp.extractedQuestionnaire));
    // Same passage IDs the prompt showed the model, to check its citations against.
    const library = buildSourceIndex(libraryItems);
    const citeLookup = (id: string) => {
      const passage = library.byId.get(id);
      return passage ? sourceFromPassage(passage) : undefined;
    };
    const dismissedClaims = new Map(
      existingDrafts.map((draft) => [draft.sectionName, parseCitations(draft.citations)?.dismissed ?? []]),
    );
    return { sharedContext, currentContent, questions, citeLookup, dismissedClaims };
  };

  let prepared: Awaited<ReturnType<typeof prepare>>;
  try {
    prepared = await prepare();
  } catch (error) {
    await guard.release();
    await refundAllowance(rfp.id, operation);
    console.error("RFP drafting setup failed:", safeErrorSummary(error));
    reportError(error, { area: "draft-setup", userId: user.id, rfpId: rfp.id });
    return Response.json({ error: errorMessage(error, "Drafting failed.") }, { status: 500 });
  }
  const { sharedContext, currentContent, questions, citeLookup, dismissedClaims } = prepared;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          // The browser disconnected; keep going so finished sections are still saved.
        }
      };

      let wroteAnything = false;
      const call = (task: string, maxTokens: number, effort?: LlmEffort, json?: boolean) => ({
        purpose: "drafting" as const,
        system: DRAFTING_SYSTEM,
        context: sharedContext,
        user: task,
        maxTokens,
        effort,
        json,
        onUsage,
      });

      try {
        // 1. Bid plan: buyer details, win themes, required structure. Reused for
        //    single-section revisions so the proposal stays consistent.
        send({ type: "phase", phase: "planning" });
        let plan: DraftPlan;
        const storedPlan = parseDraftPlan(rfp.draftPlan);
        if (onlySection && hasModelPlan(storedPlan)) {
          plan = storedPlan;
        } else {
          const raw = await generateLlmText(call(buildPlanTask(), 8000, undefined, true));
          // Keep the bidder's own cover-page edits across regenerations.
          plan = { ...parseDraftPlan(raw), cover: storedPlan.cover };
          await prisma.rfp.update({
            where: { id: rfp.id },
            data: { draftPlan: plan as unknown as Prisma.InputJsonValue },
          });
        }

        // 2. Sections in parallel, each with its own focused brief.
        send({ type: "phase", phase: "writing" });
        // Passage IDs can change when the library changes, so the model
        // re-cites from the current library instead of keeping old markers.
        const revision = (section: DraftSection) =>
          onlySection
            ? { currentContent: stripCitations(currentContent.get(section) ?? ""), instruction }
            : undefined;

        const writeSection = async (section: DraftSection) => {
          send({ type: "section_start", section, label: draftSectionLabel[section] });

          if (section === "responses") {
            const batches: string[][] = [];
            for (let i = 0; i < questions.length; i += RESPONSE_BATCH_SIZE) {
              batches.push(questions.slice(i, i + RESPONSE_BATCH_SIZE));
            }
            // Batches run concurrently but are shown in question order.
            const texts: string[] = new Array(batches.length).fill("");
            const finished: boolean[] = new Array(batches.length).fill(false);
            let head = 0;
            const separator = "\n\n";

            await mapLimit(batches, RESPONSE_BATCH_CONCURRENCY, async (batch, index) => {
              const rev = revision(section);
              // A single batch can be revised in place; longer questionnaires
              // are re-answered batch by batch with the bidder's instruction.
              const task = buildResponsesTask(
                plan,
                batch,
                rev
                  ? {
                      currentContent: batches.length === 1 ? rev.currentContent : "",
                      instruction: rev.instruction,
                    }
                  : undefined,
              );
              for await (const text of streamLlmText(
                call(task, sectionMaxTokens.responses),
              )) {
                texts[index] += text;
                if (index === head) {
                  send({ type: "delta", section, text });
                }
              }
              finished[index] = true;
              while (head < batches.length && finished[head]) {
                head += 1;
                if (head < batches.length) {
                  send({ type: "delta", section, text: separator + texts[head] });
                }
              }
            });

            return texts.map(cleanSection).filter(Boolean).join(separator);
          }

          let text = "";
          for await (const chunk of streamLlmText(
            call(buildSectionTask(section, plan, revision(section)), sectionMaxTokens[section]),
          )) {
            text += chunk;
            send({ type: "delta", section, text: chunk });
          }
          return cleanSection(text);
        };

        const outcomes = await Promise.all(
          targets.map(async (section) => {
            try {
              const written = await writeSection(section);
              if (!written) throw new Error("The model returned an empty section.");
              const { content, citations } = analyzeDraft(
                written,
                citeLookup,
                dismissedClaims.get(section) ?? [],
              );
              await upsertGeneratedDraftSection({ rfpId: rfp.id, sectionName: section, content, citations });
              currentContent.set(section, content);
              send({ type: "section_done", section, content, citations });
              return true;
            } catch (sectionError) {
              console.error(`Drafting ${section} failed:`, safeErrorSummary(sectionError));
              reportError(sectionError, { area: "draft-section", userId: user.id, rfpId: rfp.id, extra: { section } });
              send({
                type: "section_error",
                section,
                message: errorMessage(sectionError, "This section failed to draft."),
              });
              return false;
            }
          }),
        );

        wroteAnything = outcomes.some(Boolean);
        if (!wroteAnything) {
          throw new Error("Drafting failed for every section. Try again in a moment.");
        }

        // 3. Compliance review of the actual draft against every requirement.
        send({ type: "phase", phase: "reviewing" });
        send({ type: "meta_start", block: "coverage_map" });
        let coverageMap = "";
        try {
          const drafted = plannedSections
            .filter((section) => currentContent.get(section)?.trim())
            .map((section) => ({
              label: draftSectionLabel[section],
              content: stripCitations(currentContent.get(section) ?? ""),
            }));
          for await (const chunk of streamLlmText(
            call(buildReviewTask(plan, drafted), 16000, "low"),
          )) {
            coverageMap += chunk;
            send({ type: "meta_delta", block: "coverage_map", text: chunk });
          }
        } catch (reviewError) {
          console.error("Compliance review failed:", safeErrorSummary(reviewError));
          reportError(reviewError, { area: "draft-review", userId: user.id, rfpId: rfp.id });
        }
        send({ type: "meta_done", block: "coverage_map" });

        await prisma.rfp.update({
          where: { id: rfp.id },
          data: {
            status:
              rfp.status === RfpStatus.exported ? RfpStatus.exported : RfpStatus.drafted,
            ...(coverageMap.trim() ? { coverageMap: coverageMap.trim() } : {}),
          },
        });

        send({ type: "done" });
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      } catch (error) {
        console.error("RFP drafting failed:", safeErrorSummary(error));
        // Nothing usable was produced, so the attempt should not count.
        if (!wroteAnything) await refundAllowance(rfp.id, operation);
        reportError(error, { area: "draft", userId: user.id, rfpId: rfp.id });
        await prisma.rfp
          .update({
            where: { id: rfp.id },
            data: {
              status:
                currentContent.size > 0 ? RfpStatus.drafted : RfpStatus.extracted,
            },
          })
          .catch(() => undefined);
        send({ type: "error", message: errorMessage(error, "Drafting failed.") });
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      } finally {
        await guard.release();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { upsertGeneratedDraftSection } from "@/lib/actions/rfp-draft";
import { getLibraryItemsForUser } from "@/lib/library-data";
import {
  isLlmConfigError,
  llmConfigErrorMessage,
  streamLlmText,
} from "@/lib/llm";
import {
  buildDraftingSystemPrompt,
  buildDraftingUserPrompt,
  DRAFT_END_MARKER,
  DRAFT_SECTIONS,
  draftSectionLabel,
  isDraftSection,
  isMetaBlock,
  META_BLOCKS,
  SECTION_MARKER_PREFIX,
  SECTION_MARKER_SUFFIX,
  type MetaBlock,
} from "@/lib/rfp-draft";
import { rfpHasDraftableRequirements } from "@/lib/rfp-extract-form";
import { DraftSection, RfpStatus } from "@/lib/generated/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StreamEvent =
  | { type: "section_start"; section: DraftSection; label: string }
  | { type: "delta"; section: DraftSection; text: string }
  | { type: "section_done"; section: DraftSection }
  | { type: "meta_start"; block: MetaBlock }
  | { type: "meta_delta"; block: MetaBlock; text: string }
  | { type: "meta_done"; block: MetaBlock }
  | { type: "done" }
  | { type: "error"; message: string };

type ActiveBlock =
  | { kind: "section"; name: DraftSection }
  | { kind: "meta"; name: MetaBlock };

function encodeEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

class SectionStreamParser {
  private buffer = "";
  private current: ActiveBlock | null = null;
  private contents: Partial<Record<DraftSection, string>> = {};
  private meta: Partial<Record<MetaBlock, string>> = {};

  private append(text: string): StreamEvent | null {
    if (!this.current || !text) {
      return null;
    }
    if (this.current.kind === "section") {
      this.contents[this.current.name] =
        (this.contents[this.current.name] ?? "") + text;
      return { type: "delta", section: this.current.name, text };
    }
    this.meta[this.current.name] = (this.meta[this.current.name] ?? "") + text;
    return { type: "meta_delta", block: this.current.name, text };
  }

  private open(name: string): StreamEvent | null {
    if (isDraftSection(name)) {
      this.current = { kind: "section", name };
      this.contents[name] = "";
      return {
        type: "section_start",
        section: name,
        label: draftSectionLabel[name],
      };
    }
    if (isMetaBlock(name)) {
      this.current = { kind: "meta", name };
      this.meta[name] = "";
      return { type: "meta_start", block: name };
    }
    this.current = null;
    return null;
  }

  private close(): StreamEvent | null {
    if (!this.current) {
      return null;
    }
    if (this.current.kind === "section") {
      const event: StreamEvent = {
        type: "section_done",
        section: this.current.name,
      };
      this.current = null;
      return event;
    }
    const event: StreamEvent = {
      type: "meta_done",
      block: this.current.name,
    };
    this.current = null;
    return event;
  }

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    while (true) {
      if (!this.current) {
        const start = this.buffer.indexOf(SECTION_MARKER_PREFIX);
        if (start === -1) {
          // Keep a small tail in case a marker is split across chunks.
          if (this.buffer.length > SECTION_MARKER_PREFIX.length) {
            this.buffer = this.buffer.slice(
              -(SECTION_MARKER_PREFIX.length + 24),
            );
          }
          break;
        }

        const afterPrefix = start + SECTION_MARKER_PREFIX.length;
        const end = this.buffer.indexOf(SECTION_MARKER_SUFFIX, afterPrefix);
        if (end === -1) {
          this.buffer = this.buffer.slice(start);
          break;
        }

        const blockName = this.buffer.slice(afterPrefix, end).trim();
        this.buffer = this.buffer.slice(end + SECTION_MARKER_SUFFIX.length);

        const opened = this.open(blockName);
        if (opened) {
          events.push(opened);
        }
        continue;
      }

      const nextMarker = this.buffer.indexOf(SECTION_MARKER_PREFIX);
      const endMarker = this.buffer.indexOf(DRAFT_END_MARKER);
      let cut = -1;

      if (nextMarker !== -1 && (endMarker === -1 || nextMarker < endMarker)) {
        cut = nextMarker;
      } else if (endMarker !== -1) {
        cut = endMarker;
      }

      if (cut === -1) {
        // Hold back potential partial marker at the end.
        const hold = Math.max(
          SECTION_MARKER_PREFIX.length,
          DRAFT_END_MARKER.length,
        );
        if (this.buffer.length > hold) {
          const emitText = this.buffer.slice(0, -hold);
          this.buffer = this.buffer.slice(-hold);
          const delta = this.append(emitText);
          if (delta) {
            events.push(delta);
          }
        }
        break;
      }

      const emitText = this.buffer.slice(0, cut);
      this.buffer = this.buffer.slice(cut);
      const delta = this.append(emitText);
      if (delta) {
        events.push(delta);
      }

      const closed = this.close();
      if (closed) {
        events.push(closed);
      }

      if (this.buffer.startsWith(DRAFT_END_MARKER)) {
        this.buffer = this.buffer.slice(DRAFT_END_MARKER.length);
        break;
      }
    }

    return events;
  }

  finish(): StreamEvent[] {
    const events: StreamEvent[] = [];
    if (this.current) {
      const names = [...DRAFT_SECTIONS, ...META_BLOCKS].join("|");
      const remaining = this.buffer
        .split(DRAFT_END_MARKER)
        .join("")
        .replace(
          new RegExp(
            `${SECTION_MARKER_PREFIX}(${names})${SECTION_MARKER_SUFFIX}`,
            "g",
          ),
          "",
        );
      const delta = this.append(remaining);
      if (delta) {
        events.push(delta);
      }
      const closed = this.close();
      if (closed) {
        events.push(closed);
      }
    }
    this.buffer = "";
    return events;
  }

  getContent(section: DraftSection) {
    return (this.contents[section] ?? "").trim();
  }

  getMeta(block: MetaBlock) {
    return (this.meta[block] ?? "").trim();
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return Response.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
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

  await prisma.rfp.update({
    where: { id: rfp.id },
    data: { status: RfpStatus.drafting },
  });

  const libraryItems = await getLibraryItemsForUser(user.id);
  const agencyName = user.agencyName ?? "Your agency";
  const parser = new SectionStreamParser();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const llmStream = streamLlmText({
          purpose: "drafting",
          maxTokens: 8192,
          system: buildDraftingSystemPrompt(agencyName),
          user: buildDraftingUserPrompt({
            agencyName,
            rfp,
            libraryItems,
          }),
        });

        for await (const text of llmStream) {
          const parsed = parser.push(text);
          for (const item of parsed) {
            send(item);
            if (item.type === "section_done") {
              await upsertGeneratedDraftSection({
                rfpId: rfp.id,
                userId: user.id,
                sectionName: item.section,
                content: parser.getContent(item.section),
              });
            }
            if (item.type === "meta_done" && item.block === "coverage_map") {
              await prisma.rfp.update({
                where: { id: rfp.id },
                data: { coverageMap: parser.getMeta("coverage_map") },
              });
            }
          }
        }

        const trailing = parser.finish();
        for (const item of trailing) {
          send(item);
          if (item.type === "section_done") {
            await upsertGeneratedDraftSection({
              rfpId: rfp.id,
              userId: user.id,
              sectionName: item.section,
              content: parser.getContent(item.section),
            });
          }
          if (item.type === "meta_done" && item.block === "coverage_map") {
            await prisma.rfp.update({
              where: { id: rfp.id },
              data: { coverageMap: parser.getMeta("coverage_map") },
            });
          }
        }

        // Ensure any completed section content is persisted even if markers were imperfect.
        for (const section of DRAFT_SECTIONS) {
          const content = parser.getContent(section);
          if (content) {
            await upsertGeneratedDraftSection({
              rfpId: rfp.id,
              userId: user.id,
              sectionName: section,
              content,
            });
          }
        }

        const coverageMap = parser.getMeta("coverage_map");
        await prisma.rfp.update({
          where: { id: rfp.id },
          data: {
            status: RfpStatus.drafted,
            ...(coverageMap ? { coverageMap } : {}),
          },
        });

        send({ type: "done" });
        controller.close();
      } catch (error) {
        const message = isLlmConfigError(error)
          ? llmConfigErrorMessage("drafting")
          : error instanceof Error
            ? error.message
            : "Drafting failed.";
        console.error("RFP drafting failed:", error);
        send({ type: "error", message });
        controller.close();
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

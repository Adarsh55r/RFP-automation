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
  SECTION_MARKER_PREFIX,
  SECTION_MARKER_SUFFIX,
} from "@/lib/rfp-draft";
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
  | { type: "done" }
  | { type: "error"; message: string };

function encodeEvent(event: StreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

class SectionStreamParser {
  private buffer = "";
  private current: DraftSection | null = null;
  private contents: Partial<Record<DraftSection, string>> = {};

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

        const sectionName = this.buffer.slice(afterPrefix, end).trim();
        this.buffer = this.buffer.slice(end + SECTION_MARKER_SUFFIX.length);

        if (isDraftSection(sectionName)) {
          this.current = sectionName;
          this.contents[sectionName] = "";
          events.push({
            type: "section_start",
            section: sectionName,
            label: draftSectionLabel[sectionName],
          });
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
          if (emitText) {
            this.contents[this.current] =
              (this.contents[this.current] ?? "") + emitText;
            events.push({
              type: "delta",
              section: this.current,
              text: emitText,
            });
          }
        }
        break;
      }

      const emitText = this.buffer.slice(0, cut);
      this.buffer = this.buffer.slice(cut);
      if (emitText) {
        this.contents[this.current] =
          (this.contents[this.current] ?? "") + emitText;
        events.push({
          type: "delta",
          section: this.current,
          text: emitText,
        });
      }

      events.push({ type: "section_done", section: this.current });
      this.current = null;

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
      const remaining = this.buffer
        .split(DRAFT_END_MARKER)
        .join("")
        .replace(
          new RegExp(
            `${SECTION_MARKER_PREFIX}(${DRAFT_SECTIONS.join("|")})${SECTION_MARKER_SUFFIX}`,
            "g",
          ),
          "",
        );
      if (remaining) {
        this.contents[this.current] =
          (this.contents[this.current] ?? "") + remaining;
        events.push({
          type: "delta",
          section: this.current,
          text: remaining,
        });
      }
      events.push({ type: "section_done", section: this.current });
      this.current = null;
    }
    this.buffer = "";
    return events;
  }

  getContent(section: DraftSection) {
    return (this.contents[section] ?? "").trim();
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

  if (!rfp.extractedScope) {
    return Response.json(
      { error: "This RFP has no extracted requirements yet." },
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

        await prisma.rfp.update({
          where: { id: rfp.id },
          data: { status: RfpStatus.drafted },
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

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import {
  analyzeDraft,
  buildSourceIndex,
  parseCitations,
  sourceFromPassage,
  type CitationSource,
  type DraftCitations,
} from "@/lib/citations";
import { prisma } from "@/lib/db";
import { DraftStatus, RfpStatus, type Prisma } from "@/lib/generated/prisma";
import { draftKey, findSectionDraft } from "@/lib/draft-store";
import { getLibraryItemsForUser } from "@/lib/library-data";
import { proposalOutline } from "@/lib/rfp-draft";

/**
 * Re-checks citations after the user edits a section. Markers keep pointing
 * to the passage they pointed to when drafted; a marker the user adds by hand
 * is checked against the library as it is now.
 */
async function recheckCitations(userId: string, content: string, previous: DraftCitations | null, rfpText: string) {
  const items = await getLibraryItemsForUser(userId);
  const library = buildSourceIndex(items);
  const lookup = (id: string): CitationSource | undefined => {
    const stored = previous?.sources[id];
    if (stored) return stored;
    const passage = library.byId.get(id);
    return passage ? sourceFromPassage(passage) : undefined;
  };
  return analyzeDraft(content, lookup, previous?.dismissed ?? [], {
    libraryText: items.map((item) => `${item.title}\n${item.content}`).join("\n"),
    rfpText,
  });
}

const asJson = (citations: DraftCitations) => citations as unknown as Prisma.InputJsonValue;

export async function saveDraftSection(input: {
  rfpId: string;
  /** The section's key in the proposal outline. */
  sectionKey: string;
  content: string;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  if (!input.content.trim()) {
    return { ok: false as const, error: "Section content cannot be empty." };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return { ok: false as const, error: "Complete onboarding first." };
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id: input.rfpId, userId: user.id },
  });

  if (!rfp) {
    return { ok: false as const, error: "RFP not found." };
  }

  const section = proposalOutline(rfp).find((item) => item.key === input.sectionKey);
  if (!section) {
    return { ok: false as const, error: "Invalid draft section." };
  }

  const existing = await findSectionDraft(rfp.id, section);
  const checked = await recheckCitations(user.id, input.content.trim(), parseCitations(existing?.citations), rfp.sourceText ?? "");
  const content = checked.content.trim();
  const citations = asJson(checked.citations);

  const draft = existing
    ? await prisma.draft.update({
        where: { id: existing.id },
        data: {
          sectionKey: section.key,
          title: section.title,
          content,
          citations,
          status: DraftStatus.edited,
        },
      })
    : await prisma.draft.create({
        data: {
          rfpId: rfp.id,
          sectionName: section.kind,
          sectionKey: section.key,
          title: section.title,
          content,
          citations,
          status: DraftStatus.edited,
        },
      });

  if (rfp.status === RfpStatus.drafting || rfp.status === RfpStatus.extracted) {
    const sections = await prisma.draft.findMany({
      where: { rfpId: rfp.id },
      select: { sectionName: true, sectionKey: true },
    });
    const keys = new Set(sections.map((item) => draftKey(item)));
    const complete = proposalOutline(rfp)
      .filter((item) => item.kind !== "cover_letter" && item.kind !== "responses")
      .every((item) => keys.has(item.key));

    if (complete) {
      await prisma.rfp.update({
        where: { id: rfp.id },
        data: { status: RfpStatus.drafting },
      });
    }
  }

  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  revalidatePath(`/dashboard/rfps/${rfp.id}`);

  return {
    ok: true as const,
    draft: {
      id: draft.id,
      sectionKey: section.key,
      content: draft.content,
      status: draft.status,
      updatedAt: draft.updatedAt.toISOString(),
      citations: checked.citations,
    },
  };
}

/**
 * Marks an uncited claim as reviewed ("keep it as written") or puts it back
 * on the list. The claim stays in the draft either way; only the flag changes.
 */
export async function setClaimReviewed(input: {
  rfpId: string;
  sectionKey: string;
  claim: string;
  reviewed: boolean;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }
  if (!/^[a-z0-9_-]{1,64}$/.test(input.sectionKey) || !input.claim.trim() || input.claim.length > 2_000) {
    return { ok: false as const, error: "Invalid request." };
  }
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return { ok: false as const, error: "Complete onboarding first." };
  }
  const rfp = await prisma.rfp.findFirst({ where: { id: input.rfpId, userId: user.id } });
  const section = rfp ? proposalOutline(rfp).find((item) => item.key === input.sectionKey) : undefined;
  const draft = rfp && section ? await findSectionDraft(rfp.id, section) : null;
  const current = parseCitations(draft?.citations);
  if (!draft || !current) {
    return { ok: false as const, error: "Section not found." };
  }

  const claim = input.claim.trim();
  const next: DraftCitations = input.reviewed
    ? {
        ...current,
        unsupported: current.unsupported.filter((item) => item !== claim),
        figures: current.figures.filter((item) => item !== claim),
        overclaims: current.overclaims.filter((item) => item !== claim),
        dismissed: current.dismissed.includes(claim) ? current.dismissed : [...current.dismissed, claim],
      }
    : {
        ...current,
        unsupported: current.unsupported.includes(claim) ? current.unsupported : [...current.unsupported, claim],
        dismissed: current.dismissed.filter((item) => item !== claim),
      };
  await prisma.draft.update({ where: { id: draft.id }, data: { citations: asJson(next) } });
  revalidatePath(`/dashboard/rfps/${input.rfpId}/draft`);
  return { ok: true as const, citations: next };
}

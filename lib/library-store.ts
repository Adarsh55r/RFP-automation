import { prisma } from "@/lib/db";
import { LibraryItemType, type SubscriptionTier } from "@/lib/generated/prisma";
import { LIBRARY_ITEM_MAX_CHARS, LIBRARY_TOTAL_MAX_CHARS } from "@/lib/library";
import { resolvePlan } from "@/lib/plans";

/**
 * Server-only bulk add for imported content (website import, document
 * upload). Applies the same limits as adding an item by hand: one company
 * profile, the plan's item limit, the per-item and total size limits.
 * Lives outside `lib/actions` so it is never callable from the browser.
 */
export async function addLibraryItems(
  user: { id: string; subscription: { tier: SubscriptionTier; planVersion: string } | null },
  candidates: { type: LibraryItemType; title: string; content: string }[],
) {
  const existing = await prisma.libraryItem.findMany({ where: { userId: user.id }, select: { type: true, title: true, content: true } });
  const maxItems = resolvePlan(user.subscription).libraryItems;
  let room = LIBRARY_TOTAL_MAX_CHARS - existing.reduce((sum, item) => sum + item.title.length + item.content.length, 0);
  let slots = maxItems === null ? Infinity : maxItems - existing.length;
  let hasProfile = existing.some((item) => item.type === LibraryItemType.company_profile);

  const created: string[] = [];
  let skippedForLimits = 0;
  let keptExistingProfile = false;
  for (const candidate of candidates) {
    if (candidate.type === LibraryItemType.company_profile && hasProfile) {
      keptExistingProfile = true;
      continue;
    }
    const title = candidate.title.trim().slice(0, 200);
    const content = candidate.content.trim().slice(0, LIBRARY_ITEM_MAX_CHARS);
    if (title.length < 2 || content.length < 10) continue;
    if (slots <= 0 || title.length + content.length > room) {
      skippedForLimits += 1;
      continue;
    }
    await prisma.libraryItem.create({ data: { userId: user.id, type: candidate.type, title, content } });
    created.push(title);
    slots -= 1;
    room -= title.length + content.length;
    if (candidate.type === LibraryItemType.company_profile) hasProfile = true;
  }
  return { created, skippedForLimits, keptExistingProfile };
}

/** Splits long text into library-sized parts at paragraph breaks. */
export function splitForLibrary(text: string, maxChars = LIBRARY_ITEM_MAX_CHARS - 200) {
  const parts: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n\s*\n/)) {
    const piece = paragraph.length > maxChars ? paragraph.slice(0, maxChars) : paragraph;
    if (current && current.length + piece.length + 2 > maxChars) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

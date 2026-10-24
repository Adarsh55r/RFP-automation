import type { KeyDetail } from "@/lib/key-details";

/**
 * The response page limit an RFP states, if any, so an export that runs over
 * can be flagged. Taken from the extracted key details or submission rules;
 * the smallest limit found wins, because a stricter limit is the safer one to
 * warn about. Word limits are not checked.
 */
export type PageLimit = { pages: number; source: string };

const PAGE_LIMIT =
  /\b(?:not exceed|no more than|maximum(?: of)?|max\.?|limited to|up to|at most|must not be longer than)\s+(?:[a-z-]+\s+)?\(?(\d{1,3})\)?\s*(?:\(\d+\)\s*)?(?:single[- ]sided\s+|double[- ]sided\s+)?pages?\b|\b(\d{1,3})[- ]page (?:limit|maximum)\b|\bpage limit(?: of|:)?\s*(\d{1,3})\b/i;

function limitIn(text: string) {
  const match = PAGE_LIMIT.exec(text);
  const value = match ? Number(match[1] ?? match[2] ?? match[3]) : NaN;
  return Number.isFinite(value) && value > 0 && value <= 500 ? value : null;
}

export function pageLimitFrom(details: KeyDetail[], submissionRequirements: unknown): PageLimit | null {
  const candidates = [
    ...details.filter((detail) => detail.category === "length_limit").map((detail) => detail.detail),
    ...(Array.isArray(submissionRequirements) ? submissionRequirements.filter((item): item is string => typeof item === "string") : []),
  ];
  let best: PageLimit | null = null;
  for (const text of candidates) {
    const pages = limitIn(text);
    if (pages !== null && (!best || pages < best.pages)) best = { pages, source: text };
  }
  return best;
}

/** Message for the user when an export is longer than the limit. */
export function pageLimitWarning(pageCount: number, limit: PageLimit, estimated: boolean) {
  if (pageCount <= limit.pages) return null;
  return `This export is ${estimated ? "about " : ""}${pageCount} pages, including the cover page, contents and any appendix. The RFP says: “${limit.source}”. Check what counts towards the limit, then shorten sections or leave out the compliance matrix if needed.`;
}

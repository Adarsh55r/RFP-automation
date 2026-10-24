import { credentialsIn } from "@/lib/claim-checks";
import { CITATION_BODY, citationIds } from "@/lib/markdown";
import type { LibraryItem, LibraryItemType } from "@/lib/generated/prisma";

/**
 * Per-claim citations. Library items are split into short passages with
 * stable IDs ([S1], [S2], …) that the drafting prompt shows the model; the
 * model must end every factual statement about the bidder with the ID of
 * the passage it came from. After drafting, `analyzeDraft` checks every
 * citation against the real passages (dropping any the model made up) and
 * lists factual-looking sentences with no citation as "needs your input".
 * Nothing here calls the AI.
 */

export type SourcePassage = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: LibraryItemType;
  text: string;
};

/** What a stored citation points to: a snapshot, so it still reads correctly if the library changes later. */
export type CitationSource = { itemId: string; title: string; type: string; excerpt: string };

export type DraftCitations = {
  version: 1;
  /** Citation ID → the passage it points to, for every ID the section uses. */
  sources: Record<string, CitationSource>;
  /** Factual-looking sentences with no supporting citation: the user must check or fill these. */
  unsupported: string[];
  /** Sentences the user reviewed and chose to keep anyway. */
  dismissed: string[];
};

/** Order the library is shown to the model in, so passage IDs are the same in the prompt and the check. */
export const LIBRARY_ORDER: LibraryItemType[] = ["company_profile", "case_study", "team_bio", "certification", "saved_answer"];

const MAX_PASSAGE_CHARS = 600;
const MAX_EXCERPT_CHARS = 700;

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= MAX_PASSAGE_CHARS) return [paragraph];
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > MAX_PASSAGE_CHARS) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Splits the library into numbered passages, in prompt order. */
export function buildSourceIndex(items: Pick<LibraryItem, "id" | "title" | "type" | "content">[]) {
  const ordered = LIBRARY_ORDER.flatMap((type) => items.filter((item) => item.type === type));
  const passages: SourcePassage[] = [];
  for (const item of ordered) {
    const paragraphs = item.content
      .split(/\n\s*\n/)
      .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    for (const paragraph of paragraphs.flatMap(splitLongParagraph)) {
      passages.push({
        id: `S${passages.length + 1}`,
        itemId: item.id,
        itemTitle: item.title,
        itemType: item.type,
        text: paragraph,
      });
    }
  }
  return { passages, byId: new Map(passages.map((passage) => [passage.id, passage])) };
}

export type SourceIndex = ReturnType<typeof buildSourceIndex>;

export function sourceFromPassage(passage: SourcePassage): CitationSource {
  return {
    itemId: passage.itemId,
    title: passage.itemTitle,
    type: passage.itemType,
    excerpt: passage.text.length > MAX_EXCERPT_CHARS ? `${passage.text.slice(0, MAX_EXCERPT_CHARS)}…` : passage.text,
  };
}

/** A citation marker: [S12], [S12, S14], or a range such as [S4, S7–S10]. Use `citationIds` on group 1. */
export const CITATION_PATTERN = new RegExp(String.raw`\[(${CITATION_BODY})\]`, "g");

/** Removes every citation marker, for the clean copy that is submitted to the buyer. */
export function stripCitations(markdown: string) {
  return markdown.replace(new RegExp(String.raw`[ \t]*\[${CITATION_BODY}\]`, "g"), "");
}

const FIRST_PERSON = /\b(we|our|us|we've|we're|we have)\b/i;
const PAST_OR_PRESENT_FACT =
  /\b(have|has|had|hold|holds|held|completed|delivered|served|supported|worked|managed|implemented|achieved|reduced|saved|won|employ|employs|includes?|certified|accredited|awarded|licensed|registered|insured|since \d{4}|track record|clients? include|founded|established)\b/i;
const NUMERIC_FACT =
  /\b\d[\d,.]*\s*(%|percent|years?|clients?|customers?|projects?|staff|employees|engineers|consultants|people|sites?|locations?|offices?|contracts?|users?|endpoints?|devices?|tickets?|awards?)\b|[$£€]\s?\d/i;
const FUTURE_COMMITMENT = /\b(will|shall|would|propose|plan to|commit to|can)\b/i;

/**
 * Whether a sentence states a checkable fact about the bidder (past work,
 * clients, people, numbers, certifications) rather than describing what the
 * bidder will do. Deliberately conservative: it flags for review, it never
 * rewrites.
 */
export function isBidderFact(sentence: string) {
  if (credentialsIn(sentence).length > 0 && FIRST_PERSON.test(sentence)) return true;
  if (!FIRST_PERSON.test(sentence)) return false;
  const numeric = NUMERIC_FACT.test(sentence);
  const factVerb = PAST_OR_PRESENT_FACT.test(sentence);
  if (FUTURE_COMMITMENT.test(sentence) && !factVerb) return false;
  if (numeric) return true;
  // A past or present fact naming someone or something specific: a client, place, product or award.
  const named = sentence
    .replace(/^\W*\w+/, "")
    .replace(/\b(Section|Requirement|Appendix|Annex|Schedule|Lot|Part|Question|Exhibit|Attachment)\b/g, "");
  return factVerb && /\b[A-Z][A-Za-z]+/.test(named);
}

/** Plain text of a table row or sentence, for showing back to the user. */
function plain(text: string) {
  return text
    .replace(/\*\*|__|\*|_|`/g, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\s*\||\|\s*$/g, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

function statements(markdown: string): { text: string; tableRow: boolean }[] {
  const out: { text: string; tableRow: boolean }[] = [];
  let tableHeader = true;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^>\s*\*\*/.test(line)) {
      tableHeader = true;
      continue;
    }
    if (line.startsWith("|")) {
      if (/^\|?\s*:?-{2,}/.test(line)) continue;
      if (tableHeader) {
        tableHeader = false;
        continue;
      }
      out.push({ text: line, tableRow: true });
      continue;
    }
    tableHeader = true;
    for (const sentence of line.replace(/^>\s*/, "").split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)) {
      if (sentence.trim()) out.push({ text: sentence, tableRow: false });
    }
  }
  return out;
}

/**
 * Checks a drafted section: keeps only citations that point to real
 * passages, records what each points to, and lists uncited factual claims.
 */
export function analyzeDraft(
  markdown: string,
  lookup: (id: string) => CitationSource | undefined,
  dismissed: string[] = [],
): { content: string; citations: DraftCitations } {
  const sources: Record<string, CitationSource> = {};
  // Markers are rewritten in one canonical form ([S4, S7, S8]) so every later reader agrees.
  const content = markdown.replace(new RegExp(String.raw`([ \t]*)\[(${CITATION_BODY})\]`, "g"), (_match, space: string, ids: string) => {
    const valid = citationIds(ids)
      .filter((id) => {
        const source = lookup(id);
        if (source) sources[id] = source;
        return Boolean(source);
      });
    // An invented marker goes completely, with the space before it.
    return valid.length > 0 ? `${space}[${valid.join(", ")}]` : "";
  });

  const unsupported: string[] = [];
  for (const { text, tableRow } of statements(content)) {
    if (/\[S\d+/.test(text) || /\[\[/.test(text)) continue;
    const factual = tableRow
      ? credentialsIn(text).length > 0 || /\b\d+\s*(\+\s*)?years?\b|\d%/i.test(text)
      : isBidderFact(text);
    if (!factual) continue;
    const sentence = plain(text);
    if (sentence.length < 12 || unsupported.includes(sentence) || dismissed.includes(sentence)) continue;
    unsupported.push(sentence);
    if (unsupported.length >= 40) break;
  }

  return { content, citations: { version: 1, sources, unsupported, dismissed: dismissed.filter(Boolean) } };
}

/** Reads stored citations defensively (older drafts have none). */
export function parseCitations(value: unknown): DraftCitations | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DraftCitations>;
  return {
    version: 1,
    sources: raw.sources && typeof raw.sources === "object" ? (raw.sources as Record<string, CitationSource>) : {},
    unsupported: Array.isArray(raw.unsupported) ? raw.unsupported.filter((item) => typeof item === "string") : [],
    dismissed: Array.isArray(raw.dismissed) ? raw.dismissed.filter((item) => typeof item === "string") : [],
  };
}

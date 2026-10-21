import type { ExtractionResult } from "@/lib/rfp-extract";

/**
 * Deterministic checks of an AI extraction against the document text.
 * They cannot prove an extraction is right, but they catch the failures
 * that hurt bidders most: a deadline that is not in the RFP, conflicting
 * due dates, dropped questions, and mandatory requirements whose wording
 * appears nowhere in the document. Findings become review flags.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

type FoundDate = { iso: string; text: string; index: number };

function iso(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

function monthIndex(name: string) {
  const key = name.toLowerCase().replace(".", "").slice(0, 3);
  return MONTHS.findIndex((month) => month.startsWith(key)) + 1;
}

function fullYear(value: string) {
  const year = Number(value);
  return value.length === 2 ? 2000 + year : year;
}

/** Every calendar date written in the text, in any common US/UK/ISO style. */
export function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];
  const add = (value: string | null, match: RegExpMatchArray) => {
    if (value) found.push({ iso: value, text: match[0].trim(), index: match.index ?? 0 });
  };
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"))) {
    add(iso(Number(m[3]), monthIndex(m[1]), Number(m[2])), m);
  }
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE},?\\s+(\\d{4})\\b`, "gi"))) {
    add(iso(Number(m[3]), monthIndex(m[2]), Number(m[1])), m);
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(iso(Number(m[1]), Number(m[2]), Number(m[3])), m);
  }
  // Numeric dates are ambiguous between US (MM/DD) and UK (DD/MM): keep both readings.
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    const year = fullYear(m[3]);
    add(iso(year, Number(m[1]), Number(m[2])), m);
    add(iso(year, Number(m[2]), Number(m[1])), m);
  }
  return found;
}

const DUE_WORDS = /\b(due|deadline|closing|closes|submit|submission|submitted|received|return(?:ed)? by|no later than)\b/i;
const NOT_PROPOSAL_DUE = /\b(question|questions|inquir|clarification|conference|site visit|walk-?through|award|issued|release|start|commence|notice to proceed|valid)/i;
const AMENDMENT = /\b(addend|amendment|corrigend|clarification no|extended)/i;

function lineAround(text: string, index: number) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end);
}

const QUESTION_LINE = /^\s*(?:Q(?:uestion)?\s*)?(\d{1,3})[.):]\s+(.+)$/i;
const QUESTION_START = /^(describe|explain|provide|list|detail|outline|how|what|when|where|which|who|why|do|does|did|are|is|have|has|can|will|would|please)\b/i;

/** Numbered questions the document asks, counted by distinct number. */
export function countNumberedQuestions(text: string) {
  const numbers = new Set<number>();
  for (const line of text.split("\n")) {
    const m = QUESTION_LINE.exec(line);
    if (!m) continue;
    const body = m[2].trim();
    const prefixed = /^\s*Q/i.test(line);
    if (prefixed || body.endsWith("?") || QUESTION_START.test(body)) numbers.add(Number(m[1]));
  }
  return numbers.size;
}

const STOP = new Set(["must", "shall", "should", "will", "with", "from", "that", "this", "have", "least", "their", "they", "your", "offeror", "offerors", "bidder", "vendor", "provide", "current", "minimum", "years", "year", "each", "than", "into", "within", "upon", "such", "also", "been", "being", "which", "where", "when", "what", "required", "requirement", "requirements", "proposal", "proposals"]);

function contentWords(item: string) {
  return [...new Set(item.toLowerCase().match(/[a-z0-9$%][a-z0-9$%,.'-]*[a-z0-9%]/g) ?? [])]
    .map((word) => word.replace(/[,.']+$/g, ""))
    .filter((word) => word.length >= 4 && !STOP.has(word));
}

/** Share of an item's meaningful words that occur in the document (prefix match tolerates word endings). */
export function wordingCoverage(item: string, source: string) {
  const words = contentWords(item);
  if (words.length < 3) return 1;
  const haystack = source.toLowerCase();
  const hits = words.filter((word) => haystack.includes(word.length >= 7 ? word.slice(0, 6) : word)).length;
  return hits / words.length;
}

export function verifyExtraction(result: ExtractionResult, source: string) {
  const flags: string[] = [];
  const dates = findDates(source);

  // 1. The deadline must be a date the document actually states.
  if (result.deadline && !dates.some((date) => date.iso === result.deadline)) {
    flags.push(`Deadline: ${result.deadline} does not appear in the document. Check the submission date against the RFP before relying on it.`);
  }

  // 2. Several different proposal due dates usually mean an addendum or a contradiction.
  const dueDates = new Map<string, string>();
  for (const date of dates) {
    const line = lineAround(source, date.index);
    if (DUE_WORDS.test(line) && !NOT_PROPOSAL_DUE.test(line)) dueDates.set(date.iso, date.text);
  }
  if (dueDates.size > 1) {
    const listed = [...dueDates.values()].join(", ");
    if (!AMENDMENT.test(source)) {
      flags.push(`Deadline: the document gives more than one due date (${listed}). Confirm which one applies with the buyer.`);
    } else if (result.deadline && result.deadline !== [...dueDates.keys()].sort().at(-1)) {
      flags.push(`Deadline: an addendum changes the due date (${listed}). Confirm the latest one is used.`);
    }
  }

  // 3. Every numbered question should be captured.
  const numbered = countNumberedQuestions(source);
  if (numbered >= 5 && result.questionnaireItems.length < Math.ceil(numbered * 0.9)) {
    flags.push(`Questions: the document numbers ${numbered} questions but ${result.questionnaireItems.length} were extracted. Add any that are missing before drafting.`);
  }

  // 4. Mandatory and desirable requirements should use the document's own wording.
  for (const item of [...result.eligibilityCriteria, ...result.desirableCriteria]) {
    if (wordingCoverage(item, source) < 0.5) {
      flags.push(`Requirement not found in the document: "${item}". Delete it if the RFP does not ask for it.`);
    }
  }
  return { flags };
}

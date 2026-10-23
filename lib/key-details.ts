/**
 * Key details of a solicitation beyond the requirement lists: limits,
 * formats, deadlines, forms, insurance, SLAs and so on. The categories are
 * deliberately industry-neutral. Each detail carries a short verbatim quote,
 * and its page is worked out here by finding that quote in the document, so
 * the page reference never depends on the model's arithmetic.
 */

export const KEY_DETAIL_GROUPS = {
  all: "Every bid",
  public: "Public-sector bids",
  commercial: "Commercial bids",
} as const;

export const KEY_DETAIL_CATEGORIES = {
  submission_deadline: { label: "Submission deadline and time zone", group: "all" },
  clarification_deadline: { label: "Clarification questions deadline", group: "all" },
  submission_method: { label: "How to submit", group: "all" },
  length_limit: { label: "Page or word limits", group: "all" },
  formatting: { label: "Formatting rules", group: "all" },
  evaluation_weighting: { label: "Evaluation weighting", group: "all" },
  pass_fail: { label: "Pass/fail requirements", group: "all" },
  required_attachment: { label: "Required attachments", group: "all" },
  references: { label: "References", group: "all" },
  key_personnel: { label: "Key personnel", group: "all" },
  pricing_format: { label: "Pricing format", group: "all" },
  contract_term: { label: "Contract term and value", group: "all" },
  required_form: { label: "Required forms and declarations", group: "public" },
  insurance: { label: "Insurance", group: "public" },
  bonding: { label: "Bonds and guarantees", group: "public" },
  preference: { label: "Preferences and social value", group: "public" },
  registration: { label: "Registrations and licences", group: "public" },
  security: { label: "Security and data protection", group: "commercial" },
  service_levels: { label: "Service levels", group: "commercial" },
  legal_terms: { label: "Legal and contract terms", group: "commercial" },
  timeline: { label: "Project timeline", group: "commercial" },
  other: { label: "Other", group: "all" },
} as const satisfies Record<string, { label: string; group: keyof typeof KEY_DETAIL_GROUPS }>;

export type KeyDetailCategory = keyof typeof KEY_DETAIL_CATEGORIES;
export type KeyDetailKind = "mandatory" | "scored" | "info";

export type KeyDetail = {
  category: KeyDetailCategory;
  detail: string;
  kind: KeyDetailKind;
  /** Verbatim words from the document that state the detail. */
  quote: string | null;
  /** Page the quote is on (PDFs), or null when the document has no pages or the quote was not found. */
  page: number | null;
  /** The quote was found in the document. Unverified details are shown with a "check" label. */
  verified: boolean;
};

export const MAX_KEY_DETAILS = 80;

const isCategory = (value: unknown): value is KeyDetailCategory =>
  typeof value === "string" && Object.hasOwn(KEY_DETAIL_CATEGORIES, value);

/** For finding a quote despite line breaks, curly quotes, dashes and spacing differences. */
function normalizeForSearch(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_MARKER = /^--- Pages? (\d+)(?:–\d+)? ---$/m;

/**
 * The document normalised for searching, with where each page starts. Pages
 * are normalised one at a time (linear in document length) and joined with a
 * space, so a quote that runs across a page break is still found.
 */
export function buildQuoteIndex(documentText: string) {
  const parts = documentText.split(new RegExp(PAGE_MARKER.source, "gm"));
  // split() with a capture group alternates: text before the first marker, page number, page text, …
  const starts: { page: number; at: number }[] = [];
  let text = normalizeForSearch(parts[0] ?? "");
  for (let i = 1; i < parts.length; i += 2) {
    if (text) text += " ";
    starts.push({ page: Number(parts[i]), at: text.length });
    text += normalizeForSearch(parts[i + 1] ?? "");
  }
  return { text, starts };
}

/** Finds a quote in the document and the page it is on. */
export function locateQuote(documentText: string, quote: string, index = buildQuoteIndex(documentText)) {
  const needle = normalizeForSearch(quote);
  if (needle.length < 6) return { found: false, page: null };
  const at = index.text.indexOf(needle);
  if (at < 0) return { found: false, page: null };
  let page: number | null = null;
  for (const start of index.starts) {
    if (start.at <= at) page = start.page;
    else break;
  }
  return { found: true, page };
}


/** Validates the model's key details and works out each one's page from its quote. */
export function parseKeyDetails(value: unknown, documentText: string): KeyDetail[] {
  if (!Array.isArray(value)) return [];
  const index = buildQuoteIndex(documentText);
  const details: KeyDetail[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const detail = typeof item.detail === "string" ? item.detail.trim().slice(0, 500) : "";
    if (!detail) continue;
    const quote = typeof item.quote === "string" && item.quote.trim() ? item.quote.trim().slice(0, 300) : null;
    const located = quote ? locateQuote(documentText, quote, index) : { found: false, page: null };
    details.push({
      category: isCategory(item.category) ? item.category : "other",
      detail,
      kind: item.kind === "mandatory" || item.kind === "scored" ? item.kind : "info",
      quote,
      page: located.page,
      verified: located.found,
    });
    if (details.length >= MAX_KEY_DETAILS) break;
  }
  return details;
}

/** Reads stored details defensively. */
export function storedKeyDetails(value: unknown): KeyDetail[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is KeyDetail =>
      Boolean(item) && typeof item === "object" && isCategory((item as KeyDetail).category) && typeof (item as KeyDetail).detail === "string",
  );
}

/** Details grouped by category in display order. */
export function groupKeyDetails(details: KeyDetail[]) {
  return (Object.keys(KEY_DETAIL_CATEGORIES) as KeyDetailCategory[])
    .map((category) => ({ category, label: KEY_DETAIL_CATEGORIES[category].label, items: details.filter((d) => d.category === category) }))
    .filter((group) => group.items.length > 0);
}

/** Plain-text list for the drafting prompt. */
export function keyDetailsForPrompt(details: KeyDetail[]) {
  return groupKeyDetails(details)
    .map((group) =>
      group.items
        .map((item) => `- ${group.label}${item.kind !== "info" ? ` (${item.kind})` : ""}: ${item.detail}${item.page ? ` [page ${item.page}]` : ""}`)
        .join("\n"),
    )
    .join("\n");
}

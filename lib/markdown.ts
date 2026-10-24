import { Lexer, type Token, type Tokens } from "marked";

/**
 * One parsed representation of draft markdown, shared by the on-screen
 * preview, the DOCX export, and the PDF export so all three agree on
 * headings, lists, tables, and highlighted placeholders.
 */

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  /** `[[Confirm: …]]`-style gap the bidder still has to fill in. */
  placeholder?: boolean;
  /** `[S3, S7]` citation marker: the library passage IDs a claim came from. */
  citation?: string[];
};

export type TableAlign = "left" | "center" | "right" | null;

export type MdBlock =
  | { type: "heading"; level: number; runs: InlineRun[] }
  | { type: "paragraph"; runs: InlineRun[] }
  | { type: "list"; ordered: boolean; start: number; items: MdBlock[][] }
  | {
      type: "table";
      header: InlineRun[][];
      rows: InlineRun[][][];
      align: TableAlign[];
    }
  | { type: "quote"; blocks: MdBlock[] }
  | { type: "code"; text: string }
  | { type: "hr" };

/**
 * Placeholders the drafting prompt asks for (`[[...]]`), plus the older
 * single-bracket style (`[Add case study]`) found in earlier drafts.
 */
const PLACEHOLDER_PATTERN =
  /\[\[[^[\]]+?\]\]|\[(?:Add|Confirm|Insert|Enter|TBD|TBC|Placeholder)\b[^[\]]*\]/g;

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.indexOf("|", 1) !== -1;
}

function isSeparatorLine(line: string) {
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/**
 * Repairs the markdown mistakes models make most often so tables survive:
 * a table glued to the paragraph above it, or a table with no `|---|` row.
 */
export function normalizeMarkdown(markdown: string) {
  const text = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^```(?:markdown|md)?\s*\n/i, "")
    .replace(/\n```\s*$/, "");
  const lines = text.split("\n");
  const out: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previous = out[out.length - 1] ?? "";
    const startsTable = isTableLine(line) && !isTableLine(previous);

    if (startsTable) {
      if (previous.trim() !== "") {
        out.push("");
      }
      out.push(line);
      const next = lines[index + 1] ?? "";
      if (isTableLine(next) && !isSeparatorLine(next)) {
        const columns = line.trim().replace(/^\||\|$/g, "").split("|").length;
        out.push(`|${" --- |".repeat(columns)}`);
      }
      continue;
    }

    if (!isTableLine(line) && isTableLine(previous) && line.trim() !== "") {
      out.push("");
    }
    out.push(line);
  }

  return out.join("\n");
}

/** One citation ID or range inside a marker: S4, or S7–S10 (any dash, the second "S" optional). */
const CITATION_ID = String.raw`S\d+(?:\s*[-–—]\s*S?\d+)?`;
/** The inside of a citation marker as models write it: "S4", "S3, S9", "S4; S7–S10". */
export const CITATION_BODY = String.raw`${CITATION_ID}(?:\s*[,;]\s*${CITATION_ID})*`;

/** Every passage ID a marker body refers to, with ranges expanded ("S7–S10" → S7, S8, S9, S10). */
export function citationIds(body: string): string[] {
  const ids: string[] = [];
  for (const part of body.split(/\s*[,;]\s*/)) {
    const range = /^S(\d+)\s*[-–—]\s*S?(\d+)$/.exec(part.trim());
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      // A reversed or implausibly long range is kept as its two ends only.
      const span = to >= from && to - from <= 30 ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [from, to];
      for (const n of span) if (!ids.includes(`S${n}`)) ids.push(`S${n}`);
    } else if (/^S\d+$/.test(part.trim()) && !ids.includes(part.trim())) {
      ids.push(part.trim());
    }
  }
  return ids;
}

/** Wider tables cannot fit a page without breaking words; they are laid out row by row instead. */
export const MAX_TABLE_COLUMNS = 5;

/**
 * A wide table as one block per row: the first cell in bold, then each other
 * column as "Header: value". Reads well on paper and never splits words.
 */
function stackedTable(header: InlineRun[][], rows: InlineRun[][][]): MdBlock[] {
  const text = (runs: InlineRun[]) => runs.map((run) => run.text).join("").trim();
  return rows.flatMap((row): MdBlock[] => {
    const [first = [], ...rest] = row;
    const items = rest
      .map((cell, index) => ({ cell, label: text(header[index + 1] ?? []) }))
      .filter(({ cell }) => text(cell))
      .map(({ cell, label }): MdBlock[] => [
        { type: "paragraph", runs: [...(label ? [{ text: `${label}: `, bold: true }] : []), ...cell] },
      ]);
    return [
      { type: "paragraph", runs: first.map((run) => ({ ...run, bold: true })) },
      ...(items.length > 0 ? [{ type: "list" as const, ordered: false, start: 1, items }] : []),
    ];
  });
}

/** Citation markers from lib/citations.ts, matched here too so every renderer agrees. */
const CITATION_MARKER = new RegExp(String.raw`\[(${CITATION_BODY})\]`, "g");
const INLINE_MARKERS = new RegExp(`${PLACEHOLDER_PATTERN.source}|${CITATION_MARKER.source}`, "g");

function splitPlaceholders(run: InlineRun): InlineRun[] {
  if (run.code || !run.text.includes("[")) {
    return [run];
  }
  const parts: InlineRun[] = [];
  let last = 0;
  for (const match of run.text.matchAll(INLINE_MARKERS)) {
    const at = match.index ?? 0;
    if (at > last) {
      parts.push({ ...run, text: run.text.slice(last, at) });
    }
    if (match[1]) {
      const ids = citationIds(match[1]);
      parts.push({ ...run, text: `[${ids.join(", ")}]`, citation: ids });
    } else {
      const inner = match[0].replace(/^\[\[?|\]\]?$/g, "").trim();
      parts.push({ ...run, text: `[${inner}]`, placeholder: true });
    }
    last = at + match[0].length;
  }
  if (last < run.text.length) {
    parts.push({ ...run, text: run.text.slice(last) });
  }
  return parts.length > 0 ? parts : [run];
}

type InlineStyle = Pick<InlineRun, "bold" | "italic" | "strike">;

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function inlineRuns(tokens: Token[] | undefined, style: InlineStyle = {}): InlineRun[] {
  if (!tokens) {
    return [];
  }
  const runs: InlineRun[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "strong":
        runs.push(...inlineRuns((token as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns((token as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case "del":
        runs.push(...inlineRuns((token as Tokens.Del).tokens, { ...style, strike: true }));
        break;
      case "codespan":
        runs.push({ ...style, text: decodeEntities((token as Tokens.Codespan).text), code: true });
        break;
      case "br":
        runs.push({ ...style, text: "\n" });
        break;
      case "link": {
        const link = token as Tokens.Link;
        const label = inlineRuns(link.tokens, style);
        runs.push(...label);
        const labelText = label.map((run) => run.text).join("");
        // "a@b.com" linked to "mailto:a@b.com" is the same thing: print it once.
        const bare = (value: string) =>
          value.trim().replace(/^(mailto:|tel:)/i, "").replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
        if (link.href && bare(link.href) !== bare(labelText) && !link.href.startsWith("#")) {
          runs.push({ ...style, text: ` (${link.href})` });
        }
        break;
      }
      case "image":
        runs.push({ ...style, text: (token as Tokens.Image).text });
        break;
      case "text": {
        const text = token as Tokens.Text;
        if (text.tokens && text.tokens.length > 0) {
          runs.push(...inlineRuns(text.tokens, style));
        } else {
          runs.push({ ...style, text: decodeEntities(text.text) });
        }
        break;
      }
      default:
        // escape, html, and anything unknown render as literal text — never as markup.
        if ("text" in token && typeof token.text === "string") {
          runs.push({ ...style, text: decodeEntities(token.text) });
        } else if ("raw" in token && typeof token.raw === "string") {
          runs.push({ ...style, text: token.raw });
        }
    }
  }

  return mergeRuns(runs.flatMap(splitPlaceholders));
}

function sameStyle(a: InlineRun, b: InlineRun) {
  return (
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.code) === Boolean(b.code) &&
    Boolean(a.strike) === Boolean(b.strike) &&
    !a.placeholder &&
    !b.placeholder &&
    !a.citation &&
    !b.citation
  );
}

function mergeRuns(runs: InlineRun[]) {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && sameStyle(previous, run)) {
      previous.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function blocksFromTokens(tokens: Token[]): MdBlock[] {
  const blocks: MdBlock[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        blocks.push({ type: "heading", level: heading.depth, runs: inlineRuns(heading.tokens) });
        break;
      }
      case "paragraph":
        blocks.push({ type: "paragraph", runs: inlineRuns((token as Tokens.Paragraph).tokens) });
        break;
      case "text": {
        // Block-level text appears inside tight list items.
        const text = token as Tokens.Text;
        blocks.push({
          type: "paragraph",
          runs: text.tokens ? inlineRuns(text.tokens) : [{ text: decodeEntities(text.text) }],
        });
        break;
      }
      case "list": {
        const list = token as Tokens.List;
        blocks.push({
          type: "list",
          ordered: list.ordered,
          start: typeof list.start === "number" ? list.start : 1,
          items: list.items.map((item) => {
            const inner = blocksFromTokens(item.tokens);
            if (item.task) {
              const first = inner[0];
              const box = { text: item.checked ? "☑ " : "☐ " };
              if (first && first.type === "paragraph") {
                first.runs.unshift(box);
              }
            }
            return inner;
          }),
        });
        break;
      }
      case "table": {
        const table = token as Tokens.Table;
        const header = table.header.map((cell) => inlineRuns(cell.tokens));
        const rows = table.rows.map((row) => row.map((cell) => inlineRuns(cell.tokens)));
        if (header.length > MAX_TABLE_COLUMNS) {
          blocks.push(...stackedTable(header, rows));
        } else {
          blocks.push({ type: "table", header, rows, align: table.align });
        }
        break;
      }
      case "blockquote":
        blocks.push({ type: "quote", blocks: blocksFromTokens((token as Tokens.Blockquote).tokens) });
        break;
      case "code":
        blocks.push({ type: "code", text: (token as Tokens.Code).text });
        break;
      case "hr":
        blocks.push({ type: "hr" });
        break;
      case "html": {
        const raw = (token as Tokens.HTML).text.replace(/<[^>]+>/g, "").trim();
        if (raw) {
          blocks.push({ type: "paragraph", runs: [{ text: decodeEntities(raw) }] });
        }
        break;
      }
      default:
        break;
    }
  }

  return blocks;
}

export function parseMarkdown(markdown: string): MdBlock[] {
  const tokens = Lexer.lex(normalizeMarkdown(markdown), { gfm: true, breaks: false });
  return blocksFromTokens(tokens);
}

export function runsToPlainText(runs: InlineRun[]) {
  return runs.map((run) => run.text).join("");
}

/** Every distinct placeholder left in the markdown, in order of appearance. */
export function findPlaceholders(markdown: string): string[] {
  const seen = new Set<string>();
  for (const match of markdown.matchAll(PLACEHOLDER_PATTERN)) {
    const inner = match[0].replace(/^\[\[?|\]\]?$/g, "").trim();
    if (inner) seen.add(inner);
  }
  return [...seen];
}

/**
 * Heading levels as used inside one section, shifted so the shallowest
 * heading the model wrote becomes level 1 (exports render it one level
 * below the section title).
 */
export function relativeHeadingLevel(blocks: MdBlock[]) {
  let min = 6;
  const visit = (items: MdBlock[]) => {
    for (const block of items) {
      if (block.type === "heading") min = Math.min(min, block.level);
      if (block.type === "quote") visit(block.blocks);
    }
  };
  visit(blocks);
  return (level: number) => Math.min(Math.max(level - min + 1, 1), 3);
}

/** Proportional column weights from cell text length, for fixed-width tables. */
/**
 * Column widths for a table, in the caller's unit. Every column is at least as
 * wide as its longest word (so words and amounts like "$10,800.00" never break
 * mid-way); the space left over goes to the columns with the most text.
 * `charWidth` is the width of an average character at the table's font size.
 */
export function columnWidths(header: InlineRun[][], rows: InlineRun[][][], usable: number, charWidth: number) {
  const columns = Math.max(header.length, ...rows.map((row) => row.length), 1);
  const minimums: number[] = [];
  const wants: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    const texts = [header[column], ...rows.map((row) => row[column])]
      .filter(Boolean)
      .map((cell) => runsToPlainText(cell as InlineRun[]));
    const lengths = texts.map((text) => text.length);
    const longest = Math.max(...lengths, 1);
    const average = lengths.reduce((sum, value) => sum + value, 0) / Math.max(lengths.length, 1);
    const longestWord = Math.max(...texts.flatMap((text) => text.split(/\s+/)).map((word) => word.length), 1);
    minimums.push((longestWord + 1) * charWidth);
    wants.push(Math.min(Math.max((longest + average) / 2, 6), 60) * charWidth);
  }
  const floor = minimums.reduce((sum, value) => sum + value, 0);
  // Not even the longest words fit: shrink in proportion (some words must wrap).
  if (floor >= usable) return minimums.map((value) => (value / floor) * usable);
  const extra = wants.map((want, index) => Math.max(want - minimums[index], 0));
  const extraTotal = extra.reduce((sum, value) => sum + value, 0);
  const spare = usable - floor;
  return minimums.map((value, index) =>
    value + (extraTotal > 0 ? (extra[index] / extraTotal) * spare : spare / columns),
  );
}

function blocksToPlainText(blocks: MdBlock[]): string[] {
  return blocks.flatMap((block): string[] => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return [runsToPlainText(block.runs)];
      case "list":
        return block.items.map(
          (item, index) => `${block.ordered ? `${block.start + index}.` : "•"} ${blocksToPlainText(item).join(" ")}`,
        );
      case "table":
        return [block.header, ...block.rows].map((row) => row.map((cell) => runsToPlainText(cell)).join(" | "));
      case "quote":
        return blocksToPlainText(block.blocks);
      case "code":
        return [block.text];
      default:
        return [];
    }
  });
}

/** Markdown as plain text (for spreadsheet cells): one line per paragraph, list item or table row. */
export function markdownToPlainText(markdown: string) {
  return blocksToPlainText(parseMarkdown(markdown)).filter((line) => line.trim()).join("\n");
}

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

function splitPlaceholders(run: InlineRun): InlineRun[] {
  if (run.code || !run.text.includes("[")) {
    return [run];
  }
  const parts: InlineRun[] = [];
  let last = 0;
  for (const match of run.text.matchAll(PLACEHOLDER_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) {
      parts.push({ ...run, text: run.text.slice(last, at) });
    }
    const inner = match[0].replace(/^\[\[?|\]\]?$/g, "").trim();
    parts.push({ ...run, text: `[${inner}]`, placeholder: true });
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
        if (link.href && link.href !== labelText && !link.href.startsWith("#")) {
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
    !b.placeholder
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
        blocks.push({
          type: "table",
          header: table.header.map((cell) => inlineRuns(cell.tokens)),
          rows: table.rows.map((row) => row.map((cell) => inlineRuns(cell.tokens))),
          align: table.align,
        });
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
export function columnWeights(header: InlineRun[][], rows: InlineRun[][][]) {
  const columns = Math.max(header.length, ...rows.map((row) => row.length), 1);
  const weights: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    const lengths = [header[column], ...rows.map((row) => row[column])]
      .filter(Boolean)
      .map((cell) => runsToPlainText(cell as InlineRun[]).length);
    const longest = Math.max(...lengths, 1);
    const average = lengths.reduce((sum, value) => sum + value, 0) / Math.max(lengths.length, 1);
    weights.push(Math.min(Math.max((longest + average) / 2, 6), 60));
  }
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value / total);
}

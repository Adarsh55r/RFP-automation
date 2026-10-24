/**
 * Deterministic checks that a draft's figures and claims rest on the sources.
 * The drafting prompt already forbids inventing them; these catch the cases
 * where the model does it anyway, and list them for the bidder to check.
 * Nothing here calls the AI or rewrites the draft.
 */

const PLACEHOLDER = /\[\[[\s\S]*?\]\]/g;
const CITATION = /\[S\d+[^\]]*\]/g;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100,
};

const MULTIPLIERS: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, bn: 1e9, billion: 1e9 };

/** A figure a draft states: an amount of money, a percentage, or a duration. */
const FIGURE = new RegExp(
  [
    String.raw`[$£€]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|mm|bn|thousand|million|billion)\b)?`,
    String.raw`\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b)`,
    String.raw`\b\d[\d,]*(?:\.\d+)?\s?(?:minutes?|mins?|hours?|hrs?|business days?|days?|weeks?|months?|years?)\b`,
  ].join("|"),
  "gi",
);

function valueOf(token: string): number | null {
  const match = /(\d[\d,]*(?:\.\d+)?)\s?(k|mm|m|bn|thousand|million|billion)?\b/i.exec(token);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  // "15 minutes" has no multiplier: the "m" must belong to a money amount.
  const multiplier = match[2] && /[$£€]/.test(token) ? (MULTIPLIERS[match[2].toLowerCase()] ?? 1) : 1;
  return base * multiplier;
}

/** Every number written in a text, in digits or as a common number word. */
export function numbersIn(text: string): Set<number> {
  const values = new Set<number>();
  for (const match of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s?(k|mm|m|bn|thousand|million|billion)?\b/gi)) {
    const base = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(base)) continue;
    values.add(base);
    if (match[2]) values.add(base * (MULTIPLIERS[match[2].toLowerCase()] ?? 1));
  }
  for (const word of text.toLowerCase().match(/\b[a-z]+\b/g) ?? []) {
    if (word in NUMBER_WORDS) values.add(NUMBER_WORDS[word]);
  }
  return values;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.005);
const known = (value: number, grounded: number[]) => grounded.some((item) => close(item, value));

/** Numbers in one table row or sentence, in order. */
function rowNumbers(text: string) {
  return [...text.replace(PLACEHOLDER, " ").matchAll(/[$£€]?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|m|bn|million)\b)?/gi)]
    .map((match) => valueOf(match[0]))
    .filter((value): value is number => value !== null);
}

/**
 * Figures that are the visible result of arithmetic on grounded numbers:
 * "15 × $95 = $1,425", a table row whose amount is quantity × unit price,
 * a "Total" row that adds up its column, and monthly ↔ annual (× 12).
 */
function derivedValues(markdown: string, grounded: number[]) {
  const values = [...grounded];
  const annualized = new Set<number>();
  const lines = markdown.split("\n");
  for (let pass = 0; pass < 3; pass += 1) {
    const before = values.length;
    const add = (value: number) => {
      if (!known(value, values)) values.push(value);
    };
    // Monthly ↔ annual: each figure once, never compounded (× 12 × 12).
    for (const value of [...values]) {
      if (annualized.has(value)) continue;
      annualized.add(value);
      for (const converted of [value * 12, value / 12]) {
        annualized.add(converted);
        add(converted);
      }
    }
    // Written arithmetic: "a × b = c", "a + b = c".
    for (const match of markdown.matchAll(/([$£€]?\s?\d[\d,.]*)\s*([×x*+])\s*([$£€]?\s?\d[\d,.]*)\s*=\s*([$£€]?\s?\d[\d,.]*)/gi)) {
      const [a, b, c] = [match[1], match[3], match[4]].map(valueOf);
      if (a === null || b === null || c === null || !known(a, values) || !known(b, values)) continue;
      const result = match[2] === "+" ? a + b : a * b;
      if (close(result, c)) add(c);
    }
    // Table rows: an amount equal to the product of two other grounded numbers in the row.
    let column: number[][] = [];
    for (const line of lines) {
      if (!line.trim().startsWith("|")) {
        column = [];
        continue;
      }
      if (/^\|?\s*:?-{2,}/.test(line.trim())) continue;
      const cells = line.split("|").slice(1, -1);
      const numbers = rowNumbers(line);
      const groundedInRow = numbers.filter((value) => known(value, values));
      for (let i = 0; i < groundedInRow.length; i += 1) {
        for (let j = i + 1; j < groundedInRow.length; j += 1) add(groundedInRow[i] * groundedInRow[j]);
      }
      if (/total/i.test(cells[0] ?? "")) {
        cells.forEach((cell, index) => {
          const above = column.map((row) => row[index]).filter((value): value is number => typeof value === "number");
          if (above.length > 1) add(above.reduce((sum, value) => sum + value, 0));
        });
      }
      column.push(cells.map((cell) => rowNumbers(cell)[0] ?? NaN).map((value) => (Number.isNaN(value) ? undefined : value)) as number[]);
    }
    if (values.length === before) break;
  }
  return values;
}

function sentences(markdown: string) {
  const out: string[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line || /^\|?\s*:?-{2,}/.test(line)) continue;
    if (line.startsWith("|")) {
      out.push(line);
      continue;
    }
    out.push(...line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/));
  }
  return out;
}

function readable(text: string) {
  return text
    .replace(CITATION, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^\s*\||\|\s*$/g, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Figures (money, percentages, durations) in a draft that appear neither in
 * the sources nor as visible arithmetic on them. Returned as the sentence or
 * table row that states them, for the bidder to check.
 */
export function unsupportedFigures(markdown: string, sourceText: string, limit = 30): string[] {
  const grounded = derivedValues(markdown.replace(PLACEHOLDER, " "), [...numbersIn(sourceText)]);
  const flagged: string[] = [];
  for (const sentence of sentences(markdown)) {
    const text = sentence.replace(PLACEHOLDER, " ").replace(CITATION, " ");
    const figures = [...text.matchAll(FIGURE)].map((match) => match[0]);
    const missing = figures.filter((figure) => {
      const value = valueOf(figure);
      return value !== null && !known(value, grounded);
    });
    if (missing.length === 0) continue;
    const line = readable(sentence);
    if (line && !flagged.includes(line)) flagged.push(line);
    if (flagged.length >= limit) break;
  }
  return flagged;
}

/** Absolute claims evaluators distrust unless they are proven. */
const OVERCLAIMS: RegExp[] = [
  /\bzero[- ]trust\b/i,
  /\bfull(?:y)? complian(?:t|ce)\b/i,
  /\bin full compliance\b/i,
  /\bguarantee(?:s|d)?\b/i,
  /\bzero (?:data loss|downtime|incidents?|disruption|defects)\b/i,
  /\b100 ?% (?:uptime|availability|compliance|satisfaction|success)\b/i,
  /\bnever (?:fails?|misse[sd]|lost)\b/i,
  /\buniquely (?:qualified|positioned)\b/i,
  /\bproven track record\b/i,
  /\b(?:industry|market)[- ]leading\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bworld[- ]class\b/i,
  /\bunmatched\b|\bunparalleled\b|\bsecond to none\b/i,
];

/**
 * Sentences making an absolute claim (guarantees, "zero-trust", "full
 * compliance", "uniquely qualified") that the library itself never makes.
 */
export function overclaims(markdown: string, libraryText: string, limit = 20): string[] {
  const flagged: string[] = [];
  for (const sentence of sentences(markdown)) {
    const text = sentence.replace(PLACEHOLDER, " ");
    const hit = OVERCLAIMS.find((pattern) => pattern.test(text) && !pattern.test(libraryText));
    if (!hit) continue;
    const line = readable(sentence);
    if (line && !flagged.includes(line)) flagged.push(line);
    if (flagged.length >= limit) break;
  }
  return flagged;
}

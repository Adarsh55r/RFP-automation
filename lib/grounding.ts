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

const WORD_NUMBER = Object.keys(NUMBER_WORDS).join("|");
const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?|${WORD_NUMBER})`;
const DURATION_UNITS = String.raw`minutes?|mins?|hours?|hrs?|business days?|calendar days?|working days?|days?|weeks?|months?|years?`;
const DATA_UNITS = String.raw`KB|MB|GB|TB|PB|kilobytes?|megabytes?|gigabytes?|terabytes?`;
const COUNT_NOUNS = String.raw`users?|servers?|workstations?|devices?|endpoints?|engineers?|technicians?|employees?|staff|consultants?|clients?|customers?|sites?|locations?|offices?|branches|references?|visits?|projects?|municipalities|townships|cities|villages|libraries|seats?|licen[cs]es?|mailboxes|computers?`;

type FigureKind = "money" | "percent" | "duration" | "data" | "count";
type Figure = { kind: FigureKind; value: number; unit: string; raw: string };

function numberValue(text: string) {
  const word = NUMBER_WORDS[text.toLowerCase()];
  if (word !== undefined) return word;
  const value = Number(text.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function durationUnit(unit: string) {
  const u = unit.toLowerCase();
  if (u.startsWith("min")) return "minute";
  if (u.startsWith("h")) return "hour";
  if (u.includes("day")) return "day";
  if (u.startsWith("week")) return "week";
  if (u.startsWith("month")) return "month";
  return "year";
}

const DATA_IN_GB: Record<string, number> = { k: 1 / 1024 / 1024, m: 1 / 1024, g: 1, t: 1024, p: 1024 * 1024 };

/**
 * Every figure a text states, by kind: money, percentages, durations (by
 * unit: "30 days" is not "30 minutes"), data sizes (in GB) and counts of
 * things ("15 workstations"). Number words count too ("four weeks").
 */
export function figuresIn(text: string, { wordsAsNumbers = true } = {}): Figure[] {
  const figures: Figure[] = [];
  const num = wordsAsNumbers ? NUMBER : String.raw`(\d[\d,]*(?:\.\d+)?)`;
  for (const match of text.matchAll(/[$£€]\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(k|mm|m|bn|thousand|million|billion)\b)?/gi)) {
    const base = numberValue(match[1]);
    if (base === null) continue;
    figures.push({ kind: "money", value: base * (match[2] ? (MULTIPLIERS[match[2].toLowerCase()] ?? 1) : 1), unit: "", raw: match[0] });
  }
  for (const match of text.matchAll(/\b(\d[\d,]*(?:\.\d+)?)\s?(?:%|percent\b)/gi)) {
    const value = numberValue(match[1]);
    if (value !== null) figures.push({ kind: "percent", value, unit: "", raw: match[0] });
  }
  for (const match of text.matchAll(new RegExp(String.raw`\b${num}[\s-]?(${DURATION_UNITS})\b`, "gi"))) {
    const value = numberValue(match[1]);
    if (value !== null) figures.push({ kind: "duration", value, unit: durationUnit(match[2]), raw: match[0] });
  }
  for (const match of text.matchAll(new RegExp(String.raw`\b(\d[\d,]*(?:\.\d+)?)\s?(${DATA_UNITS})\b`, "gi"))) {
    const value = numberValue(match[1]);
    if (value !== null) figures.push({ kind: "data", value: value * DATA_IN_GB[match[2][0].toLowerCase()], unit: "GB", raw: match[0] });
  }
  for (const match of text.matchAll(new RegExp(String.raw`\b${num}\s+(?:[a-z][a-z-]*\s+){0,2}(${COUNT_NOUNS})\b`, "gi"))) {
    const value = numberValue(match[1]);
    if (value !== null) figures.push({ kind: "count", value, unit: match[2].toLowerCase().replace(/e?s$/, ""), raw: match[0] });
  }
  return figures;
}

/** Figures the sources state, plus "Week 4"-style durations written unit first. */
function sourceFigures(sourceText: string) {
  const figures = figuresIn(sourceText);
  for (const match of sourceText.matchAll(new RegExp(String.raw`\b(minute|hour|day|week|month|year)s?\s+${NUMBER}\b`, "gi"))) {
    const value = numberValue(match[2]);
    if (value !== null) figures.push({ kind: "duration", value, unit: durationUnit(match[1]), raw: match[0] });
  }
  return figures;
}

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
  return values.slice(grounded.length);
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
 * Figures in a draft that the sources do not state and the draft does not
 * show as arithmetic on them. Each kind is matched like for like: money with
 * money (or a shown calculation), percentages with percentages, durations
 * with durations in the same unit, data sizes with data sizes. Returned as
 * the sentence or table row that states them, for the bidder to check.
 */
export function unsupportedFigures(markdown: string, sourceText: string, limit = 30): string[] {
  const sources = sourceFigures(sourceText);
  const of = (kind: FigureKind, unit?: string) =>
    sources.filter((figure) => figure.kind === kind && (unit === undefined || figure.unit === unit)).map((figure) => figure.value);
  const money = of("money");
  const bare = [...numbersIn(sourceText)];
  const derived = derivedValues(markdown.replace(PLACEHOLDER, " "), [...money, ...bare]);
  const supported = (figure: Figure) => {
    switch (figure.kind) {
      case "money":
        return known(figure.value, money) || known(figure.value, derived);
      case "percent":
        return known(figure.value, of("percent"));
      case "duration":
        return known(figure.value, of("duration", figure.unit));
      case "data":
        return known(figure.value, of("data"));
      case "count":
        // Quantities are often restated loosely ("five servers"); any number the sources use is accepted.
        return known(figure.value, bare);
    }
  };

  const flagged: string[] = [];
  for (const sentence of sentences(markdown)) {
    const text = sentence.replace(PLACEHOLDER, " ").replace(CITATION, " ");
    if (!figuresIn(text, { wordsAsNumbers: false }).some((figure) => !supported(figure))) continue;
    const line = readable(sentence);
    if (line && !flagged.includes(line)) flagged.push(line);
    if (flagged.length >= limit) break;
  }
  return flagged;
}

/** Things a price is commonly quoted per; two different prices per the same thing are worth a second look. */
const RATE = new RegExp(
  String.raw`([$£€]\s?\d[\d,]*(?:\.\d+)?)\s*(?:per|/|a|an|each)\s*(user|server|device|workstation|endpoint|seat|licen[cs]e|site|location|mailbox|computer)s?\b`,
  "gi",
);

/**
 * Prices quoted per the same unit with different amounts in different places
 * ("$95 per user" in the cost proposal, "$99 per user" in the executive
 * summary). Different services can legitimately differ, so this is a prompt
 * to check, not an error.
 */
export function rateConflicts(sections: { title: string; content: string }[]) {
  const byUnit = new Map<string, Map<string, Set<string>>>();
  for (const { title, content } of sections) {
    for (const match of content.replace(PLACEHOLDER, " ").matchAll(RATE)) {
      const unit = match[2].toLowerCase().replace("licence", "license");
      const amount = match[1].replace(/\s/g, "").replace(/\.00$/, "");
      const amounts = byUnit.get(unit) ?? new Map<string, Set<string>>();
      amounts.set(amount, (amounts.get(amount) ?? new Set()).add(title));
      byUnit.set(unit, amounts);
    }
  }
  return [...byUnit.entries()]
    .filter(([, amounts]) => amounts.size > 1)
    .map(([unit, amounts]) => ({
      unit,
      amounts: [...amounts.entries()].map(([amount, where]) => ({ amount, where: [...where] })),
    }));
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

/** Phrases that are notes to the bidder, not text for the buyer. */
const BIDDER_NOTES: RegExp[] = [
  /\bbefore submission\b/i,
  /\bprior to submission\b/i,
  /\bto be (?:confirmed|verified|determined|provided|added|completed|finali[sz]ed)\b/i,
  /\bsubject to (?:verification|confirmation)\b/i,
  /\b(?:must|should|needs? to) be (?:confirmed|verified) (?:against|with|by the (?:company|bidder|proposer))\b/i,
  /\b(?:company|bidder|proposer)'?s? (?:authori[sz]ed )?representative (?:must|should|needs? to)\b/i,
  /\bsubject to (?:their )?availability and review\b/i,
  /\binsert (?:here|below)\b/i,
  /\bTBD\b|\bTBC\b/,
];

/**
 * Sentences that speak to the bidder ("to be confirmed", "must be verified
 * before submission") instead of to the buyer. The prompt asks for
 * placeholders; these slip through as ordinary text that would be submitted.
 */
export function bidderNotes(markdown: string, limit = 20): string[] {
  const flagged: string[] = [];
  for (const sentence of sentences(markdown)) {
    const text = sentence.replace(PLACEHOLDER, " ");
    if (!BIDDER_NOTES.some((pattern) => pattern.test(text))) continue;
    const line = readable(sentence);
    if (line && !flagged.includes(line)) flagged.push(line);
    if (flagged.length >= limit) break;
  }
  return flagged;
}

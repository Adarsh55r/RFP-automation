/**
 * Scoring for the extraction benchmark. Pure functions, unit-tested in
 * tests/unit/benchmark-score.test.ts, so the numbers in a report can be trusted
 * independently of the AI run that produced them.
 */

export type GoldRequirement = { text: string; mandatory: boolean };

export type GoldFile = {
  /** File name in benchmark/rfps/. */
  rfp: string;
  /** Segment or industry tag, for the per-segment breakdown. */
  segment: string;
  sector: "public" | "commercial";
  /** Where the public RFP came from, for the published report. */
  source?: string;
  requirements: GoldRequirement[];
};

export type ExtractedItem = { text: string; mandatory: boolean };

const STOP = new Set("the a an and or of to for in on by with be is are must shall will should may any all each this that its their your our from as at".split(" "));

export function tokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9$£€%.]+/g, " ")
      .split(" ")
      .map((word) => word.replace(/\.$/, ""))
      .filter((word) => word.length > 1 && !STOP.has(word)),
  );
}

/**
 * How well an extracted item covers a gold requirement (0–1): the share of
 * the gold item's meaningful words that appear in the extracted item. Numbers
 * must match exactly when the gold item has any (a wrong amount is a miss).
 */
export function coverage(gold: string, extracted: string) {
  const goldTokens = tokens(gold);
  const extractedTokens = tokens(extracted);
  if (goldTokens.size === 0) return 0;
  const goldNumbers = [...goldTokens].filter((word) => /\d/.test(word));
  if (goldNumbers.some((number) => !extractedTokens.has(number))) return 0;
  let shared = 0;
  for (const word of goldTokens) if (extractedTokens.has(word)) shared += 1;
  return shared / goldTokens.size;
}

export const MATCH_THRESHOLD = 0.6;

/** Greedy one-to-one matching of gold requirements to extracted items, best pairs first. */
export function matchRequirements(gold: GoldRequirement[], extracted: ExtractedItem[], threshold = MATCH_THRESHOLD) {
  const pairs: { g: number; e: number; score: number }[] = [];
  gold.forEach((item, g) =>
    extracted.forEach((candidate, e) => {
      const score = coverage(item.text, candidate.text);
      if (score >= threshold) pairs.push({ g, e, score });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);
  const usedGold = new Set<number>();
  const usedExtracted = new Set<number>();
  const matches: { gold: number; extracted: number; score: number }[] = [];
  for (const pair of pairs) {
    if (usedGold.has(pair.g) || usedExtracted.has(pair.e)) continue;
    usedGold.add(pair.g);
    usedExtracted.add(pair.e);
    matches.push({ gold: pair.g, extracted: pair.e, score: pair.score });
  }
  return matches;
}

export type RfpScore = {
  rfp: string;
  segment: string;
  sector: "public" | "commercial";
  goldTotal: number;
  goldMandatory: number;
  extractedTotal: number;
  matched: number;
  mandatoryMatched: number;
  recall: number;
  mandatoryRecall: number;
  /** Matched ÷ extracted. A lower bound: extracted items missing from the gold list count against it. */
  precision: number;
  missedMandatory: string[];
  seconds: number;
  costUsd: number;
  error?: string;
};

export function scoreRfp(gold: GoldFile, extracted: ExtractedItem[], seconds: number, costUsd: number): RfpScore {
  const matches = matchRequirements(gold.requirements, extracted);
  const matchedGold = new Set(matches.map((match) => match.gold));
  const mandatoryIndexes = gold.requirements.map((item, index) => (item.mandatory ? index : -1)).filter((index) => index >= 0);
  const mandatoryMatched = mandatoryIndexes.filter((index) => matchedGold.has(index)).length;
  const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);
  return {
    rfp: gold.rfp,
    segment: gold.segment,
    sector: gold.sector,
    goldTotal: gold.requirements.length,
    goldMandatory: mandatoryIndexes.length,
    extractedTotal: extracted.length,
    matched: matches.length,
    mandatoryMatched,
    recall: ratio(matches.length, gold.requirements.length),
    mandatoryRecall: ratio(mandatoryMatched, mandatoryIndexes.length),
    precision: ratio(matches.length, extracted.length),
    missedMandatory: mandatoryIndexes.filter((index) => !matchedGold.has(index)).map((index) => gold.requirements[index].text),
    seconds,
    costUsd,
  };
}

/** Totals pooled over requirements (not an average of per-RFP percentages). */
export function aggregate(scores: RfpScore[]) {
  const ok = scores.filter((score) => !score.error);
  const sum = (pick: (score: RfpScore) => number) => ok.reduce((total, score) => total + pick(score), 0);
  const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);
  const costs = ok.map((score) => score.costUsd).sort((a, b) => a - b);
  return {
    rfps: ok.length,
    failed: scores.length - ok.length,
    recall: ratio(sum((s) => s.matched), sum((s) => s.goldTotal)),
    mandatoryRecall: ratio(sum((s) => s.mandatoryMatched), sum((s) => s.goldMandatory)),
    precision: ratio(sum((s) => s.matched), sum((s) => s.extractedTotal)),
    avgSeconds: ratio(sum((s) => s.seconds), ok.length),
    avgCostUsd: ratio(sum((s) => s.costUsd), ok.length),
    p95CostUsd: costs.length ? costs[Math.min(costs.length - 1, Math.ceil(costs.length * 0.95) - 1)] : 0,
  };
}

export function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

export const TARGET_MANDATORY_RECALL = 0.85;
export const TARGET_RFP_COUNT = 20;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function renderReport(scores: RfpScore[], meta: { date: string; model: string }) {
  const total = aggregate(scores);
  const lines = [
    `# Extraction benchmark: ${meta.date}`,
    "",
    `Model: ${meta.model}. RFPs scored: ${total.rfps}${total.failed ? ` (${total.failed} failed to run)` : ""}.`,
    "",
    "## Overall",
    "",
    "| Mandatory recall | Recall | Precision (lower bound) | Avg time | Avg cost | p95 cost |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${pct(total.mandatoryRecall)} | ${pct(total.recall)} | ${pct(total.precision)} | ${total.avgSeconds.toFixed(1)} s | $${total.avgCostUsd.toFixed(3)} | $${total.p95CostUsd.toFixed(3)} |`,
    "",
    `Launch target: mandatory recall of at least ${pct(TARGET_MANDATORY_RECALL)} across ${TARGET_RFP_COUNT} RFPs. This run: ${pct(total.mandatoryRecall)} across ${total.rfps} RFP${total.rfps === 1 ? "" : "s"}, so the target is ${total.rfps >= TARGET_RFP_COUNT && total.mandatoryRecall >= TARGET_MANDATORY_RECALL ? "**met**" : "**not met**"}.`,
    "",
    "Precision counts every extracted item that is not on the gold list as wrong, so it understates precision when the gold lists are incomplete.",
    "",
  ];
  for (const [title, key] of [
    ["By segment", (score: RfpScore) => score.segment],
    ["By sector", (score: RfpScore) => score.sector],
  ] as const) {
    lines.push(`## ${title}`, "", "| Group | RFPs | Mandatory recall | Recall | Precision |", "| --- | --- | --- | --- | --- |");
    for (const [group, items] of groupBy(scores, key)) {
      const agg = aggregate(items);
      lines.push(`| ${group} | ${agg.rfps} | ${pct(agg.mandatoryRecall)} | ${pct(agg.recall)} | ${pct(agg.precision)} |`);
    }
    lines.push("");
  }
  lines.push("## Per RFP", "", "| RFP | Segment | Mandatory | Recall | Precision | Time | Cost |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const score of scores) {
    lines.push(
      score.error
        ? `| ${score.rfp} | ${score.segment} | failed: ${score.error} | | | | |`
        : `| ${score.rfp} | ${score.segment} | ${score.mandatoryMatched}/${score.goldMandatory} | ${pct(score.recall)} | ${pct(score.precision)} | ${score.seconds.toFixed(1)} s | $${score.costUsd.toFixed(3)} |`,
    );
  }
  const missed = scores.filter((score) => score.missedMandatory.length > 0);
  if (missed.length) {
    lines.push("", "## Missed mandatory requirements", "");
    for (const score of missed) {
      lines.push(`### ${score.rfp}`, "", ...score.missedMandatory.map((text) => `- ${text}`), "");
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Extraction accuracy benchmark.
 *
 *   npm run benchmark                 # every gold file
 *   npm run benchmark -- --only=foo   # gold files whose name contains "foo"
 *
 * Reads public RFPs from benchmark/rfps/ and hand-built gold requirement lists
 * from benchmark/gold/*.json (format: scripts/benchmark/score.ts → GoldFile),
 * runs the app's real extraction on each, and writes a Markdown report to
 * benchmark/results/<date>.md. Needs an AI provider key (OPENAI_API_KEY, or
 * ANTHROPIC_API_KEY / GEMINI_API_KEY) and spends real money: roughly the cost
 * of one extraction per RFP. No database is used.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderReport, scoreRfp, type ExtractedItem, type GoldFile, type RfpScore } from "./score";

// The app's modules create a database client when loaded; the benchmark never
// queries it, so a placeholder address is enough when none is configured.
process.env.DATABASE_URL ||= "postgresql://benchmark:unused@localhost:5432/unused";

const app = async () => ({
  ...(await import("@/lib/ai-usage")),
  ...(await import("@/lib/key-details")),
  ...(await import("@/lib/llm")),
  ...(await import("@/lib/ocr")),
  ...(await import("@/lib/rfp-extract")),
});
type App = Awaited<ReturnType<typeof app>>;

const ROOT = path.resolve(__dirname, "../../benchmark");

function extractedItems(
  { parseKeyDetails }: App,
  extracted: Awaited<ReturnType<App["extractRequirementsWithLlm"]>>,
  documentText: string,
): ExtractedItem[] {
  const list = (items: string[], mandatory: boolean) => items.map((text) => ({ text, mandatory }));
  return [
    ...list(extracted.eligibilityCriteria, true),
    ...list(extracted.submissionRequirements, true),
    ...list(extracted.desirableCriteria, false),
    ...list(extracted.evaluationCriteria, false),
    ...list(extracted.questionnaireItems, true),
    ...parseKeyDetails(extracted.keyDetails, documentText).map((detail) => ({
      text: detail.detail,
      mandatory: detail.kind === "mandatory",
    })),
    ...(extracted.deadline ? [{ text: `Submission deadline ${extracted.deadline}`, mandatory: true }] : []),
  ];
}

async function runOne(lib: App, gold: GoldFile): Promise<RfpScore> {
  const started = Date.now();
  let costMicros = 0;
  const onUsage = (usage: Parameters<App["usageCostMicros"]>[0]) => {
    costMicros += lib.usageCostMicros(usage);
  };
  try {
    const buffer = readFileSync(path.join(ROOT, "rfps", gold.rfp));
    const read = await lib.readRfpDocument(buffer, gold.rfp, onUsage);
    if (!read.ok) throw new Error(read.error);
    const extracted = await lib.extractRequirementsWithLlm(read.text, onUsage);
    return scoreRfp(gold, extractedItems(lib, extracted, read.text), (Date.now() - started) / 1000, costMicros / 1_000_000);
  } catch (error) {
    const score = scoreRfp(gold, [], (Date.now() - started) / 1000, costMicros / 1_000_000);
    return { ...score, error: error instanceof Error ? error.message.slice(0, 120) : "unknown error" };
  }
}

async function main() {
  const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
  const goldFiles = readdirSync(path.join(ROOT, "gold"))
    .filter((name) => name.endsWith(".json") && !name.startsWith("example") && (!only || name.includes(only)))
    .sort();
  if (goldFiles.length === 0) {
    console.error("No gold files in benchmark/gold/. See benchmark/README.md for the format.");
    process.exit(1);
  }
  const lib = await app();
  const scores: RfpScore[] = [];
  for (const name of goldFiles) {
    const gold = JSON.parse(readFileSync(path.join(ROOT, "gold", name), "utf8")) as GoldFile;
    process.stdout.write(`${gold.rfp} … `);
    const score = await runOne(lib, gold);
    scores.push(score);
    console.log(score.error ? `failed (${score.error})` : `mandatory ${score.mandatoryMatched}/${score.goldMandatory}, ${score.seconds.toFixed(0)} s`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const report = renderReport(scores, { date, model: lib.getLlmProvider() });
  const out = path.join(ROOT, "results", `${date}.md`);
  writeFileSync(out, report);
  console.log(`\nReport written to ${path.relative(process.cwd(), out)}`);
}

void main();

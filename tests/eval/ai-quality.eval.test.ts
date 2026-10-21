/**
 * REAL-MODEL evaluation. Costs money (roughly $0.50-1.50 per full run on
 * GPT-4.1) and needs OPENAI_API_KEY. Run with: npm run eval:ai
 * Results are model-dependent; record them in AI_QUALITY_EVALUATION.md.
 */
import { describe, expect, it } from "vitest";
import { generateLlmText } from "@/lib/llm";
import { extractRequirementsWithLlm, type ExtractionResult } from "@/lib/rfp-extract";
import { verifyExtraction } from "@/lib/extraction-checks";
import { findUnverifiedCredentials } from "@/lib/claim-checks";
import { buildDraftingContext, buildPlanTask, buildSectionTask, DRAFTING_SYSTEM, parseDraftPlan } from "@/lib/rfp-draft";
import { FIXTURES, LIMITED_LIBRARY } from "../fixtures/rfps";
import type { LibraryItem, Rfp } from "@/lib/generated/prisma";

const enabled = Boolean(process.env.OPENAI_API_KEY);
const norm = (s: string) => s.toLowerCase().replace(/[\s,]+/g, " ");

function score(result: ExtractionResult, fx: (typeof FIXTURES)[number]) {
  const lists = [...result.eligibilityCriteria, ...result.desirableCriteria, ...result.submissionRequirements].map(norm);
  const mandatoryHits = fx.expected.mandatoryKeywords.filter((kws) =>
    result.eligibilityCriteria.map(norm).some((item) => kws.every((k) => item.includes(norm(k)))),
  ).length;
  const evalHits = fx.expected.evaluationKeywords.filter((kws) =>
    result.evaluationCriteria.map(norm).some((item) => kws.every((k) => item.includes(norm(k)))),
  ).length;
  const everything = norm(JSON.stringify(result));
  const prohibited = fx.expected.prohibited.filter((p) => everything.includes(norm(p)));
  const flags = verifyExtraction(result, fx.text).flags;
  return {
    id: fx.id,
    deadlineOk: result.deadline === fx.expected.deadline || (fx.expected.deadline === null && flags.some((f) => /deadline/i.test(f))),
    mandatoryRecall: fx.expected.mandatoryKeywords.length ? mandatoryHits / fx.expected.mandatoryKeywords.length : 1,
    evaluationRecall: fx.expected.evaluationKeywords.length ? evalHits / fx.expected.evaluationKeywords.length : 1,
    questionsOk: result.questionnaireItems.length === fx.expected.questionCount,
    prohibited,
    flagged: (fx.expected.shouldFlag ?? []).every((f) => [...result.flaggedForReview, ...flags].some((x) => x.toLowerCase().includes(f))),
    listCount: lists.length,
  };
}

describe.skipIf(!enabled)("real-model extraction quality (GPT-4.1)", () => {
  const rows: ReturnType<typeof score>[] = [];

  for (const fx of FIXTURES) {
    it(`${fx.id}: ${fx.scenario}`, { timeout: 300_000 }, async () => {
      const result = await extractRequirementsWithLlm(fx.text);
      const row = score(result, fx);
      rows.push(row);
      console.log(JSON.stringify(row));
      expect(row.prohibited, "hallucinated or injected values").toEqual([]);
      expect(row.mandatoryRecall).toBeGreaterThanOrEqual(0.75);
      expect(row.deadlineOk).toBe(true);
      expect(row.questionsOk).toBe(true);
      expect(row.flagged).toBe(true);
    });
  }
});

describe.skipIf(!enabled)("real-model drafting honesty (GPT-4.1)", () => {
  it("does not claim SOC 2 or $2M insurance the bidder's library does not support", { timeout: 300_000 }, async () => {
    const fx = FIXTURES[0];
    const rfp = {
      title: "Fort Hollow Managed IT",
      extractedDocumentType: "public_tender",
      extractedDeadline: new Date("2026-11-20"),
      extractedScope: "Managed IT for the City of Fort Hollow",
      extractedEligibility: ["Current SOC 2 Type II report", "General liability insurance of at least $2,000,000 per occurrence"],
      extractedDesirable: [], extractedEvaluationCriteria: [], extractedSubmission: [], extractedQuestionnaire: [], extractedFlags: [],
    } as unknown as Rfp;
    const library = LIMITED_LIBRARY.map((item, i) => ({ ...item, id: String(i), userId: "u", createdAt: new Date() })) as LibraryItem[];
    const context = buildDraftingContext({ companyName: "Ridgeline IT Services LLC", rfp, libraryItems: library, sourceText: fx.text });
    const plan = parseDraftPlan(JSON.parse(await generateLlmText({ purpose: "drafting", system: DRAFTING_SYSTEM, context, user: buildPlanTask(), json: true, maxTokens: 8000 })));
    const draft = await generateLlmText({ purpose: "drafting", system: DRAFTING_SYSTEM, context, user: buildSectionTask("team", plan), maxTokens: 16000 });
    const libraryText = LIMITED_LIBRARY.map((i) => i.content).join("\n");
    console.log(draft);
    expect(findUnverifiedCredentials(draft.replace(/RFP requires[^.]*\./gi, ""), libraryText)).toEqual([]);
    expect(draft).not.toMatch(/we (carry|hold|maintain)[^.]*\$2,000,000/i);
  });
});

import { describe, expect, it } from "vitest";
import { parseExtractionJson, type ExtractionResult } from "@/lib/rfp-extract";
import { verifyExtraction } from "@/lib/extraction-checks";
import { FIXTURES } from "../fixtures/rfps";

const fx = (id: string) => FIXTURES.find((f) => f.id === id)!;

function result(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    documentType: "public_tender",
    scope: "Managed IT",
    deadline: "2026-11-20",
    eligibilityCriteria: ["Current Kentucky business license"],
    desirableCriteria: [],
    evaluationCriteria: ["Technical approach: 40 points"],
    questionnaireItems: Array.from({ length: 5 }, (_, i) => `Q${i + 1}. question`),
    flaggedForReview: [],
    submissionRequirements: [],
    ...overrides,
  };
}

describe("verifyExtraction (deterministic checks against the source text)", () => {
  it("accepts a deadline written in the document in words", () => {
    expect(verifyExtraction(result(), fx("straightforward-public-tender").text).flags).toEqual([]);
  });

  it("accepts the addendum's amended deadline", () => {
    const flags = verifyExtraction(result({ deadline: "2026-12-04" }), fx("addendum-overrides-deadline").text).flags;
    expect(flags.join(" ")).not.toMatch(/deadline/i);
  });

  it("flags a deadline that is not in the document (hallucination trap)", () => {
    const flags = verifyExtraction(result({ deadline: "2030-01-01" }), fx("prompt-injection").text.replace(/2030-01-01/g, "")).flags;
    expect(flags.join(" ")).toMatch(/deadline/i);
  });

  it("flags conflicting due dates when there is no addendum", () => {
    const flags = verifyExtraction(result(), fx("conflicting-deadline-no-addendum").text).flags;
    expect(flags.join(" ")).toMatch(/November 20, 2026|November 27, 2026/);
  });

  it("flags dropped questions", () => {
    const flags = verifyExtraction(result({ questionnaireItems: ["1. a", "2. b"] }), fx("security-questionnaire-60").text).flags;
    expect(flags.join(" ")).toMatch(/60/);
  });

  it("does not flag when all numbered questions were captured", () => {
    const items = Array.from({ length: 60 }, (_, i) => `${i + 1}. q`);
    const flags = verifyExtraction(result({ questionnaireItems: items, deadline: "2027-01-15", eligibilityCriteria: [] }), fx("security-questionnaire-60").text).flags;
    expect(flags).toEqual([]);
  });

  it("flags a mandatory requirement whose wording cannot be found in the document", () => {
    const flags = verifyExtraction(
      result({ eligibilityCriteria: ["Current Kentucky business license", "FedRAMP High authorization required"] }),
      fx("straightforward-public-tender").text,
    ).flags;
    expect(flags.join(" ")).toMatch(/FedRAMP/);
    expect(flags.join(" ")).not.toMatch(/Kentucky business license/);
  });
});

describe("parseExtractionJson", () => {
  it("keeps a multi-line question as one item so editing cannot split it", () => {
    const parsed = parseExtractionJson(JSON.stringify({ questionnaireItems: ["Q1. Describe:\n a) staffing\n b) tools"] }));
    expect(parsed.questionnaireItems).toEqual(["Q1. Describe: a) staffing b) tools"]);
  });
});

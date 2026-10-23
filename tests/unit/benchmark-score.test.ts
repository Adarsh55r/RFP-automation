import { describe, expect, it } from "vitest";
import { aggregate, coverage, matchRequirements, renderReport, scoreRfp, type GoldFile } from "../../scripts/benchmark/score";

const gold: GoldFile = {
  rfp: "city.pdf",
  segment: "it-services",
  sector: "public",
  requirements: [
    { text: "General liability insurance of $2,000,000 per occurrence", mandatory: true },
    { text: "Maximum 20 pages excluding appendices", mandatory: true },
    { text: "Current Kentucky business license", mandatory: true },
    { text: "Experience with municipal clients", mandatory: false },
  ],
};

describe("benchmark scoring", () => {
  it("matches reworded items but never a wrong number", () => {
    expect(coverage("Maximum 20 pages excluding appendices", "Responses must not exceed 20 pages, excluding appendices")).toBeGreaterThanOrEqual(0.6);
    expect(coverage("General liability insurance of $2,000,000 per occurrence", "General liability insurance $1,000,000 per occurrence")).toBe(0);
    expect(coverage("Current Kentucky business license", "Insurance certificate")).toBe(0);
  });

  it("matches one-to-one, best pairs first", () => {
    const matches = matchRequirements(gold.requirements, [
      { text: "Kentucky business license required", mandatory: true },
      { text: "Kentucky business license (current)", mandatory: true },
    ]);
    expect(matches).toHaveLength(1);
  });

  it("scores recall, mandatory recall and lower-bound precision, and lists missed mandatory items", () => {
    const score = scoreRfp(
      gold,
      [
        { text: "Responses must not exceed 20 pages excluding appendices", mandatory: true },
        { text: "Kentucky business license, current", mandatory: true },
        { text: "General liability insurance $1,000,000 per occurrence", mandatory: true },
        { text: "Prior work with municipal clients preferred", mandatory: false },
        { text: "Submit three copies", mandatory: true },
      ],
      30,
      0.42,
    );
    expect(score).toMatchObject({ matched: 3, mandatoryMatched: 2, goldMandatory: 3 });
    expect(score.recall).toBeCloseTo(0.75);
    expect(score.mandatoryRecall).toBeCloseTo(2 / 3);
    expect(score.precision).toBeCloseTo(0.6);
    expect(score.missedMandatory).toEqual(["General liability insurance of $2,000,000 per occurrence"]);
  });

  it("pools totals over requirements, leaves failed runs out, and reports the launch target honestly", () => {
    const good = scoreRfp(gold, gold.requirements, 10, 0.5);
    const failed = { ...scoreRfp({ ...gold, rfp: "broken.pdf" }, [], 1, 0), error: "could not read" };
    const total = aggregate([good, failed]);
    expect(total).toMatchObject({ rfps: 1, failed: 1, recall: 1, mandatoryRecall: 1, avgCostUsd: 0.5 });
    const report = renderReport([good, failed], { date: "2026-10-25", model: "openai" });
    expect(report).toContain("across 1 RFP, so the target is **not met**");
    expect(report).toContain("| broken.pdf | it-services | failed: could not read |");
  });
});

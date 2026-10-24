import { describe, expect, it } from "vitest";
import { changeCount, changesFlag, diffRequirements, similarity, type RequirementLists } from "@/lib/requirement-diff";

const base: RequirementLists = {
  deadline: "2026-11-20",
  eligibility: ["General liability insurance of at least $1,000,000 per occurrence", "Current Kentucky business license"],
  desirable: [],
  evaluation: ["Technical approach: 40 points", "Price: 25 points"],
  submission: ["Maximum 20 pages"],
  questionnaire: ["Q1. Describe your transition plan."],
};

describe("requirement diff", () => {
  it("reports a moved deadline, reworded, added and removed items, and ignores reordering", () => {
    const changes = diffRequirements(
      base,
      {
        ...base,
        deadline: "2026-12-04",
        eligibility: ["Current Kentucky business license", "General liability insurance of at least $2,000,000 per occurrence"],
        evaluation: ["Price: 25 points", "Technical approach: 40 points", "Local presence: 10 points"],
        submission: [],
      },
      ["Addendum 1.pdf"],
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(changes.deadline).toEqual({ from: "2026-11-20", to: "2026-12-04" });
    expect(changes.changed).toEqual([
      {
        field: "eligibility",
        from: "General liability insurance of at least $1,000,000 per occurrence",
        to: "General liability insurance of at least $2,000,000 per occurrence",
      },
    ]);
    expect(changes.added).toEqual([{ field: "evaluation", text: "Local presence: 10 points" }]);
    expect(changes.removed).toEqual([{ field: "submission", text: "Maximum 20 pages" }]);
    expect(changeCount(changes)).toBe(4);
    expect(changesFlag(changes)).toBe(
      'Addenda (Addendum 1.pdf): deadline 2026-11-20 → 2026-12-04, 1 added, 1 changed, 1 removed. See "What the addenda changed", and update any drafted sections they affect.',
    );
  });

  it("says so when nothing changed", () => {
    const changes = diffRequirements(base, { ...base }, ["A.pdf"]);
    expect(changeCount(changes)).toBe(0);
    expect(changesFlag(changes)).toMatch(/No changes .* still read the addenda yourself/);
  });

  it("unrelated items are not paired as a change", () => {
    expect(similarity("Maximum 20 pages", "Provide three references")).toBeLessThan(0.5);
  });
});

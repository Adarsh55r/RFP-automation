import { describe, expect, it } from "vitest";
import { citedClaims, parseFactCheck, planFactCheck } from "@/lib/fact-check";
import { complianceRows } from "@/lib/proposal-document";

describe("fact-check", () => {
  it("collects cited sentences and table rows, without markers", () => {
    const md = [
      "## Experience",
      "",
      "We found that backups had been failing for 4 months [S5]. We will review every alert.",
      "",
      "| Client | Result |",
      "| --- | --- |",
      "| Cedar Hollow | 99.9% uptime [S7] |",
    ].join("\n");
    expect(citedClaims(md)).toEqual([
      { claim: "We found that backups had been failing for 4 months.", ids: ["S5"] },
      { claim: "Cedar Hollow · 99.9% uptime", ids: ["S7"] },
    ]);
  });

  it("maps distorted and unsupported claims back to their sections", () => {
    const plan = planFactCheck([
      {
        key: "team",
        content: "After a regional ransomware incident we rebuilt Leland Township's backups [S5]. Marcus led it [S6].",
        sources: {
          S5: { itemId: "a", title: "Leland", type: "case_study", excerpt: "After a ransomware attempt at a neighbouring township, we replaced the backups." },
          S6: { itemId: "b", title: "Marcus", type: "team_bio", excerpt: "Marcus led the Leland Township backup project." },
        },
      },
    ]);
    expect(plan.items).toHaveLength(2);
    expect(plan.task).toContain('<source id="S5">After a ransomware attempt');
    const results = plan.results(
      JSON.stringify({
        results: [
          { n: 1, verdict: "distorted", issue: "The source says an attempt at a neighbouring township, not a regional incident." },
          { n: 2, verdict: "supported" },
          { n: 9, verdict: "distorted", issue: "out of range" },
        ],
      }),
    );
    expect(results.get("team")).toEqual([
      {
        claim: "After a regional ransomware incident we rebuilt Leland Township's backups.",
        issue: "The source says an attempt at a neighbouring township, not a regional incident.",
      },
    ]);
  });

  it("ignores unreadable replies", () => {
    expect(parseFactCheck("not json", 3).size).toBe(0);
    expect(parseFactCheck('{"results": "x"}', 3).size).toBe(0);
  });
});

describe("compliance matrix in the submitted copy", () => {
  it("drops scoring rows, logistics gaps, IDs and reviewer notes, and keeps unanswered mandatory items visible", () => {
    const review = [
      "| Requirement | Type | Addressed in | Status | What to do |",
      "| --- | --- | --- | --- | --- |",
      "| M1: 24/7 monitoring (Section 3.A) | Mandatory | E. Proposed Service Approach | Addressed | — |",
      "| M2: Proof of insurance | Mandatory | J. Required Disclosures (not in draft) | Partially addressed | Attach certificate |",
      "| M3: Signed service agreement | Mandatory | — | Gap | Attach agreement |",
      "| S1: One searchable PDF by email | Submission | — | Gap | Combine files |",
      "| E1: Cost, 35% | Evaluation | G. Cost Proposal | Addressed | — |",
    ].join("\n");
    expect(complianceRows(review)).toEqual([
      { requirement: "24/7 monitoring (Section 3.A)", type: "Mandatory", reference: "E. Proposed Service Approach" },
      { requirement: "Proof of insurance", type: "Mandatory", reference: "J. Required Disclosures" },
      { requirement: "Signed service agreement", type: "Mandatory", reference: "[[Answer this requirement before submitting]]" },
    ]);
  });
});

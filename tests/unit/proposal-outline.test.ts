import { describe, expect, it } from "vitest";
import {
  buildOutline,
  buildSectionTask,
  cleanSection,
  emptyDraftPlan,
  requirementRefs,
  verifiedReference,
} from "@/lib/rfp-draft";

const rfp = {
  extractedDocumentType: "public_tender" as const,
  extractedQuestionnaire: [] as string[],
  extractedEligibility: ["24/7 monitoring of servers", "Signed cover letter with 90-day validity", "At least three references"],
  extractedDesirable: ["Michigan presence"],
  extractedEvaluationCriteria: ["Cost: 35%"],
  extractedSubmission: ["One searchable PDF by email", "Completed Exhibit A"],
};
const refs = requirementRefs(rfp);

describe("requirement IDs", () => {
  it("number each kind of requirement in a stable order", () => {
    expect(refs.map((item) => item.id)).toEqual(["M1", "M2", "M3", "D1", "E1", "S1", "S2"]);
    expect(refs[1]).toMatchObject({ type: "Mandatory", text: "Signed cover letter with 90-day validity" });
  });
});

describe("proposal outline", () => {
  it("follows the RFP's own parts, labels and order when it prescribes them", () => {
    const { outline, fromRfp } = buildOutline(
      {
        prescribed: true,
        parts: [
          { title: "A. Cover Letter", kind: "cover_letter", asks: ["Firm name", "90-day validity"], covers: ["M2"] },
          { title: "B. Executive Summary", kind: "exec_summary", covers: [] },
          { title: "E. Proposed Service Approach", kind: "technical_approach", covers: ["M1", "X9"] },
          { title: "I. References", kind: "references", covers: ["m3"] },
          { title: "Exhibit A: Cost Proposal Summary", kind: "form", covers: ["S2"] },
          { title: "Second cover letter", kind: "cover_letter" },
        ],
      },
      rfp,
      refs,
    );
    expect(fromRfp).toBe(true);
    expect(outline.map((section) => [section.key, section.kind, section.title])).toEqual([
      ["cover_letter", "cover_letter", "A. Cover Letter"],
      ["exec_summary", "exec_summary", "B. Executive Summary"],
      ["technical_approach", "technical_approach", "E. Proposed Service Approach"],
      ["p-i-references", "general", "I. References"],
      ["p-exhibit-a-cost-proposal-summary", "form", "Exhibit A: Cost Proposal Summary"],
      ["p-second-cover-letter", "general", "Second cover letter"],
    ]);
    // Unknown IDs are dropped; lower-case IDs are accepted.
    expect(outline[2].covers).toEqual(["M1"]);
    expect(outline[3].covers).toEqual(["M3"]);
    expect(outline[0].asks).toEqual(["Firm name", "90-day validity"]);
  });

  it("gives every mandatory requirement a home, even when the model forgets one", () => {
    const { outline } = buildOutline(
      { prescribed: true, parts: [{ title: "Tab 1: Approach", kind: "technical_approach", covers: ["M1"] }, { title: "Tab 2: Price", kind: "pricing" }] },
      rfp,
      refs,
    );
    expect(outline[0].covers).toEqual(["M1", "M2", "M3"]);
  });

  it("uses the standard sections when the RFP prescribes none, keeping the assignments", () => {
    const { outline, fromRfp } = buildOutline(
      { prescribed: false, parts: [{ title: "Team & Past Performance", kind: "team", covers: ["M3"] }] },
      rfp,
      refs,
    );
    expect(fromRfp).toBe(false);
    expect(outline.map((section) => section.key)).toEqual(["cover_letter", "exec_summary", "technical_approach", "team", "pricing"]);
    expect(outline.find((section) => section.key === "team")?.covers).toEqual(["M3"]);
    // M1 and M2 were not assigned: they go to the technical approach.
    expect(outline.find((section) => section.key === "technical_approach")?.covers).toEqual(["M1", "M2"]);
  });

  it("falls back to the standard sections for unreadable outlines, and adds a questionnaire nobody answers", () => {
    const withQuestions = { ...rfp, extractedQuestionnaire: ["Do you offer 24/7 support?", "Where is your data stored?"] };
    const { outline } = buildOutline("nonsense", withQuestions, requirementRefs(withQuestions));
    expect(outline.map((section) => section.key)).toEqual(["cover_letter", "exec_summary", "technical_approach", "team", "pricing", "responses"]);
  });

  it("tells each part what the RFP asks of it and which requirements it must answer", () => {
    const { outline } = buildOutline(
      { prescribed: true, parts: [{ title: "I. References", kind: "general", asks: ["Entity name, contact, title, phone, email"], covers: ["M3"] }, { title: "G. Cost", kind: "pricing" }] },
      rfp,
      refs,
    );
    const task = buildSectionTask(outline[0], { ...emptyDraftPlan, outline }, outline, refs);
    expect(task).toContain('"I. References"');
    expect(task).toContain("- Entity name, contact, title, phone, email");
    expect(task).toContain("M3 (Mandatory): At least three references");
    expect(task).toContain("2. G. Cost");
  });
});

describe("drafted section clean-up", () => {
  it("removes the model's own heading numbers but keeps questionnaire numbers", () => {
    expect(cleanSection("## 2.1 Monitoring\n\nText\n\n### 1. Escalation\n\n## 2026 roadmap")).toBe(
      "## Monitoring\n\nText\n\n### Escalation\n\n## 2026 roadmap",
    );
    expect(cleanSection("### 4.2 Do you encrypt data?\n\nYes.", { keepHeadingNumbers: true })).toBe("### 4.2 Do you encrypt data?\n\nYes.");
  });
});

describe("solicitation reference", () => {
  const source = "CITY OF FORT HOLLOW Request for Proposals No. 2026-14 for Managed IT Services";
  it("keeps a reference printed in the RFP, however it is written", () => {
    expect(verifiedReference("RFP 2026-14", source)).toBe("RFP 2026-14");
    expect(verifiedReference("2026-14", source)).toBe("2026-14");
  });
  it("drops a reference the RFP never printed", () => {
    expect(verifiedReference("RFP-2026-00123", source)).toBe("");
    expect(verifiedReference("RFP", source)).toBe("");
  });
});

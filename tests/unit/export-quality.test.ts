import { describe, expect, it } from "vitest";
import { analyzeDraft, stripCitations } from "@/lib/citations";
import { citationIds, columnWidths, type InlineRun } from "@/lib/markdown";
import { parseDueDate, proposalDateLabel } from "@/lib/proposal-document";
import type { CoverDetails } from "@/lib/rfp-draft";

const runs = (text: string): InlineRun[] => [{ text }];

describe("citation markers", () => {
  it("strips ranges and lists from the clean copy", () => {
    expect(stripCitations("Similar environments [S4, S7–S10]. Also [S2; S3] and [S5-6].")).toBe(
      "Similar environments. Also and.",
    );
  });

  it("expands ranges and rewrites markers in one canonical form", () => {
    expect(citationIds("S4, S7–S10")).toEqual(["S4", "S7", "S8", "S9", "S10"]);
    const lookup = (id: string) => (["S4", "S7", "S8"].includes(id) ? { itemId: id, title: id, type: "case_study", excerpt: "" } : undefined);
    const { content, citations } = analyzeDraft("We support towns [S4, S7–S9].", lookup);
    expect(content).toBe("We support towns [S4, S7, S8].");
    expect(Object.keys(citations.sources).sort()).toEqual(["S4", "S7", "S8"]);
  });
});

describe("table column widths", () => {
  it("never makes a column narrower than its longest word", () => {
    const header = [runs("Line item"), runs("Monthly cost"), runs("Annual"), runs("Notes")];
    const rows = [
      [runs("Managed IT services for 15 workstations"), runs("$10,800.00"), runs("Included"), runs("A long note ".repeat(12))],
    ];
    const charWidth = 5.5;
    const widths = columnWidths(header, rows, 470, charWidth);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(470);
    expect(widths[1]).toBeGreaterThanOrEqual("$10,800.00".length * charWidth);
    expect(widths[2]).toBeGreaterThanOrEqual("Included".length * charWidth);
    expect(widths[3]).toBeGreaterThan(widths[2]);
  });
});

describe("cover submission date", () => {
  const cover = (fields: Partial<CoverDetails>): CoverDetails => ({
    projectTitle: "",
    solicitationNumber: "",
    buyerName: "",
    buyerAddress: "",
    dueDate: "",
    submissionDate: "",
    bidderName: "",
    contactName: "",
    contactTitle: "",
    contactEmail: "",
    contactPhone: "",
    ...fields,
  });

  it("reads common due-date formats", () => {
    expect(parseDueDate("September 4, 2026, by 4:59 p.m.")?.toDateString()).toBe(new Date(2026, 8, 4).toDateString());
    expect(parseDueDate("Friday 4th September 2026 at noon")?.toDateString()).toBe(new Date(2026, 8, 4).toDateString());
    expect(parseDueDate("2026-09-04T16:59")?.toDateString()).toBe(new Date(2026, 8, 4).toDateString());
    expect(parseDueDate("see portal")).toBeNull();
  });

  it("never dates the cover after the deadline", () => {
    const due = cover({ dueDate: "September 4, 2026, 4:59 p.m." });
    expect(proposalDateLabel(due, "en-US", new Date(2026, 9, 24))).toBe("");
    expect(proposalDateLabel(due, "en-US", new Date(2026, 8, 4, 15))).toBe("September 4, 2026");
    expect(proposalDateLabel({ ...due, submissionDate: "September 2, 2026" }, "en-US", new Date(2026, 9, 24))).toBe("September 2, 2026");
    expect(proposalDateLabel(cover({}), "en-GB", new Date(2026, 9, 24))).toBe("24 October 2026");
  });
});

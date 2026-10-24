import { describe, expect, it } from "vitest";
import { pageLimitFrom, pageLimitWarning } from "@/lib/page-limit";
import type { KeyDetail } from "@/lib/key-details";

const detail = (text: string): KeyDetail => ({ category: "length_limit", detail: text, kind: "mandatory", quote: null, page: null, verified: true });

describe("page limits", () => {
  it("reads the common ways RFPs state a page limit, and keeps the strictest", () => {
    expect(pageLimitFrom([detail("Proposals shall not exceed 25 pages excluding appendices")], [])).toEqual({
      pages: 25,
      source: "Proposals shall not exceed 25 pages excluding appendices",
    });
    expect(pageLimitFrom([], ["Maximum of 10 single-sided pages for the technical volume", "Font 11pt"])?.pages).toBe(10);
    expect(pageLimitFrom([detail("20-page limit")], ["no more than fifteen (15) pages"])?.pages).toBe(15);
    expect(pageLimitFrom([detail("Page limit: 30")], ["Up to 12 pages"])?.pages).toBe(12);
  });

  it("ignores page numbers that are not limits, and word limits", () => {
    expect(pageLimitFrom([detail("Maximum 500 words per question")], ["See page 12 for the form", "Return pages 4-6 signed"])).toBeNull();
  });

  it("warns only when the export is over the limit", () => {
    const limit = { pages: 20, source: "Maximum 20 pages" };
    expect(pageLimitWarning(20, limit, false)).toBeNull();
    expect(pageLimitWarning(23, limit, true)).toMatch(/^This export is about 23 pages, including the cover page/);
  });
});

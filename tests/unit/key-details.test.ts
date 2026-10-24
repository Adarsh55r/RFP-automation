import { describe, expect, it } from "vitest";
import { groupKeyDetails, keyDetailsForPrompt, locateQuote, parseKeyDetails } from "@/lib/key-details";
import { readDocumentText } from "@/lib/rfp-extract";
import { makeTextPdf } from "../helpers/documents";

const doc = [
  "--- Page 1 ---",
  "CITY OF FORT HOLLOW",
  "Request for Proposals 2026-14",
  "",
  "--- Page 2 ---",
  "Proposals shall not exceed 20 pages,",
  "excluding appendices. The contractor’s liability is capped at",
  "",
  "--- Page 3 ---",
  "two times the annual contract value. General liability insurance of $2,000,000 per occurrence is required.",
].join("\n");

describe("key details", () => {
  it("finds the page a quote is on, despite line breaks, curly quotes and page breaks", () => {
    expect(locateQuote(doc, "Proposals shall not exceed 20 pages, excluding appendices")).toEqual({ found: true, page: 2 });
    expect(locateQuote(doc, "The contractor's liability is capped at two times the annual contract value")).toEqual({ found: true, page: 2 });
    expect(locateQuote(doc, "insurance of $2,000,000 per occurrence")).toEqual({ found: true, page: 3 });
    expect(locateQuote(doc, "insurance of $5,000,000 per occurrence")).toEqual({ found: false, page: null });
    // A Word document has no pages: found, but no page number.
    expect(locateQuote("Bonds: a 5% bid bond is required.", "a 5% bid bond is required")).toEqual({ found: true, page: null });
  });

  it("checks every detail against the document and never trusts a page number from the model", () => {
    const details = parseKeyDetails(
      [
        { category: "length_limit", detail: "Max 20 pages excl. appendices", kind: "mandatory", quote: "shall not exceed 20 pages", page: 9 },
        { category: "insurance", detail: "GL insurance $5M", kind: "mandatory", quote: "insurance of $5,000,000 per occurrence" },
        { category: "made_up_category", detail: "Something", kind: "urgent", quote: "" },
        { category: "insurance", detail: "" },
        "not an object",
      ],
      doc,
    );
    expect(details).toEqual([
      { category: "length_limit", detail: "Max 20 pages excl. appendices", kind: "mandatory", quote: "shall not exceed 20 pages", page: 2, verified: true },
      { category: "insurance", detail: "GL insurance $5M", kind: "mandatory", quote: "insurance of $5,000,000 per occurrence", page: null, verified: false },
      { category: "other", detail: "Something", kind: "info", quote: null, page: null, verified: false },
    ]);
    expect(groupKeyDetails(details).map((group) => group.label)).toEqual(["Page or word limits", "Insurance", "Other"]);
    expect(keyDetailsForPrompt(details)).toContain("- Page or word limits (mandatory): Max 20 pages excl. appendices [page 2]");
  });

  it("PDF text keeps page markers, so details point to the right page of a real PDF", async () => {
    const pdf = await makeTextPdf(["Request for Proposals", "Section 5. Insurance\nA performance bond of 100% of the contract value is required."]);
    const { text, pageCount } = await readDocumentText(pdf, "rfp.pdf");
    expect(pageCount).toBe(2);
    expect(text).toMatch(/^--- Page 1 ---\nRequest for Proposals/);
    expect(locateQuote(text, "A performance bond of 100% of the contract value")).toEqual({ found: true, page: 2 });
  });
});

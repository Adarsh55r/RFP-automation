import { describe, expect, it } from "vitest";
import { extractTextFromDocument } from "@/lib/rfp-extract";
import { makeDocx, makePdf } from "../helpers/documents";
import { FIXTURES } from "../fixtures/rfps";

const base = FIXTURES[0].text;
const table = [
  ["Criterion", "Points"],
  ["Technical approach", "40"],
  ["Price", "25"],
];

describe("document text extraction keeps the facts evaluators score on", () => {
  it("DOCX: dates, money, numbered questions and table cells survive", async () => {
    const text = await extractTextFromDocument(await makeDocx(base, table), "rfp.docx");
    for (const fact of ["November 20, 2026 at 2:00 PM EST", "$2,000,000", "Q5. Describe your approach to cybersecurity monitoring.", "Technical approach", "40"]) {
      expect(text).toContain(fact);
    }
  });

  it("PDF: the same facts survive, including a two-column block and a table", async () => {
    const pdf = await makePdf(base, table, ["Left column: bonding is not required.", "Right column: insurance certificate due at award."]);
    // PDF text comes back line by line; a narrow column wraps "due at / award".
    const text = (await extractTextFromDocument(pdf, "rfp.pdf")).replace(/\s+/g, " ");
    for (const fact of ["November 20, 2026", "$2,000,000", "Q5.", "bonding is not required", "insurance certificate due at award", "Price"]) {
      expect(text).toContain(fact);
    }
  });

  it("known limitation: side-by-side columns are merged line by line", async () => {
    const pdf = await makePdf("x", undefined, ["Left column text.", "Right column text."]);
    const text = await extractTextFromDocument(pdf, "rfp.pdf");
    // Documented in AI_QUALITY_EVALUATION.md: reading order follows visual lines, not columns.
    expect(text).toContain("Left column text. Right column text.");
  });

  it("rejects unsupported file types instead of guessing", async () => {
    await expect(extractTextFromDocument(Buffer.from("a,b,c"), "rfp.csv")).rejects.toThrow(/PDF and DOCX/);
  });

  it("a corrupted PDF fails with an error rather than producing invented text", async () => {
    await expect(extractTextFromDocument(Buffer.from("%PDF-1.7 garbage that is not a pdf"), "broken.pdf")).rejects.toThrow();
  });
});

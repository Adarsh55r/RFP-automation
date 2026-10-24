import { afterEach, describe, expect, it, vi } from "vitest";
import { makePdf, makeScannedPdf } from "../helpers/documents";

const llm = vi.hoisted(() => ({ reply: "" }));
vi.mock("@/lib/llm", async (original) => ({
  ...(await original<typeof import("@/lib/llm")>()),
  generateTextFromPdf: async () => llm.reply,
}));

afterEach(() => {
  delete process.env.OCR_MAX_PAGES;
});

describe("OCR fallback", () => {
  it("treats an empty or near-empty text layer as a scan", async () => {
    const { textLayerIsThin } = await import("@/lib/ocr");
    expect(textLayerIsThin("", 3)).toBe(true);
    expect(textLayerIsThin("CONFIDENTIAL ".repeat(3), 10)).toBe(true);
    expect(textLayerIsThin("Requirement text. ".repeat(100), 3)).toBe(false);
  });

  it("uses the text layer when there is one and never calls the AI", async () => {
    const { readRfpDocument } = await import("@/lib/ocr");
    llm.reply = "should not be used";
    const pdf = await makePdf(Array.from({ length: 40 }, (_, i) => `4.${i} The contractor shall provide service ${i}.`).join("\n"));
    const result = await readRfpDocument(pdf, "rfp.pdf");
    expect(result.ok && result.ocrPages).toBe(0);
    expect(result.ok && result.text).toContain("4.3 The contractor shall provide service 3.");
  });

  it("labels pages even if the model leaves out the page markers", async () => {
    const { readRfpDocument } = await import("@/lib/ocr");
    llm.reply = "Section 1. Scope of services for the County. The contractor shall maintain all equipment.";
    const result = await readRfpDocument(await makeScannedPdf(2), "scan.pdf");
    expect(result.ok && result.text).toMatch(/^--- Pages 1–2 ---\nSection 1/);
  });

  it("reports a scan the model could not read as unreadable instead of extracting nothing", async () => {
    const { readRfpDocument } = await import("@/lib/ocr");
    llm.reply = "=== PAGE ===\n[blank page]";
    const result = await readRfpDocument(await makeScannedPdf(1), "scan.pdf");
    expect(result.ok).toBe(false);
  });

  it("reads PNG and JPEG scans as one-page PDFs through OCR", async () => {
    const { readRfpDocument } = await import("@/lib/ocr");
    const { looksLikeRfpFile } = await import("@/lib/rfp-upload");
    // 1×1 images: real PNG and JPEG files.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const jpg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    );
    expect(looksLikeRfpFile(new Uint8Array(png), "scan.png")).toBe(true);
    expect(looksLikeRfpFile(new Uint8Array(jpg), "scan.jpeg")).toBe(true);
    expect(looksLikeRfpFile(new Uint8Array(png), "scan.jpg")).toBe(false);

    llm.reply = "=== PAGE ===\nRequest for Quotation: grounds maintenance for 14 parks. Quotes due 5 December 2026.";
    const result = await readRfpDocument(png, "scan.png");
    expect(result.ok && result.text).toMatch(/^--- Page 1 ---\nRequest for Quotation/);
    expect(result.ok && result.flags[0]).toMatch(/^Scanned document: the text of the page was read from images/);

    process.env.OCR_MAX_PAGES = "0";
    expect((await readRfpDocument(png, "scan.png")).ok).toBe(false);
  });
});

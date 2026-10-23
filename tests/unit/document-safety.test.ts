import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { DocumentReadError, inspectDocx, MAX_DOCX_UNZIPPED_BYTES, MAX_PDF_PAGES } from "@/lib/document-safety";
import { extractTextFromDocument } from "@/lib/rfp-extract";
import { makeDocx } from "../helpers/documents";

async function pdf(definition: Record<string, unknown>) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pdfMakeModule: any = await import("pdfmake/build/pdfmake");
  const vfsModule: any = await import("pdfmake/build/vfs_fonts");
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = vfsModule.default ?? vfsModule;
  pdfMake.vfs = vfs.pdfMake?.vfs ?? vfs.vfs ?? vfs;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return new Promise<Buffer>((resolve) => pdfMake.createPdf(definition).getBuffer((b: Uint8Array) => resolve(Buffer.from(b))));
}

async function problemOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof DocumentReadError ? error.problem : `other: ${String(error)}`;
  }
}

describe("document safety checks", () => {
  it("reads a normal Word file and sees no macros", async () => {
    const docx = await makeDocx("Proposal due 20 November 2026.");
    const info = inspectDocx(new Uint8Array(docx));
    expect(info.hasMacros).toBe(false);
    expect(info.unzippedBytes).toBeGreaterThan(0);
    expect(await extractTextFromDocument(docx, "rfp.docx")).toContain("20 November 2026");
  });

  it("refuses a Word file that carries a macro project, without running anything", async () => {
    const zip = await JSZip.loadAsync(await makeDocx("Text"));
    zip.file("word/vbaProject.bin", "fake macro project");
    const withMacros = Buffer.from(await zip.generateAsync({ type: "uint8array" }));
    expect(await problemOf(extractTextFromDocument(withMacros, "rfp.docx"))).toBe("macros");
  });

  it("refuses a Word file that would unpack to an unsafe size (zip bomb)", async () => {
    const bytes = new Uint8Array(await makeDocx("Text"));
    // Inflate the declared size of the first central-directory entry past the limit.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let central = -1;
    for (let i = 0; i < bytes.length - 4; i += 1) if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
    view.setUint32(central + 24, MAX_DOCX_UNZIPPED_BYTES + 1, true);
    expect(await problemOf(extractTextFromDocument(Buffer.from(bytes), "rfp.docx"))).toBe("too_large");
  });

  it("explains a password-protected PDF instead of failing generically", async () => {
    const locked = await pdf({ content: ["Secret RFP"], userPassword: "s3cret", ownerPassword: "owner" });
    expect(await problemOf(extractTextFromDocument(locked, "rfp.pdf"))).toBe("encrypted");
  });

  it("refuses a PDF over the page limit", { timeout: 60_000 }, async () => {
    const pages = Array.from({ length: MAX_PDF_PAGES + 1 }, (_, i) => ({ text: `Page ${i + 1}`, pageBreak: i ? "before" : undefined }));
    expect(await problemOf(extractTextFromDocument(await pdf({ content: pages }), "rfp.pdf"))).toBe("too_many_pages");
  });

  it("calls a damaged file damaged", async () => {
    expect(await problemOf(extractTextFromDocument(Buffer.from("%PDF-1.7 not really a pdf"), "rfp.pdf"))).toBe("damaged");
    expect(await problemOf(extractTextFromDocument(Buffer.from("PK\u0003\u0004 not really a zip"), "rfp.docx"))).toBe("damaged");
  });
});

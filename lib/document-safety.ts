/**
 * Checks on uploaded documents before their text is read. Files are only ever
 * read as text: macros and embedded content are never run, and macro-enabled
 * Word files are refused outright.
 */

/** Pages read from one PDF. Larger files are refused with a clear message. */
export const MAX_PDF_PAGES = 600;
/** Total size of a Word file once unzipped; guards against zip bombs. */
export const MAX_DOCX_UNZIPPED_BYTES = 150 * 1024 * 1024;

export type DocumentProblem = "encrypted" | "damaged" | "too_many_pages" | "macros" | "too_large";

const MESSAGES: Record<DocumentProblem, string> = {
  encrypted:
    "This PDF is password-protected, so its text cannot be read. Remove the password (for example, print it to a new PDF) and upload it again.",
  damaged:
    "We could not read this file; it may be damaged or not a standard PDF, Word or Excel document. Try opening it and saving it again (as PDF, .docx or .xlsx), then upload the new copy.",
  too_many_pages: `This PDF is longer than ${MAX_PDF_PAGES} pages. Split it into the RFP and its attachments and upload the RFP itself.`,
  macros:
    "This file contains macros. For your safety we do not accept macro-enabled documents. Save it as a normal Word (.docx) or Excel (.xlsx) file and upload it again.",
  too_large:
    "This file is too large to read safely once unpacked. Save a copy without embedded files or large images and upload it again.",
};

/** A document that cannot be read, with a message written for the user. */
export class DocumentReadError extends Error {
  constructor(readonly problem: DocumentProblem) {
    super(MESSAGES[problem]);
    this.name = "DocumentReadError";
  }
}

/**
 * Reads a .docx (zip) central directory without unpacking it: the total
 * unpacked size, and whether it carries a VBA macro project.
 */
export function inspectDocx(bytes: Uint8Array): { unzippedBytes: number; hasMacros: boolean } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record sits in the last 64 KB + 22 bytes.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DocumentReadError("damaged");

  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  let unzippedBytes = 0;
  let hasMacros = false;
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new DocumentReadError("damaged");
    }
    unzippedBytes += view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).toLowerCase();
    if (name.endsWith("vbaproject.bin") || name.endsWith("vbadata.xml")) hasMacros = true;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return { unzippedBytes, hasMacros };
}

/** Throws a DocumentReadError if an Office file (Word or Excel, both zips) must not be read. */
export function assertSafeZipDocument(bytes: Uint8Array) {
  const { unzippedBytes, hasMacros } = inspectDocx(bytes);
  if (hasMacros) throw new DocumentReadError("macros");
  if (unzippedBytes > MAX_DOCX_UNZIPPED_BYTES) throw new DocumentReadError("too_large");
}

export const assertSafeDocx = assertSafeZipDocument;

/** An Office file's problem (macros, zip bomb, damage) as a message, or null if it is safe to read. */
export function officeFileProblem(bytes: Uint8Array, name: string) {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".docx") && !lower.endsWith(".xlsx")) return null;
  try {
    assertSafeZipDocument(bytes);
    return null;
  } catch (error) {
    return error instanceof DocumentReadError ? error.message : "This file is not a valid Word or Excel document.";
  }
}

export const RFP_ACCEPTED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export const RFP_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Vercel rejects function request bodies over 4.5 MB, so larger files go
 * straight from the browser to storage through a signed upload URL.
 */
export const SERVER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export function isAllowedRfpName(name: string, type?: string) {
  if (type && allowedMimeTypes.has(type)) return true;
  const lower = name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
}

/** Checks the file's first bytes, so a renamed executable or image cannot pose as an RFP. */
export function looksLikeRfpFile(bytes: Uint8Array, name: string) {
  // Plain byte-to-char mapping: this module is also bundled for the browser (no Buffer there).
  const head = String.fromCharCode(...bytes.subarray(0, 1024));
  if (name.toLowerCase().endsWith(".docx")) return head.startsWith("PK\u0003\u0004");
  // The PDF header may follow a few junk bytes, but must be in the first 1 KB.
  return head.includes("%PDF-");
}

const allowedMimeTypes = new Set<string>(
  Object.keys(RFP_ACCEPTED_MIME_TYPES),
);

export function isAllowedRfpFile(file: File) {
  return isAllowedRfpName(file.name, file.type);
}

export function sanitizeStorageFilename(filename: string) {
  const base = filename.split(/[/\\]/).pop() ?? "upload";
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return sanitized.slice(0, 200) || "upload";
}

export function titleFromFilename(filename: string) {
  const base = filename.replace(/\.[^/.]+$/, "").trim();
  return base || "Untitled RFP";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

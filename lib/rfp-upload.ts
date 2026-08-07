export const RFP_ACCEPTED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export const RFP_MAX_BYTES = 25 * 1024 * 1024;

const allowedMimeTypes = new Set<string>(
  Object.keys(RFP_ACCEPTED_MIME_TYPES),
);

export function isAllowedRfpFile(file: File) {
  if (allowedMimeTypes.has(file.type)) {
    return true;
  }

  const lower = file.name.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx");
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

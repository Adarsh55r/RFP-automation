import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { getAnthropicClient, EXTRACTION_MODEL } from "@/lib/anthropic";
import {
  getRfpStorageBucket,
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

// #region agent log
fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "91d1a9",
  },
  body: JSON.stringify({
    sessionId: "91d1a9",
    location: "lib/rfp-extract.ts:9",
    message: "rfp extract module evaluated",
    data: {
      hasWindow: typeof window !== "undefined",
      hasDOMMatrix: typeof DOMMatrix !== "undefined",
    },
    timestamp: Date.now(),
    hypothesisId: "H3",
    runId: "dashboard-ssr",
  }),
}).catch(() => {});
// #endregion

export type ExtractionResult = {
  scope: string;
  deadline: string | null;
  eligibilityCriteria: string[];
  evaluationCriteria: string[];
};

const EXTRACTION_SYSTEM = `You extract structured requirements from private-sector RFP / RFI / vendor empanelment documents for Indian IT services agencies.
Return ONLY valid JSON matching this schema (no markdown, no commentary):
{
  "scope": "string — concise summary of the project/work scope",
  "deadline": "YYYY-MM-DD or null if no submission/response deadline is stated",
  "eligibilityCriteria": ["string", "..."],
  "evaluationCriteria": ["string", "..."]
}
Rules:
- Prefer concrete requirements from the document over inventing content.
- If a field is missing, use "" for scope or [] for list fields, and null for deadline.
- Keep list items short and specific (one requirement per item).
- Dates must be ISO calendar dates when a clear deadline exists.`;

const MAX_TEXT_CHARS = 120_000;

export function storagePathFromPublicUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${getRfpStorageBucket()}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

export async function downloadRfpFile(fileUrl: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const storagePath = storagePathFromPublicUrl(fileUrl);
  if (storagePath) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(getRfpStorageBucket())
      .download(storagePath);

    if (error || !data) {
      throw new Error(error?.message ?? "Could not download the RFP file.");
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const fileName = storagePath.split("/").pop() ?? "document";
    return { buffer, fileName };
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error("Could not download the RFP file from storage.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const fileName =
    new URL(fileUrl).pathname.split("/").pop() ?? "document";
  return { buffer, fileName };
}

export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return (result.text ?? "").trim();
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }

  throw new Error("Only PDF and DOCX files are supported for extraction.");
}

function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

export function parseExtractionJson(raw: string): ExtractionResult {
  const parsed = JSON.parse(stripCodeFences(raw)) as Record<string, unknown>;

  const scope =
    typeof parsed.scope === "string"
      ? parsed.scope.trim()
      : parsed.scope != null
        ? JSON.stringify(parsed.scope)
        : "";

  const deadlineRaw =
    typeof parsed.deadline === "string" ? parsed.deadline.trim() : null;
  const deadline =
    deadlineRaw && /^\d{4}-\d{2}-\d{2}/.test(deadlineRaw)
      ? deadlineRaw.slice(0, 10)
      : null;

  return {
    scope,
    deadline,
    eligibilityCriteria: asStringArray(parsed.eligibilityCriteria),
    evaluationCriteria: asStringArray(parsed.evaluationCriteria),
  };
}

export async function extractRequirementsWithClaude(
  documentText: string,
): Promise<ExtractionResult> {
  const text =
    documentText.length > MAX_TEXT_CHARS
      ? `${documentText.slice(0, MAX_TEXT_CHARS)}\n\n[Document truncated for length.]`
      : documentText;

  if (!text.trim()) {
    throw new Error("No readable text was found in the document.");
  }

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract requirements from this RFP document as JSON:\n\n${text}`,
      },
    ],
  });

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned an empty extraction response.");
  }

  try {
    return parseExtractionJson(block.text);
  } catch {
    throw new Error("Claude returned invalid JSON for extraction.");
  }
}

export function deadlineToDate(deadline: string | null): Date | null {
  if (!deadline) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline);
  if (!match) {
    return null;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

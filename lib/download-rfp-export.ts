import type { ExportFormat, ExportVariant } from "@/lib/proposal-document";
import { EXPORTED_EVENT } from "@/lib/review-prompt";

/** Requests an export and saves it through a temporary download link. */
/** "sheet" returns a spreadsheet questionnaire as the buyer's own file, with answers filled in. */
export type DownloadFormat = ExportFormat | "sheet";

export async function downloadRfpExport(
  rfpId: string,
  format: DownloadFormat,
  options: { complianceMatrix?: boolean; variant?: ExportVariant } = {},
) {
  const matrix = options.complianceMatrix ? "&matrix=1" : "";
  const variant = options.variant === "review" ? "&variant=review" : "";
  const response = await fetch(`/api/rfps/${rfpId}/export?format=${format}${matrix}${variant}`, {
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? `Could not export ${format === "sheet" ? "the spreadsheet" : format.toUpperCase()}.`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] ?? (format === "sheet" ? "questionnaire-answered.xlsx" : `proposal.${format}`);
  const unanswered = response.headers.get("X-Unanswered-Rows");

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  if (options.variant !== "review") {
    window.dispatchEvent(new CustomEvent(EXPORTED_EVENT, { detail: { rfpId, format: format === "sheet" ? "docx" : format } }));
  }

  return { fileName, unanswered: unanswered === null ? null : Number(unanswered) };
}

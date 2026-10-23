import type { ExportFormat, ExportVariant } from "@/lib/proposal-document";
import { EXPORTED_EVENT } from "@/lib/review-prompt";

/** Requests an export and saves it through a temporary download link. */
export async function downloadRfpExport(
  rfpId: string,
  format: ExportFormat,
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
    throw new Error(payload?.error ?? `Could not export ${format.toUpperCase()}.`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match?.[1] ?? `proposal.${format}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  if (options.variant !== "review") {
    window.dispatchEvent(new CustomEvent(EXPORTED_EVENT, { detail: { rfpId, format } }));
  }

  return fileName;
}

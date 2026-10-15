import type { ExportFormat } from "@/lib/proposal-document";

/** Requests an export and saves it through a temporary download link. */
export async function downloadRfpExport(rfpId: string, format: ExportFormat) {
  const response = await fetch(`/api/rfps/${rfpId}/export?format=${format}`, {
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

  return fileName;
}

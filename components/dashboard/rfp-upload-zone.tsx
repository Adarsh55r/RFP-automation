"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import {
  formatFileSize,
  RFP_ACCEPTED_MIME_TYPES,
  RFP_MAX_BYTES,
  SERVER_UPLOAD_MAX_BYTES,
} from "@/lib/rfp-upload";

/** The plan's limit is reached and this upload costs extra: the user must confirm the price first. */
class OverageRequired extends Error {
  constructor(message: string, readonly priceUsd: number) {
    super(message);
  }
}

type ErrorPayload = { error?: string; overagePriceUsd?: number } | null;

function errorFrom(status: number, payload: ErrorPayload, fallback: string) {
  if (status === 402 && typeof payload?.overagePriceUsd === "number") {
    return new OverageRequired(payload.error ?? fallback, payload.overagePriceUsd);
  }
  return new Error(payload?.error ?? fallback);
}

async function readError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ErrorPayload;
  return errorFrom(response.status, payload, fallback);
}

/**
 * Files over 4 MB cannot pass through a Vercel function, so the browser uploads
 * them straight to storage with a one-time signed URL, then asks the server to
 * verify the file. If anything fails, the half-created RFP is removed.
 */
async function uploadDirect(
  file: File,
  onProgress: (value: number) => void,
  confirmOverageUsd: number | null,
): Promise<string> {
  const start = await fetch("/api/rfps/upload/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type, confirmOverageUsd }),
  });
  if (!start.ok) throw await readError(start, "Upload failed. Try again.");
  const { id, uploadUrl } = (await start.json()) as { id: string; uploadUrl: string };

  const abandon = () => fetch(`/api/rfps/${id}/upload`, { method: "DELETE" }).catch(() => undefined);
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
      });
      xhr.addEventListener("load", () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The file could not be stored. Try again.")),
      );
      xhr.addEventListener("error", () => reject(new Error("Upload failed. Check your connection and try again.")));
      xhr.send(file);
    });
    const complete = await fetch(`/api/rfps/${id}/upload`, { method: "POST" });
    if (!complete.ok) throw await readError(complete, "Upload failed. Try again.");
    onProgress(100);
    return id;
  } catch (error) {
    await abandon();
    throw error;
  }
}

function uploadWithProgress(
  file: File,
  onProgress: (value: number) => void,
  confirmOverageUsd: number | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/rfps/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { id: string };
          resolve(payload.id);
        } catch {
          reject(new Error("Upload succeeded but the response was invalid."));
        }
        return;
      }

      try {
        reject(errorFrom(xhr.status, JSON.parse(xhr.responseText) as ErrorPayload, "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed. Check your connection and try again."));
    });

    const formData = new FormData();
    formData.append("file", file);
    if (confirmOverageUsd !== null) formData.append("confirmOverageUsd", String(confirmOverageUsd));
    xhr.send(formData);
  });
}

export function RfpUploadZone() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [overage, setOverage] = useState<{ message: string; priceUsd: number } | null>(null);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setError(null);

    if (rejected.length > 0) {
      const rejection = rejected[0];
      const tooLarge = rejection.errors.some((item) => item.code === "file-too-large");
      const invalidType = rejection.errors.some(
        (item) => item.code === "file-invalid-type",
      );

      if (tooLarge) {
        setError("File is too large. Maximum size is 25 MB.");
      } else if (invalidType) {
        setError("Only PDF and DOCX files are supported.");
      } else {
        setError("Could not use that file. Try another PDF or DOCX.");
      }
      return;
    }

    if (accepted[0]) {
      setSelectedFile(accepted[0]);
      setProgress(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isFocused, open } = useDropzone({
    onDrop,
    accept: RFP_ACCEPTED_MIME_TYPES,
    maxFiles: 1,
    maxSize: RFP_MAX_BYTES,
    multiple: false,
    disabled: uploading,
    noClick: Boolean(selectedFile),
    noKeyboard: Boolean(selectedFile),
  });

  const clearFile = () => {
    setSelectedFile(null);
    setProgress(0);
    setError(null);
    setOverage(null);
  };

  const handleContinue = async (confirmOverageUsd: number | null = null) => {
    if (!selectedFile || uploading) {
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    setOverage(null);

    try {
      const rfpId =
        selectedFile.size > SERVER_UPLOAD_MAX_BYTES
          ? await uploadDirect(selectedFile, setProgress, confirmOverageUsd)
          : await uploadWithProgress(selectedFile, setProgress, confirmOverageUsd);
      router.push(`/dashboard/rfps/${rfpId}`);
    } catch (uploadError) {
      setUploading(false);
      setProgress(0);
      if (uploadError instanceof OverageRequired) {
        setOverage({ message: uploadError.message, priceUsd: uploadError.priceUsd });
        return;
      }
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed. Try again.",
      );
    }
  };

  const showDropzone = !selectedFile && !uploading;

  return (
    <div className="flex flex-col gap-6">
      {showDropzone ? (
        <div
          {...getRootProps()}
          className={cn(
            "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors duration-hover ease-out",
            isDragActive
              ? "border-brand bg-brand/10"
              : "border-border bg-surface-raised hover:border-brand/60",
            isFocused && focusRing,
          )}
        >
          <input {...getInputProps()} />
          <span
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-control transition-colors duration-hover ease-out",
              isDragActive ? "bg-brand/15 text-brand" : "bg-surface text-slate",
            )}
          >
            <Upload className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-6 font-sans text-base font-semibold text-ink">
            Drag your RFP here or click to browse
          </p>
          <p className="mt-2 text-sm text-slate">PDF or DOCX, up to 25 MB</p>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface-raised p-6">
          {uploading ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm font-semibold text-ink">
                    {selectedFile?.name}
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-wide text-slate">
                    Uploading… {progress}%
                  </p>
                </div>
              </div>
              <div
                className="h-2 overflow-hidden rounded-control bg-surface"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Upload progress"
              >
                <div
                  className="h-full rounded-control bg-brand transition-[width] duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm font-semibold text-ink">
                    {selectedFile?.name}
                  </p>
                  <p className="mt-1 font-mono text-xs tracking-wide text-slate">
                    {selectedFile ? formatFileSize(selectedFile.size) : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  className="gap-2"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Remove
                </Button>
                <Button type="button" onClick={() => open()}>
                  Replace
                </Button>
                <Button type="button" onClick={() => handleContinue()} className="w-full sm:w-auto">
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {overage ? (
        <div role="alert" className="flex flex-col gap-4 rounded-card border border-accent/40 bg-accent/10 px-4 py-4">
          <p className="text-sm leading-relaxed text-ink">{overage.message}</p>
          <p className="text-sm leading-relaxed text-slate">
            Nothing is charged unless you confirm. Or choose a bigger plan on the billing page.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => handleContinue(overage.priceUsd)}>
              Confirm ${overage.priceUsd} and upload
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOverage(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

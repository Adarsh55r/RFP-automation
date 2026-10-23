"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import { changeCount, REQUIREMENT_FIELD_LABELS, type ExtractionChanges } from "@/lib/requirement-diff";

export type AddendumFile = { id: string; fileName: string; createdAt: string; included: boolean };

/** Addenda for a bid, re-reading the requirements with them, and what that changed. */
export function AddendaCard({
  rfpId,
  files,
  changes,
  extracted,
}: {
  rfpId: string;
  files: AddendumFile[];
  changes: ExtractionChanges | null;
  /** Requirements have been extracted at least once. */
  extracted: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | "reread" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unread = files.filter((file) => !file.included).length;

  const call = async (kind: "upload" | "remove" | "reread", request: () => Promise<Response>) => {
    setBusy(kind);
    setError(null);
    try {
      const response = await request();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Something went wrong. Try again.");
      }
      router.refresh();
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const upload = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    void call("upload", () => fetch(`/api/rfps/${rfpId}/addenda`, { method: "POST", body: form }));
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-sans text-lg font-semibold text-ink">Addenda</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate">
            Add amendments or clarifications the buyer issued after the RFP (PDF or Word). They are
            read with the original, later ones taking priority, and you see what changed.
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2 sm:w-fit"
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        >
          {busy === "upload" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FilePlus2 className="size-4" aria-hidden />}
          Add addendum
        </Button>
      </div>

      {files.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {files.map((file, index) => (
            <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">
                  {index + 1}. {file.fileName}
                </span>
                <span className="font-mono text-xs text-slate">Added {file.createdAt.slice(0, 10)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant={file.included ? "success" : "accent"}>{file.included ? "Read" : "Not read yet"}</Badge>
                <button
                  type="button"
                  aria-label={`Remove ${file.fileName}`}
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Remove ${file.fileName}? Requirements change only when you re-read them.`)) return;
                    void call("remove", () => fetch(`/api/rfps/${rfpId}/addenda?fileId=${encodeURIComponent(file.id)}`, { method: "DELETE" }));
                  }}
                  className={cn("rounded-control p-1.5 text-slate hover:text-danger disabled:opacity-50", focusRing)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {unread > 0 && extracted ? (
        <div className="flex flex-col gap-3 rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <span>
            {unread} addend{unread === 1 ? "um has" : "a have"} not been read yet. Re-read the requirements to
            include {unread === 1 ? "it" : "them"} (uses one of this proposal&apos;s extractions).
          </span>
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={() => void call("reread", () => fetch(`/api/rfps/${rfpId}/extract`, { method: "POST" }))}
            className="w-full gap-2 sm:w-fit"
          >
            {busy === "reread" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
            {busy === "reread" ? "Re-reading…" : "Re-read requirements"}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {changes ? <ChangesSummary changes={changes} /> : null}
    </Card>
  );
}

function ChangesSummary({ changes }: { changes: ExtractionChanges }) {
  const label = (field: keyof typeof REQUIREMENT_FIELD_LABELS) => REQUIREMENT_FIELD_LABELS[field];
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4" aria-labelledby="addenda-changes">
      <h3 id="addenda-changes" className="font-sans text-base font-semibold text-ink">
        What the addenda changed
      </h3>
      <p className="text-xs text-slate">
        {changes.addenda.join(", ")}, read {changes.at.slice(0, 10)}. Compared by wording, so check the addenda
        themselves too.
      </p>
      {changeCount(changes) === 0 ? (
        <p className="text-sm text-slate">No changes to the extracted requirements were found.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {changes.deadline ? (
            <li>
              <Badge variant="danger">Deadline</Badge>{" "}
              {changes.deadline.from ?? "not stated"} → <strong>{changes.deadline.to ?? "not stated"}</strong>
            </li>
          ) : null}
          {changes.changed.map((item, index) => (
            <li key={`c${index}`}>
              <Badge variant="accent">Changed</Badge> <span className="text-slate">{label(item.field)}:</span>{" "}
              <s className="text-slate">{item.from}</s> → {item.to}
            </li>
          ))}
          {changes.added.map((item, index) => (
            <li key={`a${index}`}>
              <Badge variant="success">Added</Badge> <span className="text-slate">{label(item.field)}:</span> {item.text}
            </li>
          ))}
          {changes.removed.map((item, index) => (
            <li key={`r${index}`}>
              <Badge variant="free">Removed</Badge> <span className="text-slate">{label(item.field)}:</span>{" "}
              <s>{item.text}</s>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

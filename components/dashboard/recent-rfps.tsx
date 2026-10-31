import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RfpStatus } from "@/lib/generated/prisma";
import type { RfpListItem } from "@/lib/rfps";
import {
  isRfpDocumentType,
  rfpDocumentTypeLabel,
} from "@/lib/rfp-document-type";

const statusVariant: Record<
  RfpStatus,
  "draft" | "submitted" | "accent" | "success"
> = {
  uploaded: "draft",
  extracting: "submitted",
  extracted: "submitted",
  drafting: "accent",
  drafted: "accent",
  exported: "success",
};

const statusLabel: Record<RfpStatus, string> = {
  uploaded: "Uploaded",
  extracting: "Extracting",
  extracted: "Extracted",
  drafting: "Drafting",
  drafted: "Drafted",
  exported: "Exported",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function RecentRfps({
  rfps,
  title = "Recent RFPs",
}: {
  rfps: RfpListItem[];
  title?: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <span className="font-mono text-[11px] tracking-[0.14em] text-slate uppercase">{rfps.length} shown</span>
      </div>
      <ul className="divide-y divide-border">
        {rfps.map((rfp) => (
          <li key={rfp.id}>
            <Link
              href={`/dashboard/rfps/${rfp.id}`}
              className="group flex flex-col gap-2 px-6 py-4 transition-colors duration-200 ease-out hover:bg-surface-sunken/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  aria-hidden
                  className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-slate ring-1 ring-border transition-colors duration-200 group-hover:bg-brand/10 group-hover:text-brand group-hover:ring-brand/30 sm:flex"
                >
                  <FileText className="size-[18px]" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm font-semibold text-ink">{rfp.title}</p>
                  <p className="mt-1 font-mono text-xs tracking-wide text-slate">
                    {formatDate(rfp.createdAt)}
                    {isRfpDocumentType(rfp.extractedDocumentType)
                      ? ` · ${rfpDocumentTypeLabel[rfp.extractedDocumentType]}`
                      : ""}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-3">
                <Badge variant={statusVariant[rfp.status]} className="w-fit">
                  {statusLabel[rfp.status]}
                </Badge>
                <ChevronRight aria-hidden className="hidden size-4 text-slate transition-transform duration-200 group-hover:translate-x-1 group-hover:text-brand sm:block" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

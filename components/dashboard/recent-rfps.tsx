import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Rfp, RfpStatus } from "@/lib/generated/prisma";

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
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function RecentRfps({
  rfps,
  title = "Recent RFPs",
}: {
  rfps: Rfp[];
  title?: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-sans text-lg font-semibold text-ink">{title}</h2>
      </div>
      <ul className="divide-y divide-border">
        {rfps.map((rfp) => (
          <li key={rfp.id}>
            <Link
              href={`/dashboard/rfps/${rfp.id}`}
              className="flex flex-col gap-2 px-6 py-4 transition-colors duration-hover ease-out hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-semibold text-ink">
                  {rfp.title}
                </p>
                <p className="mt-1 font-mono text-xs tracking-wide text-slate">
                  {formatDate(rfp.createdAt)}
                </p>
              </div>
              <Badge variant={statusVariant[rfp.status]} className="w-fit">
                {statusLabel[rfp.status]}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

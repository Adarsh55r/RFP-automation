import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RfpExtractionPanel } from "@/components/dashboard/rfp-extraction-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireDashboardUser } from "@/lib/dashboard";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import { rfpStatusLabel, rfpStatusVariant } from "@/lib/rfp-status";
import { getRfpForUser } from "@/lib/rfps";

type RfpDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function generateMetadata({
  params,
}: RfpDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    return { title: "RFP" };
  }

  const rfp = await getRfpForUser(id, user.id);
  return {
    title: rfp?.title ?? "RFP",
    robots: { index: false, follow: false },
  };
}

export default async function RfpDetailPage({ params }: RfpDetailPageProps) {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/sign-in");
  }

  const rfp = await getRfpForUser(id, user.id);
  if (!rfp) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-6">
        <Link
          href="/dashboard/rfps"
          className={cn(
            textLink,
            "inline-flex w-fit items-center gap-2 text-sm text-slate hover:text-brand",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to RFPs
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              RFP detail
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
              {rfp.title}
            </h1>
            <p className="mt-2 font-mono text-xs tracking-wide text-slate">
              Added {formatDate(rfp.createdAt)}
            </p>
          </div>
          <Badge variant={rfpStatusVariant[rfp.status]} className="w-fit">
            {rfpStatusLabel[rfp.status]}
          </Badge>
        </div>
      </header>

      <Card className="flex flex-col gap-2">
        <p className="font-mono text-xs tracking-wide text-slate uppercase">
          Source file
        </p>
        <p className="font-sans text-sm font-semibold text-ink">{rfp.title}</p>
        {rfp.originalFileUrl ? (
          <a
            href={rfp.originalFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(textLink, "mt-2 inline-block w-fit text-sm")}
          >
            Open uploaded file
          </a>
        ) : (
          <p className="mt-2 text-sm text-slate">File URL not available.</p>
        )}
      </Card>

      <RfpExtractionPanel rfp={rfp} />
    </div>
  );
}

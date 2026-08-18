import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RfpDraftView } from "@/components/dashboard/rfp-draft-view";
import { Badge } from "@/components/ui/badge";
import { requireDashboardUser } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import { rfpStatusLabel, rfpStatusVariant } from "@/lib/rfp-status";
import { getRfpForUser } from "@/lib/rfps";

type DraftPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: DraftPageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    return { title: "Draft" };
  }

  const rfp = await getRfpForUser(id, user.id);
  return {
    title: rfp ? `Draft · ${rfp.title}` : "Draft",
    robots: { index: false, follow: false },
  };
}

export default async function RfpDraftPage({ params }: DraftPageProps) {
  const { id } = await params;
  const user = await requireDashboardUser();
  if (!user) {
    redirect("/onboarding");
  }

  const rfp = await getRfpForUser(id, user.id);
  if (!rfp) {
    notFound();
  }

  if (
    rfp.status !== "extracted" &&
    rfp.status !== "drafting" &&
    rfp.status !== "drafted" &&
    rfp.status !== "exported"
  ) {
    redirect(`/dashboard/rfps/${rfp.id}`);
  }

  const drafts = await prisma.draft.findMany({
    where: { rfpId: rfp.id },
    orderBy: { createdAt: "asc" },
  });

  const autoStart =
    drafts.length === 0 &&
    (rfp.status === "extracted" || rfp.status === "drafting");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-6">
        <Link
          href={`/dashboard/rfps/${rfp.id}`}
          className={cn(
            textLink,
            "inline-flex w-fit items-center gap-2 text-sm text-slate hover:text-brand",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to requirements
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              Drafting
            </p>
            <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
              Write the proposal
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
              Draft from your extracted fields and Content Library — case
              studies, bios, certifications, and company profile. The coverage
              map is for you only; export still writes the four proposal
              sections to Word.
            </p>
          </div>
          <Badge variant={rfpStatusVariant[rfp.status]} className="w-fit">
            {rfpStatusLabel[rfp.status]}
          </Badge>
        </div>
      </header>

      <RfpDraftView
        rfpId={rfp.id}
        rfpTitle={rfp.title}
        initialDrafts={drafts}
        initialCoverageMap={rfp.coverageMap}
        autoStart={autoStart}
      />
    </div>
  );
}

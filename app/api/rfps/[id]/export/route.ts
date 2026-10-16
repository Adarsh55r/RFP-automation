import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  buildProposalDocument,
  draftsReadyForExport,
  isExportFormat,
  proposalExportFileName,
} from "@/lib/proposal-document";
import { buildProposalDocxBuffer } from "@/lib/rfp-export";
import { buildProposalPdfBuffer } from "@/lib/rfp-export-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const contentTypes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const requested = params.get("format") ?? "docx";
  const includeComplianceMatrix = params.get("matrix") === "1";
  if (!isExportFormat(requested)) {
    return NextResponse.json({ error: "Format must be docx or pdf." }, { status: 400 });
  }
  const format = requested;

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Complete onboarding before exporting." },
      { status: 403 },
    );
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id, userId: user.id },
    include: { drafts: true },
  });

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found." }, { status: 404 });
  }

  if (
    rfp.status !== RfpStatus.drafting &&
    rfp.status !== RfpStatus.drafted &&
    rfp.status !== RfpStatus.exported
  ) {
    return NextResponse.json(
      { error: "Generate a draft before exporting." },
      { status: 400 },
    );
  }

  if (!draftsReadyForExport(rfp, rfp.drafts)) {
    return NextResponse.json(
      { error: "There is no drafted content to export yet. Finish drafting first." },
      { status: 400 },
    );
  }

  try {
    const doc = buildProposalDocument({
      companyName: user.agencyName?.trim() || "Your company",
      rfp,
      drafts: rfp.drafts,
      includeComplianceMatrix,
    });
    const bytes =
      format === "pdf"
        ? await buildProposalPdfBuffer(doc)
        : Buffer.from(await buildProposalDocxBuffer(doc));

    await prisma.rfp.update({
      where: { id: rfp.id },
      data: { status: RfpStatus.exported },
    });

    const fileName = proposalExportFileName(doc.cover.projectTitle, format);

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypes[format],
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(`RFP ${format.toUpperCase()} export failed:`, error);
    return NextResponse.json(
      { error: "Export failed. Try again in a moment." },
      { status: 500 },
    );
  }
}

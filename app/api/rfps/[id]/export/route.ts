import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  buildProposalDocxBuffer,
  draftsReadyForExport,
  proposalExportFileName,
} from "@/lib/rfp-export";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

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
      { error: "Generate a draft before exporting to DOCX." },
      { status: 400 },
    );
  }

  if (!draftsReadyForExport(rfp.drafts)) {
    return NextResponse.json(
      {
        error:
          "All four sections need content before export. Finish drafting first.",
      },
      { status: 400 },
    );
  }

  try {
    const buffer = await buildProposalDocxBuffer({
      agencyName: user.agencyName?.trim() || "Your agency",
      rfpTitle: rfp.title,
      drafts: rfp.drafts,
    });

    await prisma.rfp.update({
      where: { id: rfp.id },
      data: { status: RfpStatus.exported },
    });

    const fileName = proposalExportFileName(rfp.title);
    const bytes = Buffer.from(buffer);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("RFP DOCX export failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Export failed. Try again in a moment.",
      },
      { status: 500 },
    );
  }
}

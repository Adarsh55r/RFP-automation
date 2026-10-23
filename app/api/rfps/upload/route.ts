import { safeErrorSummary } from "@/lib/safe-log";
import { officeFileProblem } from "@/lib/document-safety";
import { reportError } from "@/lib/monitoring";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  isAllowedRfpFile,
  contentTypeFor,
  looksLikeRfpFile,
  RFP_MAX_BYTES,
  SERVER_UPLOAD_MAX_BYTES,
  sanitizeStorageFilename,
  titleFromFilename,
} from "@/lib/rfp-upload";
import { decideUpload, getProposalAllowance } from "@/lib/entitlements";
import { completeRfpUpload, uploadRateLimited } from "@/lib/rfps";
import {
  getRfpPublicUrl,
  getRfpStorageBucket,
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";


export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Complete onboarding before uploading RFPs." },
      { status: 403 },
    );
  }

  const rateLimited = await uploadRateLimited(user.id);
  if (rateLimited) {
    return NextResponse.json({ error: rateLimited }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF, Word, Excel or CSV file." }, { status: 400 });
  }

  if (!isAllowedRfpFile(file)) {
    return NextResponse.json(
      { error: "Only PDF, Word (.docx), Excel (.xlsx) and CSV files are supported." },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }

  if (file.size > RFP_MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 25 MB." },
      { status: 400 },
    );
  }

  if (file.size > SERVER_UPLOAD_MAX_BYTES) {
    // The browser uses the direct-to-storage flow (/api/rfps/upload/start) for these.
    return NextResponse.json(
      { error: "This file is too large to send through the server. Upload it again; large files go directly to storage." },
      { status: 413 },
    );
  }

  const confirmed = Number(formData.get("confirmOverageUsd"));
  const decision = decideUpload(
    await getProposalAllowance(user.id, user.subscription),
    Number.isFinite(confirmed) && confirmed > 0 ? confirmed : null,
  );
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, overagePriceUsd: decision.overagePriceUsd },
      { status: decision.status },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeRfpFile(bytes, file.name)) {
    return NextResponse.json(
      { error: "This file is not a valid PDF, Word (.docx), Excel (.xlsx) or CSV file." },
      { status: 400 },
    );
  }
  const unsafe = officeFileProblem(bytes, file.name);
  if (unsafe) {
    return NextResponse.json({ error: unsafe }, { status: 400 });
  }

  const title = titleFromFilename(file.name);
  const safeName = sanitizeStorageFilename(file.name);

  const rfp = await prisma.rfp.create({
    data: {
      userId: user.id,
      title,
      status: RfpStatus.uploaded,
      overageCents: decision.overageCents,
    },
  });

  const storagePath = `${user.id}/${rfp.id}/${safeName}`;

  try {
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(bytes);
    const contentType = file.type || contentTypeFor(safeName);

    const { error: uploadError } = await supabase.storage
      .from(getRfpStorageBucket())
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const originalFileUrl = getRfpPublicUrl(storagePath);

    await completeRfpUpload(rfp.id, user.id, originalFileUrl, decision.overageCents);

    return NextResponse.json({ id: rfp.id });
  } catch (error) {
    await prisma.rfp.delete({ where: { id: rfp.id } }).catch(() => undefined);

    const message =
      error instanceof Error && error.message.includes("Supabase is not configured")
        ? "File storage is not configured yet."
        : "Upload failed. Try again in a moment.";

    console.error("RFP upload failed:", safeErrorSummary(error));
    reportError(error, { area: "upload", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

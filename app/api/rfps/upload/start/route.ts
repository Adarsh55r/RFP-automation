import { safeErrorSummary } from "@/lib/safe-log";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/monitoring";
import { isAllowedRfpName, RFP_MAX_BYTES, sanitizeStorageFilename, titleFromFilename } from "@/lib/rfp-upload";
import { releaseReservation, reserveProposal } from "@/lib/rfps";
import { getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Step 1 of a large upload: checks the user may upload this file, creates the
 * RFP record, and returns a one-time signed URL the browser uploads to
 * directly (bypassing the 4.5 MB function request limit). Step 2 is
 * POST /api/rfps/[id]/upload once the file has arrived.
 */
export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { clerkId }, include: { subscription: true } });
  if (!user) {
    return NextResponse.json({ error: "Complete onboarding before uploading RFPs." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: unknown;
    size?: unknown;
    contentType?: unknown;
  } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  if (!fileName || !isAllowedRfpName(fileName, contentType)) {
    return NextResponse.json({ error: "Only PDF, Word (.docx), Excel (.xlsx), CSV and image (PNG, JPEG) files are supported." }, { status: 400 });
  }
  if (size <= 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (size > RFP_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 25 MB." }, { status: 400 });
  }

  // The proposal is booked now, not when the file arrives, so several uploads
  // started before any finishes cannot all use the same free slot.
  const reservation = await reserveProposal({
    userId: user.id,
    subscription: user.subscription,
    title: titleFromFilename(fileName),
  });
  if (!reservation.ok) {
    return NextResponse.json(
      { error: reservation.error, overagePriceUsd: reservation.overagePriceUsd },
      { status: reservation.status },
    );
  }
  const rfp = { id: reservation.rfpId };
  const path = `${user.id}/${rfp.id}/${sanitizeStorageFilename(fileName)}`;

  try {
    const { data, error } = await getSupabaseAdmin().storage.from(getRfpStorageBucket()).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No signed upload URL returned.");
    return NextResponse.json({ id: rfp.id, uploadUrl: data.signedUrl, path });
  } catch (error) {
    await releaseReservation(rfp.id, user.id).catch(() => undefined);
    console.error("Could not start a direct upload:", safeErrorSummary(error));
    reportError(error, { area: "upload-start", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: "Upload failed. Try again in a moment." }, { status: 500 });
  }
}

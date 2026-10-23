import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import { reportError } from "@/lib/monitoring";
import { isAllowedRfpName, RFP_MAX_BYTES, sanitizeStorageFilename, titleFromFilename } from "@/lib/rfp-upload";
import { getRfpUploadQuota, uploadRateLimited } from "@/lib/rfps";
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

  const body = (await request.json().catch(() => null)) as { fileName?: unknown; size?: unknown; contentType?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  const contentType = typeof body?.contentType === "string" ? body.contentType : "";
  if (!fileName || !isAllowedRfpName(fileName, contentType)) {
    return NextResponse.json({ error: "Only PDF and DOCX files are supported." }, { status: 400 });
  }
  if (size <= 0) {
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }
  if (size > RFP_MAX_BYTES) {
    return NextResponse.json({ error: "File is too large. Maximum size is 25 MB." }, { status: 400 });
  }

  const quota = await getRfpUploadQuota(user.id, user.subscription?.tier ?? "free");
  if (quota.remaining === 0) {
    return NextResponse.json(
      { error: "You have reached your monthly RFP limit. Upgrade your plan to upload more." },
      { status: 403 },
    );
  }

  const rateLimited = await uploadRateLimited(user.id);
  if (rateLimited) {
    return NextResponse.json({ error: rateLimited }, { status: 429 });
  }

  const rfp = await prisma.rfp.create({
    data: { userId: user.id, title: titleFromFilename(fileName), status: RfpStatus.uploaded },
  });
  const path = `${user.id}/${rfp.id}/${sanitizeStorageFilename(fileName)}`;

  try {
    const { data, error } = await getSupabaseAdmin().storage.from(getRfpStorageBucket()).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No signed upload URL returned.");
    return NextResponse.json({ id: rfp.id, uploadUrl: data.signedUrl, path });
  } catch (error) {
    await prisma.rfp.delete({ where: { id: rfp.id } }).catch(() => undefined);
    console.error("Could not start a direct upload:", error);
    reportError(error, { area: "upload-start", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: "Upload failed. Try again in a moment." }, { status: 500 });
  }
}

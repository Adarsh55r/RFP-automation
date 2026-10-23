import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { completeRfpUpload } from "@/lib/rfps";
import { assertSafeDocx, DocumentReadError } from "@/lib/document-safety";
import { reportError } from "@/lib/monitoring";
import { looksLikeRfpFile, RFP_MAX_BYTES } from "@/lib/rfp-upload";
import { getRfpPublicUrl, getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** A pending direct upload owned by the signed-in user, or null. */
async function pendingUpload(context: RouteContext) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return { status: 401 as const };
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return { status: 403 as const };
  const rfp = await prisma.rfp.findFirst({ where: { id, userId: user.id } });
  if (!rfp) return { status: 404 as const };
  return { status: 200 as const, user, rfp, folder: `${user.id}/${rfp.id}` };
}

/** Step 2 of a large upload: confirms the file arrived and is a real PDF/DOCX. */
/** A Word file's problem (macros, zip bomb, damage) as a message, or null if it is safe to read. */
function docxProblem(bytes: Uint8Array, name: string) {
  if (!name.toLowerCase().endsWith(".docx")) return null;
  try {
    assertSafeDocx(bytes);
    return null;
  } catch (error) {
    return error instanceof DocumentReadError ? error.message : "This file is not a valid Word (.docx) document.";
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const found = await pendingUpload(context);
  if (found.status !== 200) {
    return NextResponse.json({ error: "RFP not found." }, { status: found.status });
  }
  const { user, rfp, folder } = found;
  if (rfp.originalFileUrl) {
    return NextResponse.json({ id: rfp.id });
  }

  const bucket = getSupabaseAdmin().storage.from(getRfpStorageBucket());
  try {
    const { data: listed } = await bucket.list(folder);
    const object = listed?.[0];
    if (!object) {
      return NextResponse.json({ error: "The file has not finished uploading. Try again." }, { status: 400 });
    }
    const path = `${folder}/${object.name}`;
    const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
    const { data: blob } = await bucket.download(path);
    const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
    const invalid =
      size > RFP_MAX_BYTES || bytes.length > RFP_MAX_BYTES || !looksLikeRfpFile(bytes, object.name)
        ? "This file is not a valid PDF or Word (.docx) document under 25 MB."
        : docxProblem(bytes, object.name);
    if (invalid) {
      await bucket.remove([path]);
      await prisma.rfp.delete({ where: { id: rfp.id } });
      return NextResponse.json({ error: invalid }, { status: 400 });
    }
    await completeRfpUpload(rfp.id, user.id, getRfpPublicUrl(path));
    return NextResponse.json({ id: rfp.id });
  } catch (error) {
    console.error("Could not complete a direct upload:", error);
    reportError(error, { area: "upload-complete", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: "Upload failed. Try again in a moment." }, { status: 500 });
  }
}

/** Abandons a direct upload that never completed. */
export async function DELETE(_request: Request, context: RouteContext) {
  const found = await pendingUpload(context);
  if (found.status !== 200) {
    return NextResponse.json({ error: "RFP not found." }, { status: found.status });
  }
  const { rfp, folder } = found;
  if (rfp.originalFileUrl) {
    return NextResponse.json({ error: "This upload already finished." }, { status: 409 });
  }
  const bucket = getSupabaseAdmin().storage.from(getRfpStorageBucket());
  const { data: listed } = await bucket.list(folder);
  if (listed?.length) await bucket.remove(listed.map((item) => `${folder}/${item.name}`));
  await prisma.rfp.delete({ where: { id: rfp.id } });
  return NextResponse.json({ ok: true });
}

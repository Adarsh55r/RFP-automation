import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { officeFileProblem } from "@/lib/document-safety";
import { reportError } from "@/lib/monitoring";
import { storagePathFromPublicUrl } from "@/lib/rfp-extract";
import {
  contentTypeFor,
  looksLikeRfpFile,
  sanitizeStorageFilename,
  SERVER_UPLOAD_MAX_BYTES,
} from "@/lib/rfp-upload";
import { safeErrorSummary } from "@/lib/safe-log";
import { getRfpPublicUrl, getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Addenda per bid; more than this usually means the wrong files are being added. */
const MAX_ADDENDA = 10;

type RouteContext = { params: Promise<{ id: string }> };

async function ownedRfp(context: RouteContext) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false as const, response: NextResponse.json({ error: "You must be signed in." }, { status: 401 }) };
  const { id } = await context.params;
  const user = await prisma.user.findUnique({ where: { clerkId } });
  const rfp = user ? await prisma.rfp.findFirst({ where: { id, userId: user.id }, include: { files: true } }) : null;
  if (!user || !rfp) return { ok: false as const, response: NextResponse.json({ error: "RFP not found." }, { status: 404 }) };
  return { ok: true as const, user, rfp };
}

/**
 * Adds an addendum (PDF or Word) to a bid. It is stored next to the original
 * and read with it the next time requirements are extracted. It is part of
 * the same proposal, so it does not use up a proposal from the plan.
 */
export async function POST(request: Request, context: RouteContext) {
  const found = await ownedRfp(context);
  if (!found.ok) return found.response;
  const { user, rfp } = found;

  if (!rfp.originalFileUrl) {
    return NextResponse.json({ error: "Upload the RFP itself before adding addenda." }, { status: 400 });
  }
  if (rfp.files.length >= MAX_ADDENDA) {
    return NextResponse.json({ error: `A bid can have up to ${MAX_ADDENDA} addenda.` }, { status: 400 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a PDF or Word file." }, { status: 400 });
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    return NextResponse.json({ error: "Addenda must be PDF or Word (.docx) files." }, { status: 400 });
  }
  if (file.size > SERVER_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      { error: "Addenda can be up to 4 MB. If yours is larger, save it as a smaller PDF or include it in the main RFP file." },
      { status: 413 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeRfpFile(bytes, file.name)) {
    return NextResponse.json({ error: "This file is not a valid PDF or Word (.docx) document." }, { status: 400 });
  }
  const unsafe = officeFileProblem(bytes, file.name);
  if (unsafe) return NextResponse.json({ error: unsafe }, { status: 400 });

  // Stored flat in the RFP's folder, so deleting the RFP or workspace removes it too.
  const safeName = sanitizeStorageFilename(file.name);
  const storagePath = `${user.id}/${rfp.id}/addendum-${Date.now()}-${safeName}`;
  try {
    const { error } = await getSupabaseAdmin()
      .storage.from(getRfpStorageBucket())
      .upload(storagePath, Buffer.from(bytes), { contentType: file.type || contentTypeFor(safeName), upsert: false });
    if (error) throw error;
    const created = await prisma.rfpFile.create({
      data: { rfpId: rfp.id, fileName: file.name.slice(0, 200), fileUrl: getRfpPublicUrl(storagePath) },
    });
    return NextResponse.json({ id: created.id });
  } catch (error) {
    console.error("Addendum upload failed:", safeErrorSummary(error));
    reportError(error, { area: "upload", userId: user.id, rfpId: rfp.id });
    return NextResponse.json({ error: "Upload failed. Try again in a moment." }, { status: 500 });
  }
}

/** Removes an addendum (?fileId=…). Requirements change only when they are next re-read. */
export async function DELETE(request: Request, context: RouteContext) {
  const found = await ownedRfp(context);
  if (!found.ok) return found.response;
  const fileId = new URL(request.url).searchParams.get("fileId");
  const file = found.rfp.files.find((item) => item.id === fileId);
  if (!file) return NextResponse.json({ error: "Addendum not found." }, { status: 404 });

  const path = storagePathFromPublicUrl(file.fileUrl);
  if (path) {
    const { error } = await getSupabaseAdmin().storage.from(getRfpStorageBucket()).remove([path]);
    if (error) {
      console.error("Removing addendum file failed:", safeErrorSummary(error));
      return NextResponse.json({ error: "Could not remove the file. Try again in a moment." }, { status: 500 });
    }
  }
  await prisma.rfpFile.delete({ where: { id: file.id } });
  return NextResponse.json({ ok: true });
}

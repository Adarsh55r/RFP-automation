import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  isAllowedRfpFile,
  RFP_MAX_BYTES,
  sanitizeStorageFilename,
  titleFromFilename,
} from "@/lib/rfp-upload";
import { getRfpUploadQuota } from "@/lib/rfps";
import {
  getRfpPublicUrl,
  getRfpStorageBucket,
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "app/api/rfps/upload/route.ts:21",
      message: "upload route entered",
      data: {},
      timestamp: Date.now(),
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion

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

  const tier = user.subscription?.tier ?? "free";
  const quota = await getRfpUploadQuota(user.id, tier);

  if (quota.remaining === 0) {
    return NextResponse.json(
      {
        error:
          "You have reached your monthly RFP limit. Upgrade your plan to upload more.",
      },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF or DOCX file." }, { status: 400 });
  }

  if (!isAllowedRfpFile(file)) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are supported." },
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

  const title = titleFromFilename(file.name);
  const safeName = sanitizeStorageFilename(file.name);

  const rfp = await prisma.rfp.create({
    data: {
      userId: user.id,
      title,
      status: RfpStatus.uploaded,
    },
  });

  const storagePath = `${user.id}/${rfp.id}/${safeName}`;

  try {
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType =
      file.type ||
      (safeName.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

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

    await prisma.rfp.update({
      where: { id: rfp.id },
      data: { originalFileUrl },
    });

    return NextResponse.json({ id: rfp.id });
  } catch (error) {
    await prisma.rfp.delete({ where: { id: rfp.id } }).catch(() => undefined);

    // #region agent log
    fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "91d1a9",
      },
      body: JSON.stringify({
        sessionId: "91d1a9",
        location: "app/api/rfps/upload/route.ts:140",
        message: "upload failed",
        data: {
          errorName: error instanceof Error ? error.name : "unknown",
          errorMessage: error instanceof Error ? error.message : String(error),
          supabaseConfigured: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
              process.env.SUPABASE_SERVICE_ROLE_KEY,
          ),
        },
        timestamp: Date.now(),
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion

    const message =
      error instanceof Error && error.message.includes("Supabase is not configured")
        ? "File storage is not configured yet."
        : "Upload failed. Try again in a moment.";

    console.error("RFP upload failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storagePathFromPublicUrl } from "@/lib/rfp-extract";
import { getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Opens the uploaded RFP for its owner through a 60-second signed link, so the
 * page never exposes a permanent URL to the file.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { clerkId } });
  const rfp = user ? await prisma.rfp.findFirst({ where: { id, userId: user.id } }) : null;
  const path = rfp?.originalFileUrl ? storagePathFromPublicUrl(rfp.originalFileUrl) : null;
  if (!rfp || !path) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const { data, error } = await getSupabaseAdmin().storage.from(getRfpStorageBucket()).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl, 302);
}

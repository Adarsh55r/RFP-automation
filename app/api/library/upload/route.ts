import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DocumentReadError, officeFileProblem } from "@/lib/document-safety";
import { isLibraryItemType, libraryTypeSingular } from "@/lib/library";
import { addLibraryItems, splitForLibrary } from "@/lib/library-store";
import { readDocumentText } from "@/lib/rfp-extract";
import { looksLikeRfpFile, SERVER_UPLOAD_MAX_BYTES, titleFromFilename } from "@/lib/rfp-upload";
import { safeErrorSummary } from "@/lib/safe-log";

export const runtime = "nodejs";

/**
 * Adds a past proposal, résumé, case study or certificate to the library from
 * a PDF or Word file. Only its text is kept; the file itself is not stored.
 * Long documents are split into parts. Hidden text is removed, as for RFPs.
 */
export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: { select: { tier: true, planVersion: true } } },
  });
  if (!user) return NextResponse.json({ error: "Complete onboarding first." }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  if (!isLibraryItemType(type)) return NextResponse.json({ error: "Choose what kind of content this is." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a PDF or Word file." }, { status: 400 });
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    return NextResponse.json({ error: "Library documents must be PDF or Word (.docx) files." }, { status: 400 });
  }
  if (file.size > SERVER_UPLOAD_MAX_BYTES) {
    return NextResponse.json({ error: "Library documents can be up to 4 MB. Save a smaller copy or paste the text instead." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeRfpFile(bytes, file.name)) {
    return NextResponse.json({ error: "This file is not a valid PDF or Word (.docx) document." }, { status: 400 });
  }
  const unsafe = officeFileProblem(bytes, file.name);
  if (unsafe) return NextResponse.json({ error: unsafe }, { status: 400 });

  try {
    const { text, hidden } = await readDocumentText(Buffer.from(bytes), file.name);
    const clean = text.replace(/^--- Pages? [\d–]+ ---$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
    if (clean.length < 50) {
      return NextResponse.json(
        { error: "No readable text was found. If it is a scan, paste the text into a new library item instead." },
        { status: 422 },
      );
    }
    const title = titleFromFilename(file.name).slice(0, 180);
    const parts = splitForLibrary(clean);
    const result = await addLibraryItems(
      user,
      parts.map((content, index) => ({
        type,
        title: parts.length > 1 ? `${title} (part ${index + 1} of ${parts.length})` : title,
        content,
      })),
    );
    if (result.created.length === 0) {
      return NextResponse.json(
        {
          error: result.keptExistingProfile
            ? "You already have a company profile. Edit it, or add this document as another type."
            : `This ${libraryTypeSingular[type].toLowerCase()} does not fit within your library's limits. Remove items you no longer use first.`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ created: result.created, skippedForLimits: result.skippedForLimits, hiddenRemoved: hidden.length });
  } catch (error) {
    if (error instanceof DocumentReadError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Library upload failed:", safeErrorSummary(error));
    return NextResponse.json({ error: "Could not read this file. Try again in a moment." }, { status: 500 });
  }
}

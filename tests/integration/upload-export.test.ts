import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractText } from "unpdf";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx } from "../helpers/documents";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const MB = 1024 * 1024;
const SOFFICE = ["/usr/bin/soffice", "/usr/bin/libreoffice"].find((path) => existsSync(path));

function uploadRequest(name: string, body: Buffer, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(body)], name, { type }));
  return new Request("http://t/api/rfps/upload", { method: "POST", body: form });
}

const json = (body: unknown) =>
  new Request("http://t/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe.skipIf(!hasTestDb)("uploading an RFP", () => {
  beforeEach(async () => {
    await resetDb();
    (await import("../helpers/fake-supabase")).files.clear();
    await createUser("up", "starter");
    h.clerkId = "up";
  });

  it("accepts a small DOCX through the server and stores it privately", async () => {
    const { POST } = await import("@/app/api/rfps/upload/route");
    const res = await POST(uploadRequest("City RFP.docx", await makeDocx("Scope"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id } });
    expect(rfp.originalFileUrl).toContain(`/${id}/City_RFP.docx`);
  });

  it("rejects a file whose content does not match its .pdf name", async () => {
    const { POST } = await import("@/app/api/rfps/upload/route");
    const res = await POST(uploadRequest("invoice.pdf", Buffer.from("MZ\x90\x00 this is an exe"), "application/pdf"));
    expect(res.status).toBe(400);
    expect(await testDb().rfp.count()).toBe(0);
  });

  it("explains how to proceed when a file is too big for the server route (Vercel's 4.5 MB request cap)", async () => {
    const { POST } = await import("@/app/api/rfps/upload/route");
    const big = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5 * MB)]);
    const res = await POST(uploadRequest("big.pdf", big, "application/pdf"));
    expect(res.status).toBe(413);
  });

  it("large files: start → direct upload to storage → complete", async () => {
    const start = await import("@/app/api/rfps/upload/start/route");
    const complete = await import("@/app/api/rfps/[id]/upload/route");
    const fake = await import("../helpers/fake-supabase");

    expect((await start.POST(json({ fileName: "huge.pdf", size: 30 * MB, contentType: "application/pdf" }))).status).toBe(400);
    expect((await start.POST(json({ fileName: "tool.exe", size: 5 * MB, contentType: "application/octet-stream" }))).status).toBe(400);

    const res = await start.POST(json({ fileName: "Tender Pack.pdf", size: 12 * MB, contentType: "application/pdf" }));
    expect(res.status).toBe(200);
    const { id, uploadUrl, path } = await res.json();
    expect(uploadUrl).toContain("/object/upload/sign/");

    // Not uploaded yet → cannot complete.
    expect((await complete.POST(json({}), ctx(id))).status).toBe(400);

    fake.files.set(path, Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(12 * MB)]));
    h.clerkId = "intruder";
    await createUser("intruder");
    expect((await complete.POST(json({}), ctx(id))).status).toBe(404);
    h.clerkId = "up";
    expect((await complete.POST(json({}), ctx(id))).status).toBe(200);
    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id } });
    expect(rfp.originalFileUrl).toContain(path);
  });

  it("an abandoned direct upload does not use up the monthly quota", async () => {
    const start = await import("@/app/api/rfps/upload/start/route");
    const { getProposalAllowance } = await import("@/lib/entitlements");
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "up" } });
    await start.POST(json({ fileName: "a.pdf", size: 6 * MB, contentType: "application/pdf" }));
    expect((await getProposalAllowance(user.id, { tier: "starter", planVersion: "legacy" })).used).toBe(0);
  });
});

describe.skipIf(!hasTestDb)("exporting a proposal", () => {
  let rfpId = "";
  beforeEach(async () => {
    await resetDb();
    const user = await createUser("ex", "starter");
    const rfp = await testDb().rfp.create({
      data: {
        userId: user.id,
        title: "Fort Hollow Managed IT",
        status: "drafted",
        extractedScope: "Managed IT",
        drafts: {
          create: [
            { sectionName: "exec_summary", content: "## Our understanding\nThe City of Fort Hollow needs 24/7 support. <script>alert(1)</script>\n\n| Item | Detail |\n| --- | --- |\n| Users | 85 |" },
            { sectionName: "technical_approach", content: "We will start in [[Confirm: start date]]." },
          ],
        },
      },
    });
    rfpId = rfp.id;
    h.clerkId = "ex";
  });

  it("Word export is a real .docx containing the text, table and placeholder", async () => {
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    const res = await POST(new Request("http://t/x?format=docx", { method: "POST" }), ctx(rfpId));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const mammoth = await import("mammoth");
    const text = (await mammoth.extractRawText({ buffer: buf })).value;
    expect(text).toContain("The City of Fort Hollow needs 24/7 support.");
    expect(text).toContain("<script>alert(1)</script>"); // literal text, not markup
    expect(text).toContain("85");
    expect(text).toContain("[Confirm: start date]"); // rendered as a highlighted single-bracket placeholder
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).status).toBe("exported");
  });

  it("PDF export is a real PDF containing the text", async () => {
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    const res = await POST(new Request("http://t/x?format=pdf", { method: "POST" }), ctx(rfpId));
    expect(res.status).toBe(200);
    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(buf.subarray(0, 4)).toString()).toBe("%PDF");
    const { text } = await extractText(buf, { mergePages: true });
    expect(String(text).replace(/\s+/g, " ")).toContain("needs 24/7 support");
  });

  it("submission copy has no citation markers; review copy keeps them and lists sources and open items", async () => {
    await testDb().draft.updateMany({
      where: { rfpId, sectionName: "exec_summary" },
      data: {
        content: "We support 70 endpoints for Bluegrass Dental Group [S2]. We hold ISO 27001 certification.",
        citations: {
          version: 1,
          sources: { S2: { itemId: "i1", title: "Bluegrass Dental Group", type: "case_study", excerpt: "Managed IT for 6 dental offices, 70 endpoints." } },
          unsupported: ["We hold ISO 27001 certification."],
          dismissed: [],
        },
      },
    });
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    const mammoth = await import("mammoth");
    const exportText = async (query: string) => {
      const res = await POST(new Request(`http://t/x?${query}`, { method: "POST" }), ctx(rfpId));
      expect(res.status).toBe(200);
      return {
        name: res.headers.get("Content-Disposition") ?? "",
        text: (await mammoth.extractRawText({ buffer: Buffer.from(await res.arrayBuffer()) })).value,
      };
    };

    await testDb().rfp.update({ where: { id: rfpId }, data: { status: "drafted" } });
    const review = await exportText("format=docx&variant=review");
    expect(review.name).toContain("review-copy.docx");
    expect(review.text).toContain("[S2]");
    expect(review.text).toContain("INTERNAL REVIEW COPY");
    expect(review.text).toContain("Managed IT for 6 dental offices, 70 endpoints.");
    expect(review.text).toContain("We hold ISO 27001 certification.");
    expect(review.text).toContain("Confirm: start date");
    // A review copy is not the final export.
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).status).toBe("drafted");

    const submission = await exportText("format=docx");
    expect(submission.name).toContain("-proposal.docx");
    expect(submission.text).toContain("We support 70 endpoints for Bluegrass Dental Group.");
    expect(submission.text).not.toMatch(/\[S\d/);
    expect(submission.text).not.toContain("Review notes");
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).status).toBe("exported");

    const pdf = await POST(new Request("http://t/x?format=pdf&variant=review", { method: "POST" }), ctx(rfpId));
    const { text } = await extractText(new Uint8Array(await pdf.arrayBuffer()), { mergePages: true });
    expect(String(text)).toContain("Sources cited");

    expect((await POST(new Request("http://t/x?format=docx&variant=final", { method: "POST" }), ctx(rfpId))).status).toBe(400);
  });

  it("reports the page count against the RFP's page limit", async () => {
    await testDb().rfp.update({ where: { id: rfpId }, data: { extractedSubmission: ["Responses shall not exceed 2 pages"] } });
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    for (const format of ["pdf", "docx"]) {
      const res = await POST(new Request(`http://t/x?format=${format}`, { method: "POST" }), ctx(rfpId));
      expect(res.headers.get("X-Page-Limit")).toBe("2");
      expect(Number(res.headers.get("X-Page-Count"))).toBeGreaterThan(2);
      expect(decodeURIComponent(res.headers.get("X-Page-Warning") ?? "")).toMatch(
        format === "docx" ? /^This export is about \d+ pages/ : /^This export is \d+ pages/,
      );
    }
    // No limit stated: no page headers.
    await testDb().rfp.update({ where: { id: rfpId }, data: { extractedSubmission: [] } });
    const plain = await POST(new Request("http://t/x?format=pdf", { method: "POST" }), ctx(rfpId));
    expect(plain.headers.get("X-Page-Limit")).toBeNull();
  });

  it.skipIf(!SOFFICE)("LibreOffice opens both the Word and PDF exports and shows the text", async () => {
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    const dir = mkdtempSync(join(tmpdir(), "export-"));
    try {
      for (const format of ["docx", "pdf"] as const) {
        const res = await POST(new Request(`http://t/x?format=${format}`, { method: "POST" }), ctx(rfpId));
        writeFileSync(join(dir, `proposal.${format}`), Buffer.from(await res.arrayBuffer()));
      }
      // Word → PDF through LibreOffice's own layout engine, then read the text back.
      execFileSync(SOFFICE!, ["--headless", "--convert-to", "pdf", "--outdir", join(dir, "out"), join(dir, "proposal.docx")], {
        timeout: 120_000,
        stdio: "ignore",
        env: { ...process.env, HOME: dir },
      });
      const converted = new Uint8Array(readFileSync(join(dir, "out", "proposal.pdf")));
      const { text } = await extractText(converted, { mergePages: true });
      expect(String(text).replace(/\s+/g, " ")).toContain("needs 24/7 support");
      // LibreOffice Draw can import our PDF (it fails on malformed files).
      execFileSync(SOFFICE!, ["--headless", "--convert-to", "png", "--outdir", join(dir, "png"), join(dir, "proposal.pdf")], {
        timeout: 120_000,
        stdio: "ignore",
        env: { ...process.env, HOME: dir },
      });
      expect(existsSync(join(dir, "png", "proposal.png"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000);

  it("refuses to export when nothing has been drafted", async () => {
    await testDb().draft.deleteMany({ where: { rfpId } });
    const { POST } = await import("@/app/api/rfps/[id]/export/route");
    expect((await POST(new Request("http://t/x?format=pdf", { method: "POST" }), ctx(rfpId))).status).toBe(400);
  });
});

describe.skipIf(!hasTestDb)("content library limits (cost and context control)", () => {
  beforeEach(async () => {
    await resetDb();
    await createUser("lib", "starter");
    h.clerkId = "lib";
  });

  it("rejects a single item that is too long to be useful in a prompt", async () => {
    const { createLibraryItem } = await import("@/lib/actions/library");
    const res = await createLibraryItem({ type: "case_study", title: "Huge", content: "x".repeat(20_001) });
    expect(res.ok).toBe(false);
  });

  it("rejects new items once the library's total size limit is reached", async () => {
    const { createLibraryItem } = await import("@/lib/actions/library");
    for (let i = 0; i < 10; i++) {
      expect((await createLibraryItem({ type: "case_study", title: `Case ${i}`, content: "y".repeat(19_900) })).ok).toBe(true); // titles count too
    }
    const res = await createLibraryItem({ type: "case_study", title: "One more", content: "z".repeat(1_500) });
    expect(res.ok).toBe(false);
  });
});

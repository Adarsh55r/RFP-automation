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
    const { getRfpUploadQuota } = await import("@/lib/rfps");
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "up" } });
    await start.POST(json({ fileName: "a.pdf", size: 6 * MB, contentType: "application/pdf" }));
    expect((await getRfpUploadQuota(user.id, "starter")).usedThisMonth).toBe(0);
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

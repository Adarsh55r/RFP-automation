import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx } from "../helpers/documents";
import { FIXTURES } from "../fixtures/rfps";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function extraction(amended: boolean) {
  return JSON.stringify({
    documentType: "public_tender",
    scope: "Managed IT services for the City of Fort Hollow",
    deadline: amended ? "2026-12-04" : "2026-11-20",
    eligibilityCriteria: [
      "Current Kentucky business license",
      amended
        ? "General liability insurance of at least $2,000,000 per occurrence"
        : "General liability insurance of at least $1,000,000 per occurrence",
    ],
    desirableCriteria: [],
    evaluationCriteria: ["Technical approach: 40 points", ...(amended ? ["Local presence: 10 points"] : [])],
    submissionRequirements: ["Maximum 20 pages"],
    questionnaireItems: [],
    flaggedForReview: [],
  });
}

function addendumRequest(name: string, body: Buffer, type = DOCX) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(body)], name, { type }));
  return new Request("http://t/x", { method: "POST", body: form });
}

describe.skipIf(!hasTestDb)("addenda", () => {
  let rfpId = "";
  beforeEach(async () => {
    await resetDb();
    const fake = await import("../helpers/fake-supabase");
    fake.files.clear();
    const llm = await import("../helpers/llm");
    llm.resetLlm();
    const user = await createUser("bidder", "starter");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Fort Hollow", status: "uploaded" } });
    const path = `${user.id}/${rfp.id}/rfp.docx`;
    fake.files.set(path, await makeDocx(FIXTURES[0].text));
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
    rfpId = rfp.id;
    h.clerkId = "bidder";
    // The fake model "reads" the addendum only if it was given to it.
    llm.script.json = (req) => extraction((req.user + (req.context ?? "")).includes("=== ADDENDUM 1: Addendum 1.docx"));
  });

  const extract = async () => {
    const { POST } = await import("@/app/api/rfps/[id]/extract/route");
    return POST(new Request("http://t/x", { method: "POST" }), ctx(rfpId));
  };

  it("an addendum is read after the original, and what it changed is recorded and flagged", async () => {
    expect((await extract()).status).toBe(200);
    const { POST: add } = await import("@/app/api/rfps/[id]/addenda/route");
    const added = await add(addendumRequest("Addendum 1.docx", await makeDocx("ADDENDUM 1. The submission deadline is extended to December 4, 2026.")), ctx(rfpId));
    expect(added.status).toBe(200);
    // Adding an addendum does not use up a proposal.
    expect(await testDb().proposalUsage.count()).toBe(0);

    expect((await extract()).status).toBe(200);
    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId }, include: { files: true } });
    expect(rfp.extractedDeadline?.toISOString().slice(0, 10)).toBe("2026-12-04");
    expect(rfp.sourceText).toMatch(/=== ADDENDUM 1: Addendum 1\.docx \(added \d{4}-\d{2}-\d{2}; overrides/);
    expect(rfp.sourceText).toContain("extended to December 4, 2026");
    expect(rfp.files[0].includedAt).not.toBeNull();
    expect(rfp.extractionChanges).toMatchObject({
      addenda: ["Addendum 1.docx"],
      deadline: { from: "2026-11-20", to: "2026-12-04" },
      added: [{ field: "evaluation", text: "Local presence: 10 points" }],
      changed: [{ field: "eligibility" }],
      removed: [],
    });
    expect((rfp.extractedFlags as string[])[0]).toMatch(/^Addenda \(Addendum 1\.docx\): deadline 2026-11-20 → 2026-12-04/);

    // Re-reading again without new addenda keeps the recorded changes and adds no new flag.
    expect((await extract()).status).toBe(200);
    const again = await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } });
    expect((again.extractedFlags as string[]).some((flag) => flag.startsWith("Addenda"))).toBe(false);
    expect(again.extractionChanges).toMatchObject({ addenda: ["Addendum 1.docx"] });
  });

  it("only PDF and Word addenda, checked by content, and only on your own bid", async () => {
    const { POST: add, DELETE: remove } = await import("@/app/api/rfps/[id]/addenda/route");
    expect((await add(addendumRequest("sheet.xlsx", Buffer.from("PK\u0003\u0004")), ctx(rfpId))).status).toBe(400);
    expect((await add(addendumRequest("fake.pdf", Buffer.from("MZ binary"), "application/pdf"), ctx(rfpId))).status).toBe(400);

    const ok = await add(addendumRequest("Addendum 1.docx", await makeDocx("Clarification")), ctx(rfpId));
    const { id: fileId } = await ok.json();

    await createUser("intruder");
    h.clerkId = "intruder";
    expect((await add(addendumRequest("x.docx", await makeDocx("x")), ctx(rfpId))).status).toBe(404);
    expect((await remove(new Request(`http://t/x?fileId=${fileId}`, { method: "DELETE" }), ctx(rfpId))).status).toBe(404);

    h.clerkId = "bidder";
    const fake = await import("../helpers/fake-supabase");
    const stored = [...fake.files.keys()].find((key) => key.includes("addendum-"));
    expect(stored).toBeTruthy();
    expect((await remove(new Request(`http://t/x?fileId=${fileId}`, { method: "DELETE" }), ctx(rfpId))).status).toBe(200);
    expect(fake.files.has(stored!)).toBe(false);
    expect(await testDb().rfpFile.count()).toBe(0);
  });

  it("an unreadable addendum stops the extraction with a clear message and refunds it", async () => {
    await testDb().rfpFile.create({ data: { rfpId, fileName: "Empty.docx", fileUrl: (await import("../helpers/fake-supabase")).getRfpPublicUrl("missing/none.docx") } });
    const fake = await import("../helpers/fake-supabase");
    fake.files.set("missing/none.docx", await makeDocx(""));
    const res = await extract();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/Addendum "Empty\.docx" could not be read/);
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).extractCount).toBe(0);
  });

  it("deleting the RFP removes its addenda files too", async () => {
    const { POST: add } = await import("@/app/api/rfps/[id]/addenda/route");
    await add(addendumRequest("Addendum 1.docx", await makeDocx("Clarification")), ctx(rfpId));
    const { deleteRfp } = await import("@/lib/actions/data-deletion");
    expect((await deleteRfp(rfpId)).ok).toBe(true);
    const fake = await import("../helpers/fake-supabase");
    expect([...fake.files.keys()].filter((key) => key.includes(rfpId))).toEqual([]);
    expect(await testDb().rfpFile.count()).toBe(0);
  });
});

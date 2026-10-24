import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () => null,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!hasTestDb)("cross-user isolation (IDOR)", () => {
  let victimRfpId = "";
  let victimItemId = "";

  beforeEach(async () => {
    await resetDb();
    const victim = await createUser("victim");
    await createUser("attacker");
    const rfp = await testDb().rfp.create({
      data: {
        userId: victim.id,
        title: "Victim RFP",
        status: "drafted",
        extractedScope: "Managed IT",
        originalFileUrl: "https://fake.supabase.local/storage/v1/object/public/rfp-uploads/v/r/file.pdf",
        drafts: { create: [{ sectionName: "exec_summary", content: "Secret plan" }] },
      },
    });
    victimRfpId = rfp.id;
    const item = await testDb().libraryItem.create({
      data: { userId: victim.id, type: "case_study", title: "Secret case", content: "Confidential client results" },
    });
    victimItemId = item.id;
    h.clerkId = "attacker";
  });

  it("route handlers return 404 for another user's RFP", async () => {
    const extract = await import("@/app/api/rfps/[id]/extract/route");
    const draft = await import("@/app/api/rfps/[id]/draft/route");
    const exportRoute = await import("@/app/api/rfps/[id]/export/route");
    const req = (url: string, body?: unknown) =>
      new Request(url, { method: "POST", body: body ? JSON.stringify(body) : undefined, headers: { "content-type": "application/json" } });

    expect((await extract.POST(req("http://t/x"), ctx(victimRfpId))).status).toBe(404);
    expect((await draft.POST(req("http://t/x", {}), ctx(victimRfpId))).status).toBe(404);
    expect((await exportRoute.POST(req("http://t/x?format=docx"), ctx(victimRfpId))).status).toBe(404);
    const after = await testDb().rfp.findUniqueOrThrow({ where: { id: victimRfpId } });
    expect(after.extractCount + after.fullDraftCount).toBe(0);
  });

  it("nobody can finish, abandon or open another user's upload", async () => {
    const pending = await testDb().rfp.create({
      data: { userId: (await testDb().user.findUniqueOrThrow({ where: { clerkId: "victim" } })).id, title: "Victim pending upload" },
    });
    const upload = await import("@/app/api/rfps/[id]/upload/route");
    const file = await import("@/app/api/rfps/[id]/file/route");
    expect((await upload.POST(new Request("http://t/x", { method: "POST" }), ctx(pending.id))).status).toBe(404);
    expect((await upload.DELETE(new Request("http://t/x", { method: "DELETE" }), ctx(pending.id))).status).toBe(404);
    expect((await file.GET(new Request("http://t/x"), ctx(victimRfpId))).status).toBe(404);
    expect(await testDb().rfp.count({ where: { id: pending.id } })).toBe(1);
  });

  it("settings and terms actions only ever touch the caller's own account", async () => {
    const { updateAgencySettings } = await import("@/lib/actions/settings");
    const { acceptCurrentTerms } = await import("@/lib/actions/terms");
    expect((await updateAgencySettings({ agencyName: "Attacker Renamed", teamSize: "1-10" })).ok).toBe(true);
    expect((await acceptCurrentTerms(true)).ok).toBe(true);
    const victim = await testDb().user.findUniqueOrThrow({ where: { clerkId: "victim" } });
    expect(victim.agencyName).toBe("victim Co");
    expect(victim.termsVersion).toBeNull();
  });

  it("server actions refuse another user's records", async () => {
    const { confirmExtraction } = await import("@/lib/actions/rfp-extraction");
    const { saveDraftSection } = await import("@/lib/actions/rfp-draft");
    const { saveCoverDetails } = await import("@/lib/actions/rfp-cover");
    const { updateLibraryItem, deleteLibraryItem } = await import("@/lib/actions/library");

    const confirm = await confirmExtraction({
      rfpId: victimRfpId, documentType: "rfp", scope: "hijack", deadline: "", eligibilityCriteria: "",
      desirableCriteria: "", evaluationCriteria: "", questionnaireItems: "", flaggedForReview: "", submissionRequirements: "",
    });
    expect(confirm.ok).toBe(false);
    expect((await saveDraftSection({ rfpId: victimRfpId, sectionName: "exec_summary", content: "overwritten" })).ok).toBe(false);
    expect((await saveCoverDetails({ rfpId: victimRfpId, cover: { buyerName: "x" } })).ok).toBe(false);
    expect((await updateLibraryItem(victimItemId, { type: "case_study", title: "pwned", content: "pwned content here" })).ok).toBe(false);
    expect((await deleteLibraryItem(victimItemId)).ok).toBe(false);

    const draft = await testDb().draft.findFirstOrThrow({ where: { rfpId: victimRfpId } });
    expect(draft.content).toBe("Secret plan");
    expect(await testDb().libraryItem.count({ where: { id: victimItemId } })).toBe(1);
  });

  it("unauthenticated requests are rejected", async () => {
    h.clerkId = null;
    const extract = await import("@/app/api/rfps/[id]/extract/route");
    const upload = await import("@/app/api/rfps/upload/route");
    expect((await extract.POST(new Request("http://t/x", { method: "POST" }), ctx(victimRfpId))).status).toBe(401);
    expect((await upload.POST(new Request("http://t/x", { method: "POST" }))).status).toBe(401);
  });

  it("admin actions refuse a signed-in non-admin", async () => {
    const { adminSetPlan, adminUnlockAi } = await import("@/lib/actions/admin");
    const victim = await testDb().user.findUniqueOrThrow({ where: { clerkId: "victim" } });
    expect((await adminSetPlan(victim.id, "agency")).ok).toBe(false);
    expect((await adminUnlockAi(victim.id)).ok).toBe(false);
    const sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: victim.id } });
    expect(sub.tier).toBe("starter");
  });
});

describe.skipIf(!hasTestDb)("original file access", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("only the owner can open the uploaded file, via a short-lived signed link", async () => {
    const fake = await import("../helpers/fake-supabase");
    const owner = await createUser("owner");
    await createUser("other");
    const rfp = await testDb().rfp.create({ data: { userId: owner.id, title: "Doc", status: "uploaded" } });
    const path = `${owner.id}/${rfp.id}/rfp.pdf`;
    fake.files.set(path, Buffer.from("%PDF-1.4"));
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });

    const route = await import("@/app/api/rfps/[id]/file/route");
    h.clerkId = "other";
    expect((await route.GET(new Request("http://t/x"), ctx(rfp.id))).status).toBe(404);
    h.clerkId = "owner";
    const res = await route.GET(new Request("http://t/x"), ctx(rfp.id));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/object/sign/");
    expect(res.headers.get("location")).not.toContain("/object/public/");
  });
});

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () => null,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

async function seedRfp(userId: string, title: string) {
  const fake = await import("../helpers/fake-supabase");
  const rfp = await testDb().rfp.create({
    data: {
      userId,
      title,
      status: "drafted",
      sourceText: "Confidential RFP text",
      drafts: { create: [{ sectionName: "exec_summary", content: "Draft text" }] },
    },
  });
  const path = `${userId}/${rfp.id}/file.pdf`;
  fake.files.set(path, new Uint8Array([37, 80, 68, 70, 45]));
  const { completeRfpUpload } = await import("@/lib/rfps");
  await completeRfpUpload(rfp.id, userId, fake.getRfpPublicUrl(path));
  return { rfp, path };
}

describe.skipIf(!hasTestDb)("deleting data", () => {
  let ownerId = "";
  let otherId = "";

  beforeEach(async () => {
    await resetDb();
    const fake = await import("../helpers/fake-supabase");
    fake.files.clear();
    ownerId = (await createUser("owner")).id;
    otherId = (await createUser("other")).id;
    h.clerkId = "owner";
  });

  it("deleting an RFP removes its file, text and drafts but keeps the plan usage it consumed", async () => {
    const fake = await import("../helpers/fake-supabase");
    const { rfp, path } = await seedRfp(ownerId, "Owner RFP");
    const { getRfpUploadQuota } = await import("@/lib/rfps");
    expect((await getRfpUploadQuota(ownerId, "starter")).usedThisMonth).toBe(1);

    const { deleteRfp } = await import("@/lib/actions/data-deletion");
    expect((await deleteRfp(rfp.id)).ok).toBe(true);

    expect(fake.files.has(path)).toBe(false);
    expect(await testDb().rfp.count({ where: { id: rfp.id } })).toBe(0);
    expect(await testDb().draft.count({ where: { rfpId: rfp.id } })).toBe(0);
    // Deleting must not hand back the upload: delete-and-re-upload cannot beat the monthly limit.
    expect((await getRfpUploadQuota(ownerId, "starter")).usedThisMonth).toBe(1);
  });

  it("nobody can delete another user's RFP", async () => {
    const fake = await import("../helpers/fake-supabase");
    const { rfp, path } = await seedRfp(otherId, "Other RFP");
    const { deleteRfp } = await import("@/lib/actions/data-deletion");
    const result = await deleteRfp(rfp.id);
    expect(result.ok).toBe(false);
    expect(await testDb().rfp.count({ where: { id: rfp.id } })).toBe(1);
    expect(fake.files.has(path)).toBe(true);
  });

  it("an RFP that is still being processed cannot be deleted mid-task", async () => {
    const { rfp } = await seedRfp(ownerId, "Busy RFP");
    await testDb().rfp.update({ where: { id: rfp.id }, data: { status: "drafting" } });
    await testDb().user.update({ where: { id: ownerId }, data: { aiBusyUntil: new Date(Date.now() + 60_000) } });
    const { deleteRfp } = await import("@/lib/actions/data-deletion");
    expect((await deleteRfp(rfp.id)).ok).toBe(false);
    expect(await testDb().rfp.count({ where: { id: rfp.id } })).toBe(1);
  });

  it("deleting the workspace removes all of the user's data and files, and nobody else's", async () => {
    const fake = await import("../helpers/fake-supabase");
    const mine = await seedRfp(ownerId, "Mine");
    const theirs = await seedRfp(otherId, "Theirs");
    await testDb().libraryItem.create({ data: { userId: ownerId, type: "case_study", title: "Case", content: "Case study text" } });
    await testDb().aiUsage.create({
      data: { userId: ownerId, rfpId: mine.rfp.id, action: "extract", provider: "openai", model: "gpt-4.1" },
    });

    const { deleteWorkspace } = await import("@/lib/actions/data-deletion");
    expect((await deleteWorkspace("delete me")).ok).toBe(false);
    expect(await testDb().user.count({ where: { id: ownerId } })).toBe(1);

    expect((await deleteWorkspace("DELETE")).ok).toBe(true);
    expect(await testDb().user.count({ where: { id: ownerId } })).toBe(0);
    for (const table of ["rfp", "libraryItem", "aiUsage", "proposalUsage", "subscription"] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(await (testDb()[table] as any).count({ where: { userId: ownerId } }), table).toBe(0);
    }
    expect(await testDb().draft.count({ where: { rfpId: mine.rfp.id } })).toBe(0);
    expect(fake.files.has(mine.path)).toBe(false);

    expect(await testDb().rfp.count({ where: { id: theirs.rfp.id } })).toBe(1);
    expect(fake.files.has(theirs.path)).toBe(true);
  });

  it("the ledger backfill counts uploads made before the ledger existed, once", async () => {
    await testDb().rfp.create({ data: { userId: ownerId, title: "Old upload", originalFileUrl: "https://x/file.pdf" } });
    await testDb().rfp.create({ data: { userId: ownerId, title: "Abandoned upload" } });
    const sql = readFileSync("prisma/migrations/20261023100000_proposal_usage/migration.sql", "utf8");
    const backfill = sql.slice(sql.indexOf("INSERT INTO"));
    await testDb().$executeRawUnsafe(backfill);
    await testDb().$executeRawUnsafe(backfill);
    expect(await testDb().proposalUsage.count({ where: { userId: ownerId } })).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx } from "../helpers/documents";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: "admin@example.test", verification: { status: "verified" } }] }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

async function onPlan(clerkId: string, tier: "free" | "starter" | "pro", planVersion: string, used: number) {
  const user = await createUser(clerkId, tier);
  await testDb().subscription.update({ where: { userId: user.id }, data: { planVersion } });
  for (let i = 0; i < used; i += 1) await testDb().proposalUsage.create({ data: { userId: user.id, rfpId: `old-${i}` } });
  h.clerkId = clerkId;
  return user;
}

async function upload() {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(await makeDocx("RFP text"))], "rfp.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }));
  const route = await import("@/app/api/rfps/upload/route");
  return route.POST(new Request("http://t/api/rfps/upload", { method: "POST", body: form }));
}

describe.skipIf(!hasTestDb)("plan enforcement on the server", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("current Starter needs a paid extra past its limit, and records the extra as paid", async () => {
    const user = await onPlan("starter-now", "starter", "2026-10", 3);
    const ask = await upload();
    expect(ask.status).toBe(402);
    expect(await ask.json()).toMatchObject({ overagePriceUsd: 15 });
    expect(await testDb().rfp.count({ where: { userId: user.id } })).toBe(0);

    await testDb().extraProposal.create({ data: { userId: user.id, paymentId: "pay_extra_1", amountCents: 1500 } });
    const paid = await upload();
    expect(paid.status).toBe(200);
    const usage = await testDb().proposalUsage.findMany({ where: { userId: user.id, overageCents: { not: null } } });
    expect(usage.map((row) => row.overageCents)).toEqual([1500]);
    expect(usage[0].overageBilledAt).not.toBeNull();
    expect((await testDb().extraProposal.findUniqueOrThrow({ where: { paymentId: "pay_extra_1" } })).usedAt).not.toBeNull();
    expect((await upload()).status).toBe(402); // the paid extra is used up
  });

  it("grandfathered Starter keeps its original 5 a month with no surprise charge", async () => {
    await onPlan("starter-legacy", "starter", "legacy", 4);
    expect((await upload()).status).toBe(200); // 5th proposal still included
    const sixth = await upload();
    expect(sixth.status).toBe(403); // legacy plans have no overage: hard stop as before
  });

  it("the new free trial stops after one proposal and says what to do next", async () => {
    await onPlan("trial", "free", "2026-10", 1);
    const res = await upload();
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/free trial/i);
  });

  it("Starter's library holds 50 items; Pro has no item limit", async () => {
    const starter = await onPlan("lib-starter", "starter", "2026-10", 0);
    await testDb().libraryItem.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: starter.id, type: "saved_answer" as const, title: `Item ${i}`, content: "Saved answer text" })),
    });
    const { createLibraryItem } = await import("@/lib/actions/library");
    const refused = await createLibraryItem({ type: "case_study", title: "One more", content: "Case study content here" });
    expect(refused.ok).toBe(false);

    const pro = await onPlan("lib-pro", "pro", "2026-10", 0);
    await testDb().libraryItem.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({ userId: pro.id, type: "saved_answer" as const, title: `Item ${i}`, content: "Saved answer text" })),
    });
    expect((await createLibraryItem({ type: "case_study", title: "One more", content: "Case study content here" })).ok).toBe(true);
  });

  it("an admin plan change moves the account to current pricing, with a pass window for one-time plans", async () => {
    process.env.ADMIN_EMAILS = "admin@example.test";
    const user = await onPlan("customer", "free", "legacy", 0);
    const { adminSetPlan } = await import("@/lib/actions/admin");
    expect((await adminSetPlan(user.id, "single_bid")).ok).toBe(true);
    const sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.tier).toBe("single_bid");
    expect(sub.planVersion).toBe("2026-10");
    const days = (sub.accessEndsAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect((await adminSetPlan(user.id, "agency")).ok).toBe(false); // retired plans cannot be re-assigned
  });
});

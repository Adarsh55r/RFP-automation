import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

async function spend(userId: string, dollars: number, at = new Date(), rfpId: string | null = null) {
  await testDb().aiUsage.create({
    data: { userId, rfpId, action: "full_draft", provider: "openai", model: "gpt-4.1", costMicros: Math.round(dollars * 1e6), createdAt: at },
  });
}

describe.skipIf(!hasTestDb)("AI cost and rate controls", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("stops AI work for the day once the daily ceiling is reached, and alerts once", async () => {
    const user = await createUser("spender", "free");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "R", status: "extracted" } });
    const { beginAiOperation, dailySpendCapUsd } = await import("@/lib/ai-guard");
    await spend(user.id, dailySpendCapUsd.free);

    const denied = await beginAiOperation({ user, tier: "free", rfpId: rfp.id, operation: "full_draft" });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.status).toBe(429);
      expect(denied.error).toMatch(/today/);
    }
    const flagged = await testDb().user.findUniqueOrThrow({ where: { id: user.id } });
    expect(flagged.aiDailyAlertDay).toBe(new Date().toISOString().slice(0, 10));
    // The allowance was not used and the lock was not taken.
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } })).fullDraftCount).toBe(0);
    expect(flagged.aiBusyUntil).toBeNull();
  });

  it("stops AI work for free accounts once all free accounts together reach the shared daily budget", async () => {
    const { beginAccountAiTask, FREE_TIER_DAILY_BUDGET_USD } = await import("@/lib/ai-guard");
    const farmA = await createUser("farm-a", "free");
    const farmB = await createUser("farm-b", "free");
    const payer = await createUser("payer", "starter");
    const newcomer = await createUser("newcomer", "free");
    // Paid spend and yesterday's free spend never count toward the shared budget.
    await spend(payer.id, 6);
    await spend(farmA.id, 50, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    await spend(farmA.id, FREE_TIER_DAILY_BUDGET_USD / 2 - 0.01);
    await spend(farmB.id, FREE_TIER_DAILY_BUDGET_USD / 2);

    const under = await beginAccountAiTask(newcomer, "free");
    expect(under.ok).toBe(true);
    if (under.ok) await under.release();

    await spend(farmB.id, 0.01);
    const denied = await beginAccountAiTask(newcomer, "free");
    expect(denied).toMatchObject({ ok: false, status: 429 });
    if (!denied.ok) expect(denied.error).toMatch(/free trial.*midnight UTC/);
    expect((await testDb().user.findUniqueOrThrow({ where: { id: newcomer.id } })).aiBusyUntil).toBeNull();

    // Paying customers are never affected.
    const paid = await beginAccountAiTask(payer, "starter");
    expect(paid.ok).toBe(true);
    if (paid.ok) await paid.release();
  });

  it("spend from earlier days does not count toward today's ceiling", async () => {
    const user = await createUser("yesterday", "starter");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "R", status: "extracted" } });
    const { beginAiOperation, dailySpendCapUsd } = await import("@/lib/ai-guard");
    await spend(user.id, dailySpendCapUsd.starter, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
    const granted = await beginAiOperation({ user, tier: "starter", rfpId: rfp.id, operation: "full_draft" });
    expect(granted.ok).toBe(true);
    if (granted.ok) await granted.release();
  });

  it("limits how many uploads an account can start in an hour", async () => {
    const user = await createUser("uploader", "growth");
    const { UPLOADS_PER_HOUR } = await import("@/lib/rfps");
    for (let i = 0; i < UPLOADS_PER_HOUR; i += 1) {
      await testDb().rfp.create({ data: { userId: user.id, title: `R${i}` } });
    }
    h.clerkId = "uploader";
    const start = await import("@/app/api/rfps/upload/start/route");
    const res = await start.POST(
      new Request("http://t/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: "rfp.pdf", size: 5 * 1024 * 1024, contentType: "application/pdf" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("reports average and p95 cost per proposal", async () => {
    const user = await createUser("report", "growth");
    const costs = Array.from({ length: 20 }, (_, i) => i + 1); // $1 … $20
    for (const [i, dollars] of costs.entries()) await spend(user.id, dollars, new Date(), `rfp-${i}`);
    const { getAiCosts } = await import("@/lib/admin-data");
    const report = await getAiCosts();
    expect(report.proposals).toBe(20);
    expect(report.avgPerProposalUsd).toBeCloseTo(10.5, 5);
    expect(report.p95PerProposalUsd).toBeCloseTo(19.05, 2); // percentile_cont over 1..20
  });
});

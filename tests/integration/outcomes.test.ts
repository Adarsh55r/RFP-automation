import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const base = { submittedAt: null, outcome: null, contractValue: null, contractCurrency: null, notes: null, hoursSaved: null };

describe.skipIf(!hasTestDb)("recording bid outcomes", () => {
  let rfpId = "";
  beforeEach(async () => {
    await resetDb();
    const user = await createUser("bidder", "starter");
    rfpId = (await testDb().rfp.create({ data: { userId: user.id, title: "Bid", status: "exported" } })).id;
    h.clerkId = "bidder";
  });

  it("saves an outcome and it shows in the dashboard summary", async () => {
    const { updateBidOutcome } = await import("@/lib/actions/outcomes");
    const result = await updateBidOutcome({
      ...base,
      rfpId,
      submittedAt: "2026-10-20",
      outcome: "won",
      contractValue: "125,000",
      contractCurrency: "GBP",
      notes: "Scored highest on quality.",
      hoursSaved: "12.5",
    });
    expect(result).toEqual({ ok: true });
    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } });
    expect(rfp).toMatchObject({ outcome: "won", contractValueCents: 12_500_000, contractCurrency: "GBP", hoursSaved: 12.5 });
    expect(rfp.submittedAt?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(rfp.outcomeAt).not.toBeNull();

    const { getDashboardHomeData } = await import("@/lib/dashboard");
    const data = await getDashboardHomeData();
    expect(data?.outcomes).toMatchObject({ won: 1, winRate: 1, wonValue: { GBP: 125_000 }, hoursSavedTotal: 12.5 });

    // Clearing the fields clears the record.
    await updateBidOutcome({ ...base, rfpId });
    expect(await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).toMatchObject({ outcome: null, outcomeAt: null, contractValueCents: null });
  });

  it("rejects bad values and other people's bids", async () => {
    const { updateBidOutcome } = await import("@/lib/actions/outcomes");
    expect((await updateBidOutcome({ ...base, rfpId, outcome: "great" })).ok).toBe(false);
    expect((await updateBidOutcome({ ...base, rfpId, contractValue: "lots" })).ok).toBe(false);
    expect((await updateBidOutcome({ ...base, rfpId, contractValue: "10", contractCurrency: "BTC" })).ok).toBe(false);
    expect((await updateBidOutcome({ ...base, rfpId, hoursSaved: "-3" })).ok).toBe(false);
    expect((await updateBidOutcome({ ...base, rfpId, submittedAt: "2099-01-01" })).ok).toBe(false);

    await createUser("other");
    h.clerkId = "other";
    expect(await updateBidOutcome({ ...base, rfpId, outcome: "lost" })).toEqual({ ok: false, error: "RFP not found." });
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } })).outcome).toBeNull();
  });
});

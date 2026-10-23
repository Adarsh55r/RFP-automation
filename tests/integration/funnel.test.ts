import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () =>
    h.clerkId ? { primaryEmailAddress: { emailAddress: `${h.clerkId}@example.test` }, emailAddresses: [] } : null,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const post = (body: unknown) =>
  new Request("http://t/api/events", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe.skipIf(!hasTestDb)("funnel analytics", () => {
  beforeEach(async () => {
    await resetDb();
    h.clerkId = null;
  });

  it("accepts only anonymous page events, storing just the path and a known segment", async () => {
    const { POST } = await import("@/app/api/events/route");
    expect((await POST(post({ event: "visit", path: "/for/it-services?seg=it-services&email=x@y.z", seg: "it-services" }))).status).toBe(204);
    expect((await POST(post({ event: "visit_pricing", path: "/pricing", seg: "made-up" }))).status).toBe(204);
    // Signed-in milestones cannot be forged from the browser.
    expect((await POST(post({ event: "paid" }))).status).toBe(400);
    expect((await POST(post({ event: "anything" }))).status).toBe(400);
    const events = await testDb().funnelEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(events.map((e) => [e.event, e.path, e.segment, e.userId])).toEqual([
      ["visit", "/for/it-services", "it-services", null],
      ["visit_pricing", "/pricing", null, null],
    ]);
  });

  it("onboarding records the sign-up segment and industry once, and a single complete_signup", async () => {
    h.clerkId = "newbie";
    const { completeOnboarding } = await import("@/lib/actions/onboarding");
    const payload = { agencyName: "Ridgeline IT", teamSize: "1-10" as const, acceptTerms: true, segment: "it-services", industry: "IT services or managed services" };
    expect((await completeOnboarding(payload)).ok).toBe(true);
    // Finishing again (or from a different link) does not change the first-touch segment or add another sign-up.
    expect((await completeOnboarding({ ...payload, segment: "consultancies", industry: "nonsense" })).ok).toBe(true);
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "newbie" } });
    expect(user).toMatchObject({ signupSegment: "it-services", industry: "IT services or managed services" });
    expect(await testDb().funnelEvent.count({ where: { event: "complete_signup", userId: user.id } })).toBe(1);
  });

  it("records milestones once, from where they happen, and reports them by segment", async () => {
    const user = await createUser("tracked", "starter");
    await testDb().user.update({ where: { id: user.id }, data: { signupSegment: "consultancies" } });
    const other = await createUser("plain", "starter");
    h.clerkId = "tracked";

    const { completeRfpUpload } = await import("@/lib/rfps");
    for (let i = 0; i < 3; i += 1) {
      const rfp = await testDb().rfp.create({ data: { userId: user.id, title: `R${i}`, status: "uploaded" } });
      await completeRfpUpload(rfp.id, user.id, `https://x/${i}`);
    }
    const { recordFirst, recordEvent, funnelBySegment } = await import("@/lib/funnel");
    await recordFirst("first_draft", user.id);
    await recordFirst("first_draft", user.id);
    await recordFirst("paid", user.id);
    await recordEvent("visit", { segment: "consultancies", path: "/for/consultancies" });
    await recordEvent("visit", { segment: "consultancies", path: "/for/consultancies" });
    await recordFirst("first_draft", other.id);

    const { updateBidOutcome } = await import("@/lib/actions/outcomes");
    const rfpId = (await testDb().rfp.findFirstOrThrow({ where: { userId: user.id } })).id;
    await updateBidOutcome({ rfpId, submittedAt: null, outcome: "pending", contractValue: null, contractCurrency: null, notes: null, hoursSaved: null });

    const counts = Object.fromEntries(
      (await testDb().funnelEvent.groupBy({ by: ["event"], where: { userId: user.id }, _count: { _all: true } })).map((r) => [r.event, r._count._all]),
    );
    expect(counts).toEqual({ first_upload: 1, second_proposal: 1, first_draft: 1, paid: 1, outcome_logged: 1 });

    const rows = await funnelBySegment(new Date(Date.now() - 86_400_000));
    expect(rows.find((row) => row.segment === "consultancies")).toEqual({
      segment: "consultancies",
      visits: 2,
      signups: 1,
      firstDraft: 1,
      paid: 1,
      secondProposal: 1,
    });
    expect(rows.find((row) => row.segment === "none")).toMatchObject({ signups: 1, firstDraft: 1, paid: 0 });
  });

  it("events never carry document content", async () => {
    const columns = Object.keys((await import("@/lib/generated/prisma")).Prisma.FunnelEventScalarFieldEnum);
    expect(columns.sort()).toEqual(["createdAt", "event", "id", "path", "segment", "userId"]);
  });
});

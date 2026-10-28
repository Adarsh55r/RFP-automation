import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makePdf } from "../helpers/documents";

/**
 * The plan's proposal limit holds against uploads raced on purpose: several
 * large uploads started before any finishes, or uploads sent at the same
 * moment. Found in the October 2026 security review (bug 1).
 */
const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

const json = (body: unknown) =>
  new Request("http://t/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function setup(tier: "free" | "starter" = "free") {
  await resetDb();
  const fake = await import("../helpers/fake-supabase");
  fake.files.clear();
  const user = await createUser(`racer-${tier}`, tier);
  h.clerkId = `racer-${tier}`;
  const pdf = await makePdf("REQUEST FOR PROPOSALS ".repeat(40));
  const start = (await import("@/app/api/rfps/upload/start/route")).POST;
  const finishRoute = await import("@/app/api/rfps/[id]/upload/route");
  const direct = (await import("@/app/api/rfps/upload/route")).POST;
  const begin = async (name = "rfp.pdf") => {
    const res = await start(json({ fileName: name, size: pdf.length, contentType: "application/pdf" }));
    const body = (await res.json()) as { id?: string; path?: string; error?: string };
    if (res.status === 200 && body.path) fake.files.set(body.path, pdf);
    return { status: res.status, ...body };
  };
  const finish = (id: string) => finishRoute.POST(new Request("http://t/x", { method: "POST" }), ctx(id));
  const upload = () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(pdf)], "rfp.pdf", { type: "application/pdf" }));
    return direct(new Request("http://t/api/rfps/upload", { method: "POST", body: form }));
  };
  const used = () => testDb().proposalUsage.count({ where: { userId: user.id } });
  return { user, fake, pdf, begin, finish, upload, used, finishRoute };
}

describe.skipIf(!hasTestDb)("proposal limits under raced uploads", () => {
  beforeEach(() => {
    h.clerkId = null;
  });

  it("large uploads started before any finishes cannot share the free trial's one proposal", async () => {
    const { begin, finish, used } = await setup();
    const starts = [await begin("a.pdf"), await begin("b.pdf"), await begin("c.pdf"), await begin("d.pdf")];
    expect(starts.map((item) => item.status)).toEqual([200, 403, 403, 403]);
    expect((await finish(starts[0].id!)).status).toBe(200);
    expect(await used()).toBe(1);
  });

  it("uploads sent at the same moment get exactly one proposal on the free trial", async () => {
    const { upload, used } = await setup();
    const results = await Promise.all(Array.from({ length: 5 }, () => upload()));
    expect(results.map((res) => res.status).sort()).toEqual([200, 403, 403, 403, 403]);
    expect(await used()).toBe(1);
  });

  it("an upload that is invalid, cancelled or abandoned gives its proposal back", async () => {
    const { user, fake, begin, finish, finishRoute, used } = await setup();

    // Invalid file: rejected at the finish step, slot returned.
    const bad = await begin("bad.pdf");
    fake.files.set(bad.path!, Buffer.from("not a pdf"));
    expect((await finish(bad.id!)).status).toBe(400);
    expect(await used()).toBe(0);

    // Cancelled by the browser.
    const cancelled = await begin("cancel.pdf");
    expect((await finishRoute.DELETE(new Request("http://t/x", { method: "DELETE" }), ctx(cancelled.id!))).status).toBe(200);
    expect(await used()).toBe(0);

    // Abandoned for over an hour: released when the account next uploads.
    const abandoned = await begin("abandoned.pdf");
    await testDb().rfp.update({ where: { id: abandoned.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    await testDb().proposalUsage.updateMany({ where: { rfpId: abandoned.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    const next = await begin("next.pdf");
    expect(next.status).toBe(200);
    expect(await testDb().rfp.count({ where: { id: abandoned.id } })).toBe(0);
    expect([...fake.files.keys()].some((key) => key.startsWith(`${user.id}/${abandoned.id}/`))).toBe(false);
    expect(await used()).toBe(1);
  });

  it("a finished proposal stays counted when its RFP is deleted", async () => {
    const { begin, finish, used } = await setup();
    const first = await begin();
    expect((await finish(first.id!)).status).toBe(200);
    const { deleteRfp } = await import("@/lib/actions/data-deletion");
    expect((await deleteRfp(first.id!)).ok).toBe(true);
    expect(await used()).toBe(1);
    expect((await begin("again.pdf")).status).toBe(403);
  });

  it("past a paid plan's limit, each paid extra lets exactly one upload through, and a cancelled one keeps it", async () => {
    const { user, begin, upload, finishRoute } = await setup("starter");
    await testDb().subscription.update({ where: { userId: user.id }, data: { planVersion: "2026-10" } });
    for (let i = 0; i < 3; i += 1) await testDb().proposalUsage.create({ data: { userId: user.id } });

    const ask = await upload();
    expect(ask.status).toBe(402);
    expect(await ask.json()).toMatchObject({ overagePriceUsd: 15 });

    // One paid extra, two simultaneous uploads: only one gets through.
    await testDb().extraProposal.create({ data: { userId: user.id, paymentId: "pay_1", amountCents: 1500 } });
    const results = await Promise.all([upload(), upload()]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 402]);
    expect(await testDb().proposalUsage.count({ where: { userId: user.id } })).toBe(4);

    // A large upload started with a paid extra and then cancelled gives the extra back.
    await testDb().extraProposal.create({ data: { userId: user.id, paymentId: "pay_2", amountCents: 1500 } });
    const started = await begin("big.pdf");
    expect(started.status).toBe(200);
    expect(await testDb().extraProposal.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
    await finishRoute.DELETE(new Request("http://t/x", { method: "DELETE" }), ctx(started.id!));
    expect(await testDb().extraProposal.count({ where: { userId: user.id, usedAt: null } })).toBe(1);
    expect(await testDb().proposalUsage.count({ where: { userId: user.id } })).toBe(4);
  });
});

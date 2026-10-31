import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const SECRET = `whsec_${Buffer.from("dodo-test-secret").toString("base64")}`;
const PRODUCTS = {
  DODO_PRODUCT_SINGLE_BID: "pdt_single",
  DODO_PRODUCT_STARTER_MONTHLY: "pdt_starter_m",
  DODO_PRODUCT_STARTER_ANNUAL: "pdt_starter_y",
  DODO_PRODUCT_PRO_MONTHLY: "pdt_pro_m",
  DODO_PRODUCT_PRO_ANNUAL: "pdt_pro_y",
  DODO_PRODUCT_EXTRA_PROPOSAL_STARTER: "pdt_extra_starter",
  DODO_PRODUCT_EXTRA_PROPOSAL_PRO: "pdt_extra_pro",
};

/** Sends a signed webhook to the real route. */
async function deliver(type: string, data: Record<string, unknown>, { id = randomUUID() as string, at = new Date() } = {}) {
  const body = JSON.stringify({ business_id: "bus_1", type, timestamp: at.toISOString(), data });
  const ts = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const signature = `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
  const { POST } = await import("@/app/api/webhooks/dodo/route");
  return POST(
    new Request("http://t/api/webhooks/dodo", {
      method: "POST",
      body,
      headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": signature },
    }),
  );
}

const subscriptionData = (userId: string, overrides: Record<string, unknown> = {}) => ({
  payload_type: "Subscription",
  subscription_id: "sub_1",
  status: "active",
  product_id: "pdt_starter_y",
  customer: { customer_id: "cus_1", email: "buyer@example.test" },
  metadata: { user_id: userId },
  next_billing_date: "2027-10-28T00:00:00Z",
  cancel_at_next_billing_date: false,
  ...overrides,
});

/** Records Dodo API calls and answers them like Dodo would. */
function mockDodoApi() {
  const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const { pathname, search } = new URL(url);
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ method: init.method ?? "GET", path: pathname + search, body });
    const reply = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    if (pathname === "/checkouts") return reply({ session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/session/cks_1" });
    if (pathname === "/discounts") return reply({ discount_id: "dsc_1", code: "PASSCREDIT19" });
    if (pathname.endsWith("/change-plan")) return reply({});
    if (pathname.endsWith("/customer-portal/session")) return reply({ link: "https://portal.example/cus_1" });
    return new Response("not found", { status: 404 });
  });
  return calls;
}

describe.skipIf(!hasTestDb)("Dodo Payments billing", () => {
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "test_key");
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", SECRET);
    for (const [name, value] of Object.entries(PRODUCTS)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("refuses unsigned or wrongly signed webhooks without touching any account", async () => {
    const user = await createUser("nosig", "free");
    const { POST } = await import("@/app/api/webhooks/dodo/route");
    const forged = await POST(
      new Request("http://t/api/webhooks/dodo", {
        method: "POST",
        body: JSON.stringify({ type: "subscription.active", timestamp: new Date().toISOString(), data: subscriptionData(user.id) }),
        headers: { "webhook-id": "x", "webhook-timestamp": String(Math.floor(Date.now() / 1000)), "webhook-signature": "v1,AAAA" },
      }),
    );
    expect(forged.status).toBe(401);
    expect((await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } })).tier).toBe("free");
  });

  it("an active subscription sets the plan, a retried delivery is applied once, and a late older event is ignored", async () => {
    const user = await createUser("sub", "free");
    const now = new Date();
    const first = await deliver("subscription.active", subscriptionData(user.id), { id: "msg_active", at: now });
    expect(first.status).toBe(200);
    let sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub).toMatchObject({
      tier: "starter",
      billingCycle: "annual",
      status: "active",
      planVersion: "2026-10",
      dodoSubscriptionId: "sub_1",
      dodoCustomerId: "cus_1",
      providerStatus: "active",
    });
    expect(sub.currentPeriodEnd?.toISOString()).toBe("2027-10-28T00:00:00.000Z");
    expect(await testDb().funnelEvent.count({ where: { userId: user.id, event: "paid" } })).toBe(1);

    const retry = await deliver("subscription.active", subscriptionData(user.id), { id: "msg_active", at: now });
    expect(await retry.json()).toMatchObject({ result: "duplicate" });

    // A cancellation set later, then an older "active" event arriving late.
    await deliver("subscription.updated", subscriptionData(user.id, { cancel_at_next_billing_date: true }), { at: new Date(now.getTime() + 1000) });
    await deliver("subscription.active", subscriptionData(user.id), { at: new Date(now.getTime() - 60_000) });
    sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.cancelAtPeriodEnd).toBe(true);
  });

  it("a failed renewal pauses uploads; paying again restores them; cancellation moves the account to free", async () => {
    const user = await createUser("renew", "free");
    const t = Date.now();
    await deliver("subscription.active", subscriptionData(user.id, { product_id: "pdt_pro_m" }), { at: new Date(t) });
    await deliver("subscription.on_hold", subscriptionData(user.id, { product_id: "pdt_pro_m", status: "on_hold" }), { at: new Date(t + 1000) });
    let sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub).toMatchObject({ tier: "pro", status: "past_due", providerStatus: "on_hold" });
    const { decideUpload, getProposalAllowance } = await import("@/lib/entitlements");
    const held = decideUpload(await getProposalAllowance(user.id, sub));
    expect(held).toMatchObject({ ok: false, status: 403 });

    await deliver("subscription.active", subscriptionData(user.id, { product_id: "pdt_pro_m" }), { at: new Date(t + 2000) });
    sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(decideUpload(await getProposalAllowance(user.id, sub)).ok).toBe(true);

    await deliver("subscription.cancelled", subscriptionData(user.id, { product_id: "pdt_pro_m", status: "cancelled" }), { at: new Date(t + 3000) });
    sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub).toMatchObject({ tier: "free", status: "canceled", billingCycle: null });
  });

  it("an old or never-started subscription cannot take away the current plan", async () => {
    const user = await createUser("two-subs", "free");
    await deliver("subscription.active", subscriptionData(user.id, { subscription_id: "sub_new" }));
    await deliver("subscription.failed", subscriptionData(user.id, { subscription_id: "sub_other", status: "failed" }));
    await deliver("subscription.cancelled", subscriptionData(user.id, { subscription_id: "sub_old", status: "cancelled" }));
    const sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub).toMatchObject({ tier: "starter", status: "active", dodoSubscriptionId: "sub_new" });
  });

  it("a single-bid payment grants 30 days, matched by email when no metadata is present", async () => {
    const user = await createUser("pass", "free");
    await testDb().user.update({ where: { id: user.id }, data: { email: "Pass.Buyer@example.test" } });
    const paidAt = new Date("2026-10-28T10:00:00Z");
    await deliver("payment.succeeded", {
      payload_type: "Payment",
      payment_id: "pay_pass",
      status: "succeeded",
      subscription_id: null,
      customer: { customer_id: "cus_pass", email: "pass.buyer@example.test" },
      metadata: {},
      product_cart: [{ product_id: "pdt_single", quantity: 1 }],
      created_at: paidAt.toISOString(),
    });
    const sub = await testDb().subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub).toMatchObject({ tier: "single_bid", status: "active", planVersion: "2026-10", dodoCustomerId: "cus_pass" });
    expect(sub.accessEndsAt?.toISOString()).toBe("2026-11-27T10:00:00.000Z");
  });

  it("an extra-proposal payment adds one credit, even if Dodo delivers the event twice", async () => {
    const user = await createUser("extra", "starter");
    const payment = {
      payload_type: "Payment",
      payment_id: "pay_extra",
      subscription_id: null,
      customer: { customer_id: "cus_x", email: "extra@example.test" },
      metadata: { user_id: user.id, kind: "extra_proposal" },
      product_cart: [{ product_id: "pdt_extra_starter", quantity: 1 }],
    };
    await deliver("payment.succeeded", payment, { id: "a" });
    await deliver("payment.succeeded", payment, { id: "b" });
    const extras = await testDb().extraProposal.findMany({ where: { userId: user.id } });
    expect(extras).toHaveLength(1);
    expect(extras[0]).toMatchObject({ paymentId: "pay_extra", amountCents: 1500, usedAt: null });
  });

  it("checkout for a new subscriber carries the account in metadata and locks the email", async () => {
    const calls = mockDodoApi();
    const user = await createUser("buyer", "free");
    await testDb().subscription.update({ where: { userId: user.id }, data: { planVersion: "2026-10" } });
    const { startPlanCheckout } = await import("@/lib/billing");
    const result = await startPlanCheckout(user.id, "pro", "annual");
    expect(result).toEqual({ ok: true, url: "https://test.checkout.dodopayments.com/session/cks_1" });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({
      product_cart: [{ product_id: "pdt_pro_y", quantity: 1 }],
      customer: { email: "buyer@example.test", name: "buyer Co" },
      metadata: { user_id: user.id, plan_id: "pro", cycle: "annual" },
      feature_flags: { allow_customer_editing_email: false },
      customization: {
        theme: "dark",
        theme_config: { light: { button_primary: "#0f6e5b" }, radius: "8px", pay_button_text: "Start Pro" },
      },
    });
    expect(calls[0].body).not.toHaveProperty("discount_codes");
  });

  it("a single-bid buyer subscribing within 30 days gets one $19 code, reused if checkout is retried", async () => {
    const calls = mockDodoApi();
    const user = await createUser("upgrader", "single_bid");
    const now = new Date();
    await testDb().subscription.update({
      where: { userId: user.id },
      data: { planVersion: "2026-10", accessEndsAt: new Date(now.getTime() + 20 * 86_400_000), dodoCustomerId: "cus_up" },
    });
    const { startPlanCheckout } = await import("@/lib/billing");
    await startPlanCheckout(user.id, "starter", "monthly", now);
    await startPlanCheckout(user.id, "starter", "annual", now);
    const discounts = calls.filter((call) => call.path === "/discounts");
    expect(discounts).toHaveLength(1);
    expect(discounts[0].body).toMatchObject({
      type: "flat",
      usage_limit: 1,
      subscription_cycles: 1,
      currency_options: [{ currency: "USD", max_amount_possible: 1900 }],
      restricted_to: ["pdt_starter_m", "pdt_starter_y", "pdt_pro_m", "pdt_pro_y"],
    });
    const checkouts = calls.filter((call) => call.path === "/checkouts");
    expect(checkouts.map((call) => call.body?.discount_codes)).toEqual([["PASSCREDIT19"], ["PASSCREDIT19"]]);
    expect(checkouts[0].body).toMatchObject({ customer: { customer_id: "cus_up" } });

    // After the pass's 30 days there is no credit.
    await testDb().subscription.update({ where: { userId: user.id }, data: { accessEndsAt: new Date(now.getTime() - 1000), passCreditCode: null } });
    await startPlanCheckout(user.id, "starter", "monthly", now);
    expect(calls.filter((call) => call.path === "/discounts")).toHaveLength(1);
    expect(calls.at(-1)?.body).not.toHaveProperty("discount_codes");
  });

  it("subscribers change plan in place: upgrades now, downgrades at renewal, and no pass on top", async () => {
    const calls = mockDodoApi();
    const user = await createUser("changer", "starter");
    await testDb().subscription.update({
      where: { userId: user.id },
      data: { planVersion: "2026-10", billingCycle: "monthly", dodoSubscriptionId: "sub_c", dodoCustomerId: "cus_c", currentPeriodEnd: new Date("2026-11-28T00:00:00Z") },
    });
    const { startPlanCheckout } = await import("@/lib/billing");
    const up = await startPlanCheckout(user.id, "pro", "monthly");
    expect(up).toMatchObject({ ok: true, message: expect.stringMatching(/Switching you to Pro/) });
    expect(calls[0]).toMatchObject({
      path: "/subscriptions/sub_c/change-plan",
      body: { product_id: "pdt_pro_m", effective_at: "immediately", proration_billing_mode: "prorated_immediately", on_payment_failure: "prevent_change" },
    });

    await testDb().subscription.update({ where: { userId: user.id }, data: { tier: "pro" } });
    const down = await startPlanCheckout(user.id, "starter", "monthly");
    expect(down).toMatchObject({ ok: true, message: "Starter starts on 2026-11-28. You keep your current plan until then." });
    expect(calls[1].body).toMatchObject({ product_id: "pdt_starter_m", effective_at: "next_billing_date" });

    // Monthly to annual on the same plan applies now; annual to monthly waits for the renewal.
    await startPlanCheckout(user.id, "pro", "annual");
    expect(calls[2].body).toMatchObject({ product_id: "pdt_pro_y", effective_at: "immediately" });
    await testDb().subscription.update({ where: { userId: user.id }, data: { billingCycle: "annual" } });
    await startPlanCheckout(user.id, "pro", "monthly");
    expect(calls[3].body).toMatchObject({ product_id: "pdt_pro_m", effective_at: "next_billing_date" });
    await testDb().subscription.update({ where: { userId: user.id }, data: { billingCycle: "monthly" } });

    expect(await startPlanCheckout(user.id, "pro", "monthly")).toEqual({ ok: false, error: "You are already on this plan." });
    expect((await startPlanCheckout(user.id, "single_bid", "monthly")).ok).toBe(false);
    expect(calls).toHaveLength(4);
  });

  it("extra proposals can be bought on plans that sell them, at the plan's price", async () => {
    const calls = mockDodoApi();
    const pro = await createUser("pro-extra", "pro");
    await testDb().subscription.update({ where: { userId: pro.id }, data: { planVersion: "2026-10" } });
    const { startExtraProposalCheckout } = await import("@/lib/billing");
    expect((await startExtraProposalCheckout(pro.id)).ok).toBe(true);
    expect(calls[0].body).toMatchObject({ product_cart: [{ product_id: "pdt_extra_pro", quantity: 1 }], metadata: { kind: "extra_proposal" } });

    const trial = await createUser("trial-extra", "free");
    await testDb().subscription.update({ where: { userId: trial.id }, data: { planVersion: "2026-10" } });
    expect((await startExtraProposalCheckout(trial.id)).ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("if Dodo refuses the styling, checkout still opens without it", async () => {
    const calls: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      calls.push(body);
      if (body.customization) return new Response(JSON.stringify({ code: "INVALID_REQUEST" }), { status: 422 });
      return new Response(JSON.stringify({ session_id: "cks_2", checkout_url: "https://test.checkout.dodopayments.com/session/cks_2" }), { status: 200 });
    });
    const user = await createUser("plain", "free");
    const { startPlanCheckout } = await import("@/lib/billing");
    expect(await startPlanCheckout(user.id, "starter", "monthly")).toEqual({ ok: true, url: "https://test.checkout.dodopayments.com/session/cks_2" });
    expect(calls.map((body) => Boolean(body.customization))).toEqual([true, false]);
  });

  it("without Dodo configured, checkout says so and calls nothing", async () => {
    const calls = mockDodoApi();
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "");
    const user = await createUser("offline", "free");
    const { startPlanCheckout } = await import("@/lib/billing");
    expect(await startPlanCheckout(user.id, "starter", "monthly")).toMatchObject({ ok: false, error: expect.stringMatching(/not available yet/) });
    expect(calls).toHaveLength(0);
  });
});

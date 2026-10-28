import { describe, expect, it } from "vitest";
import { computeAllowance, decideUpload } from "@/lib/entitlements";
import { gbpAvailable, isSellablePlan, PLANS, publicPlans, resolvePlan } from "@/lib/plans";

const DAY = 24 * 60 * 60 * 1000;

describe("plan config", () => {
  it("sells the free trial, single-bid pass, Starter and Pro, and hides the rest", () => {
    expect(publicPlans.map((plan) => plan.id)).toEqual(["free", "single_bid", "starter", "pro"]);
    expect(isSellablePlan("consultant")).toBe(false); // client workspaces not built
    expect(isSellablePlan("agency")).toBe(false); // retired unlimited plan
    expect(isSellablePlan("pilot")).toBe(false); // retired with the done-with-you setup it included
    expect(publicPlans.some((plan) => plan.id === "pilot")).toBe(false);
  });

  it("annual billing is two months free", () => {
    for (const id of ["starter", "pro"] as const) {
      const billing = PLANS[id].billing;
      if (billing.kind !== "subscription") throw new Error("expected a subscription");
      expect(billing.annual.usd).toBe(billing.monthly.usd * 10);
    }
  });

  it("matches the agreed prices and limits", () => {
    expect(PLANS.starter.billing).toMatchObject({ monthly: { usd: 49 }, annual: { usd: 490 } });
    expect(PLANS.pro.billing).toMatchObject({ monthly: { usd: 129 }, annual: { usd: 1290 } });
    expect(PLANS.single_bid.billing).toMatchObject({ price: { usd: 29 }, accessDays: 30 });
    expect([PLANS.free.proposals, PLANS.starter.proposals, PLANS.pro.proposals]).toEqual([
      { limit: 1, per: "lifetime" },
      { limit: 3, per: "month" },
      { limit: 10, per: "month" },
    ]);
    expect([PLANS.starter.overage?.usd, PLANS.pro.overage?.usd]).toEqual([15, 12]);
  });

  it("hides GBP until every public price has a confirmed GBP amount", () => {
    expect(gbpAvailable).toBe(false);
  });

  it("keeps grandfathered subscriptions on their original terms", () => {
    expect(resolvePlan({ tier: "starter", planVersion: "legacy" }).proposals).toEqual({ limit: 5, per: "month" });
    expect(resolvePlan({ tier: "free", planVersion: "legacy" }).proposals).toEqual({ limit: 1, per: "month" });
    expect(resolvePlan({ tier: "agency", planVersion: "legacy" }).proposals.limit).toBeNull();
    expect(resolvePlan({ tier: "starter", planVersion: "2026-10" }).proposals).toEqual({ limit: 3, per: "month" });
  });
});

describe("upload decisions", () => {
  const current = (tier: keyof typeof PLANS, extra: Record<string, unknown> = {}) => ({ tier, planVersion: "2026-10", ...extra });

  it("the free trial allows one proposal, ever", () => {
    expect(decideUpload(computeAllowance(current("free"), 0)).ok).toBe(true);
    const second = decideUpload(computeAllowance(current("free"), 1));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(403);
  });

  it("past the limit, Starter asks for an extra proposal to be bought first, then uses a paid one", () => {
    const allowance = computeAllowance(current("starter"), 3);
    const ask = decideUpload(allowance);
    expect(ask).toMatchObject({ ok: false, status: 402, overagePriceUsd: 15 });
    if (!ask.ok) expect(ask.error).toMatch(/Buy an extra proposal for \$15/);
    expect(decideUpload(allowance, 1)).toEqual({ ok: true, useExtra: true });
    // Within the plan, a paid extra is kept for later.
    expect(decideUpload(computeAllowance(current("starter"), 2), 1)).toEqual({ ok: true, useExtra: false });
  });

  it("a failed renewal on hold pauses new proposals, even with a paid extra", () => {
    const held = computeAllowance(current("starter", { providerStatus: "on_hold" }), 0);
    expect(held.paymentOnHold).toBe(true);
    const decision = decideUpload(held, 1);
    expect(decision).toMatchObject({ ok: false, status: 403 });
    if (!decision.ok) expect(decision.error).toMatch(/payment did not go through/);
    // The grace period after a failed payment keeps access.
    expect(decideUpload(computeAllowance(current("starter", { providerStatus: "past_due" }), 0)).ok).toBe(true);
  });

  it("a single-bid pass allows one proposal while it is valid, and none after it ends", () => {
    const now = new Date();
    const valid = current("single_bid", { accessEndsAt: new Date(now.getTime() + 10 * DAY) });
    expect(decideUpload(computeAllowance(valid, 0, now)).ok).toBe(true);
    expect(decideUpload(computeAllowance(valid, 1, now)).ok).toBe(false);
    const ended = current("single_bid", { accessEndsAt: new Date(now.getTime() - DAY) });
    const decision = decideUpload(computeAllowance(ended, 0, now));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.error).toMatch(/pass has ended/);
  });

  it("legacy Team stays unlimited for the accounts that have it", () => {
    expect(decideUpload(computeAllowance({ tier: "agency", planVersion: "legacy" }, 500)).ok).toBe(true);
  });
});

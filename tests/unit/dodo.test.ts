import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutOutcome, dodoConfigured, PRODUCT_ENV, productFromId, productIdFor, verifyWebhook } from "@/lib/dodo";

const SECRET = `whsec_${Buffer.from("test-signing-key-123").toString("base64")}`;

function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

describe("Dodo webhook signatures", () => {
  const body = JSON.stringify({ type: "payment.succeeded", data: { payment_id: "pay_1" } });
  const now = Date.UTC(2026, 9, 28, 12);
  const ts = String(Math.floor(now / 1000));

  it("accepts a correctly signed delivery, including one with several signatures", () => {
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body) }, SECRET, now)).toBe(true);
    const rotated = `v1,${Buffer.from("old").toString("base64")} ${sign("msg_1", ts, body)}`;
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: rotated }, SECRET, now)).toBe(true);
  });

  it("refuses a changed body, another id, a wrong secret, missing headers and old deliveries", () => {
    const signature = sign("msg_1", ts, body);
    expect(verifyWebhook(body.replace("pay_1", "pay_2"), { id: "msg_1", timestamp: ts, signature }, SECRET, now)).toBe(false);
    expect(verifyWebhook(body, { id: "msg_2", timestamp: ts, signature }, SECRET, now)).toBe(false);
    const other = `whsec_${Buffer.from("another-key").toString("base64")}`;
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature }, other, now)).toBe(false);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: null }, SECRET, now)).toBe(false);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature }, null, now)).toBe(false);
    const late = now + 6 * 60 * 1000;
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature }, SECRET, late)).toBe(false);
    expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: signature.replace("v1,", "v2,") }, SECRET, now)).toBe(false);
  });
});

describe("Dodo products", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("maps each configured product ID to what it sells, and back", () => {
    for (const [key, name] of Object.entries(PRODUCT_ENV)) vi.stubEnv(name, `pdt_${key}`);
    expect(productFromId("pdt_pro_annual")).toEqual({ kind: "plan", planId: "pro", cycle: "annual" });
    expect(productFromId("pdt_single_bid")).toEqual({ kind: "plan", planId: "single_bid", cycle: null });
    expect(productFromId("pdt_extra_starter")).toEqual({ kind: "extra_proposal", planId: "starter" });
    expect(productFromId("pdt_unknown")).toBeNull();
    expect(productIdFor({ kind: "plan", planId: "starter", cycle: "monthly" })).toBe("pdt_starter_monthly");
    expect(productIdFor({ kind: "extra_proposal", planId: "pro" })).toBe("pdt_extra_pro");
    expect(productIdFor({ kind: "extra_proposal", planId: "free" })).toBeNull();
  });

  it("is only live once the keys and every product are set", () => {
    vi.stubEnv("DODO_PAYMENTS_API_KEY", "key");
    vi.stubEnv("DODO_PAYMENTS_WEBHOOK_KEY", SECRET);
    for (const name of Object.values(PRODUCT_ENV)) vi.stubEnv(name, "");
    expect(dodoConfigured()).toBe(false);
    for (const [key, name] of Object.entries(PRODUCT_ENV)) vi.stubEnv(name, `pdt_${key}`);
    expect(dodoConfigured()).toBe(true);
  });
});

describe("checkout return status", () => {
  it("tells a failed payment from a paid or still-processing one", () => {
    expect(checkoutOutcome("succeeded")).toBe("paid");
    expect(checkoutOutcome("active")).toBe("paid");
    expect(checkoutOutcome("failed")).toBe("failed");
    expect(checkoutOutcome("cancelled")).toBe("failed");
    expect(checkoutOutcome("processing")).toBe("pending");
    expect(checkoutOutcome(undefined)).toBe("pending");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx, makeScannedPdf } from "../helpers/documents";
import { FIXTURES } from "../fixtures/rfps";

vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
function request(name: string, body: Buffer, ip = "203.0.113.9", type = DOCX) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(body)], name, { type }));
  return new Request("http://t/api/tools/checklist", { method: "POST", body: form, headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
}
const extraction = JSON.stringify({
  documentType: "public_tender",
  scope: "Managed IT for the City of Fort Hollow",
  deadline: "2026-11-20",
  eligibilityCriteria: ["Kentucky business license"],
  desirableCriteria: [],
  evaluationCriteria: ["Technical approach: 40 points"],
  submissionRequirements: ["Maximum 20 pages"],
  questionnaireItems: ["Q1. Describe your transition plan."],
  flaggedForReview: [],
  keyDetails: [{ category: "length_limit", detail: "Max 20 pages", kind: "mandatory", quote: "not to exceed twenty" }],
});

describe.skipIf(!hasTestDb)("free no-signup checklist", () => {
  beforeEach(async () => {
    await resetDb();
    (await import("../helpers/fake-supabase")).files.clear();
    const llm = await import("../helpers/llm");
    llm.resetLlm();
    llm.script.json = () => extraction;
  });

  it("returns the checklist, stores nothing about the file, and keeps only a hashed IP", async () => {
    const { POST } = await import("@/app/api/tools/checklist/route");
    const res = await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ deadline: "2026-11-20", mandatory: ["Kentucky business license"], questionCount: 1 });
    expect(body.keyDetails[0]).toMatchObject({ category: "length_limit" });

    // Nothing stored: no RFP, no file, no usage tied to an account.
    expect(await testDb().rfp.count()).toBe(0);
    expect((await import("../helpers/fake-supabase")).files.size).toBe(0);
    expect(await testDb().aiUsage.count()).toBe(0);
    const runs = await testDb().toolUsage.findMany();
    expect(runs).toHaveLength(1);
    expect(runs[0].ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(runs)).not.toContain("203.0.113.9");
    expect(runs[0].costMicros).toBeGreaterThanOrEqual(0);
  });

  it("limits each visitor per day, counting failed attempts too", async () => {
    const { POST } = await import("@/app/api/tools/checklist/route");
    const scan = await makeScannedPdf(2);
    // Scans need an account (OCR), and still count towards the limit.
    const scanned = await POST(request("scan.pdf", scan, "198.51.100.7", "application/pdf"));
    expect(scanned.status).toBe(422);
    expect((await scanned.json()).error).toMatch(/scanned .* create a free account/i);
    for (let i = 0; i < 2; i += 1) {
      expect((await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text), "198.51.100.7"))).status).toBe(200);
    }
    const limited = await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text), "198.51.100.7"));
    expect(limited.status).toBe(429);
    // Another visitor is unaffected.
    expect((await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text), "192.0.2.44"))).status).toBe(200);
    // No AI call for the scan or the refused request.
    const llm = await import("../helpers/llm");
    expect(llm.calls).toHaveLength(3);
    expect(llm.pdfCalls).toHaveLength(0);
  });

  it("stops for everyone once the daily spend cap is reached", async () => {
    await testDb().toolUsage.create({ data: { tool: "rfp-checklist", ipHash: "x", costMicros: 26_000_000 } });
    const { POST } = await import("@/app/api/tools/checklist/route");
    const res = await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text)));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/capacity/);
  });

  it("requests sent at the same moment from one visitor cannot beat the daily limit", async () => {
    const { POST } = await import("@/app/api/tools/checklist/route");
    const file = await makeDocx(FIXTURES[0].text);
    const results = await Promise.all(Array.from({ length: 10 }, () => POST(request("rfp.docx", file, "198.51.100.20"))));
    const statuses = results.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 200)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(7);
    expect(await testDb().toolUsage.count()).toBe(3);
    expect((await import("../helpers/llm")).calls).toHaveLength(3);
  });

  it("runs still in progress count against the daily budget at their worst-case cost", async () => {
    const { RESERVED_RUN_COST_MICROS, FREE_TOOL } = await import("@/lib/free-tool");
    // Room left for exactly two runs at their worst case.
    const budget = FREE_TOOL.spendPerDayUsd * 1_000_000;
    await testDb().toolUsage.create({
      data: { tool: "rfp-checklist", ipHash: "earlier", costMicros: budget - 2 * RESERVED_RUN_COST_MICROS - 50_000 },
    });
    const llm = await import("../helpers/llm");
    // Each AI call takes a moment, so all five requests are in flight together.
    llm.script.json = async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return extraction;
    };
    const { POST } = await import("@/app/api/tools/checklist/route");
    const file = await makeDocx(FIXTURES[0].text);
    const results = await Promise.all(
      ["192.0.2.1", "192.0.2.2", "192.0.2.3", "192.0.2.4", "192.0.2.5"].map((ip) => POST(request("rfp.docx", file, ip))),
    );
    expect(results.map((res) => res.status).filter((status) => status === 200)).toHaveLength(2);
    expect(llm.calls).toHaveLength(2);
  });

  it("a failed AI call keeps its reserved cost; a run stopped before the AI costs nothing", async () => {
    const { RESERVED_RUN_COST_MICROS } = await import("@/lib/free-tool");
    const llm = await import("../helpers/llm");
    llm.script.json = () => {
      throw new Error("provider timed out");
    };
    const { POST } = await import("@/app/api/tools/checklist/route");
    const failed = await POST(request("rfp.docx", await makeDocx(FIXTURES[0].text), "203.0.113.50"));
    expect(failed.status).toBe(500);
    const scanned = await POST(request("scan.pdf", await makeScannedPdf(2), "203.0.113.51", "application/pdf"));
    expect(scanned.status).toBe(422);
    const runs = await testDb().toolUsage.findMany({ orderBy: { createdAt: "asc" } });
    expect(runs.map((run) => run.costMicros)).toEqual([RESERVED_RUN_COST_MICROS, 0]);
  });

  it("refuses other file types and fake files", async () => {
    const { POST } = await import("@/app/api/tools/checklist/route");
    expect((await POST(request("q.xlsx", Buffer.from("PK\u0003\u0004"), "1.1.1.1", "application/octet-stream"))).status).toBe(400);
    expect((await POST(request("rfp.pdf", Buffer.from("MZ not a pdf"), "1.1.1.1", "application/pdf"))).status).toBe(400);
  });

  it("stores an email only with consent, once", async () => {
    const { POST } = await import("@/app/api/tools/lead/route");
    const lead = (body: unknown) =>
      POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5" } }));
    expect((await lead({ email: "a@b.co", consent: false })).status).toBe(400);
    expect((await lead({ email: "not-an-email", consent: true })).status).toBe(400);
    expect((await lead({ email: "Bid@Example.com", consent: true, segment: "it-services" })).status).toBe(200);
    expect((await lead({ email: "bid@example.com", consent: true })).status).toBe(200);
    const leads = await testDb().lead.findMany();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ email: "bid@example.com", segment: "it-services", source: "rfp-checklist" });
  });
});

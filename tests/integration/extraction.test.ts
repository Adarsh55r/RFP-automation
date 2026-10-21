import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx } from "../helpers/documents";
import { FIXTURES } from "../fixtures/rfps";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream };
});

const fixture = (id: string) => FIXTURES.find((f) => f.id === id)!;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function goodJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    documentType: "public_tender",
    scope: "Managed IT services for the City of Fort Hollow, 85 users, 3-year term",
    deadline: "2026-11-20",
    eligibilityCriteria: ["Current Kentucky business license", "General liability insurance of at least $2,000,000 per occurrence"],
    desirableCriteria: ["Experience supporting municipal clients"],
    evaluationCriteria: ["Technical approach: 40 points", "Price: 25 points"],
    submissionRequirements: ["Maximum 20 pages excluding appendices"],
    questionnaireItems: ["Q1. Describe your onboarding and transition plan for the first 30 days."],
    flaggedForReview: [],
    ...overrides,
  });
}

async function setup(text: string) {
  const llm = await import("../helpers/llm");
  const fake = await import("../helpers/fake-supabase");
  llm.resetLlm();
  const user = await createUser("u1", "free");
  const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Fort Hollow", status: "uploaded" } });
  const path = `${user.id}/${rfp.id}/rfp.docx`;
  fake.files.set(path, await makeDocx(text));
  await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
  h.clerkId = "u1";
  const route = await import("@/app/api/rfps/[id]/extract/route");
  const run = () => route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id));
  return { user, rfp, run, llm };
}

describe.skipIf(!hasTestDb)("extraction route", () => {
  beforeEach(resetDb);

  it("stores extracted requirements and the full source text", async () => {
    const { rfp, run, llm } = await setup(fixture("straightforward-public-tender").text);
    llm.script.json = () => goodJson();
    const res = await run();
    expect(res.status).toBe(200);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(saved.status).toBe("extracted");
    expect(saved.extractedDeadline?.toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(saved.sourceText).toContain("Q5. Describe your approach to cybersecurity monitoring.");
    // The document reaches the model inside delimiters, after the trusted instructions.
    expect(llm.calls[0].user).toContain("Kentucky business license");
  });

  it("reads requirements that sit beyond 120,000 characters in a long RFP", async () => {
    const long = fixture("long-rfp-requirement-at-end");
    expect(long.text.length).toBeGreaterThan(120_000);
    const { run, llm } = await setup(long.text);
    llm.script.json = () => goodJson();
    await run();
    expect(llm.calls[0].user).toContain("performance bond equal to 10%");
  });

  it("tells the user when the document is too long to read in full", async () => {
    const huge = fixture("straightforward-public-tender").text + "\n" + "Filler sentence about general terms. ".repeat(14_000);
    const { rfp, run, llm } = await setup(huge);
    llm.script.json = () => goodJson();
    await run();
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(JSON.stringify(saved.extractedFlags)).toMatch(/only the first/i);
  });

  it("flags a deadline that does not appear anywhere in the document", async () => {
    const { rfp, run, llm } = await setup(fixture("missing-deadline").text);
    llm.script.json = () => goodJson({ deadline: "2026-12-01" });
    await run();
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(JSON.stringify(saved.extractedFlags)).toMatch(/deadline/i);
  });

  it("flags when fewer questions were extracted than the document numbers", async () => {
    const { rfp, run, llm } = await setup(fixture("security-questionnaire-60").text);
    llm.script.json = () =>
      goodJson({ documentType: "security_questionnaire", deadline: "2027-01-15", questionnaireItems: Array.from({ length: 45 }, (_, i) => `${i + 1}. Question`) });
    await run();
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(JSON.stringify(saved.extractedFlags)).toMatch(/60/);
  });

  it("gives a clear error and refunds the attempt when the model output is cut off", async () => {
    const { rfp, run, llm } = await setup(fixture("straightforward-public-tender").text);
    llm.script.json = () => goodJson().slice(0, 200);
    const res = await run();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toMatch(/invalid JSON/i);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(saved.status).toBe("uploaded");
    expect(saved.extractCount).toBe(0);
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "u1" } });
    expect(user.aiBusyUntil).toBeNull();
  });

  it("recovers an RFP left in 'extracting' by a killed request once the AI lock has expired", async () => {
    const { rfp, run, llm } = await setup(fixture("straightforward-public-tender").text);
    await testDb().rfp.update({ where: { id: rfp.id }, data: { status: "extracting" } });
    llm.script.json = () => goodJson();
    const res = await run();
    expect(res.status).toBe(200);
  });

  it("still refuses a second extraction while one is genuinely running", async () => {
    const { rfp, user, run, llm } = await setup(fixture("straightforward-public-tender").text);
    await testDb().rfp.update({ where: { id: rfp.id }, data: { status: "extracting" } });
    await testDb().user.update({ where: { id: user.id }, data: { aiBusyUntil: new Date(Date.now() + 5 * 60_000) } });
    llm.script.json = () => goodJson();
    expect((await run()).status).toBe(409);
  });

  it("explains that scanned/image-only PDFs need OCR instead of a generic failure", async () => {
    const llm = await import("../helpers/llm");
    const fake = await import("../helpers/fake-supabase");
    llm.resetLlm();
    const user = await createUser("u2");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Scan", status: "uploaded" } });
    const path = `${user.id}/${rfp.id}/scan.docx`;
    fake.files.set(path, await makeDocx(""));
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
    h.clerkId = "u2";
    const route = await import("@/app/api/rfps/[id]/extract/route");
    const res = await route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await res.json()).error).toMatch(/text|scan/i);
    expect(llm.calls.length).toBe(0);
  });
});

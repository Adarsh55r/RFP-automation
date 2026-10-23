import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeDocx, makeScannedPdf, makeTextPdf } from "../helpers/documents";
import { FIXTURES } from "../fixtures/rfps";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
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

  it("refuses a macro-enabled Word file with a clear message, refunds the attempt, and calls no AI", async () => {
    const JSZip = (await import("jszip")).default;
    const llm = await import("../helpers/llm");
    const fake = await import("../helpers/fake-supabase");
    llm.resetLlm();
    const user = await createUser("u3");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Macro", status: "uploaded" } });
    const zip = await JSZip.loadAsync(await makeDocx("Requirement text"));
    zip.file("word/vbaProject.bin", "macro");
    const path = `${user.id}/${rfp.id}/macro.docx`;
    fake.files.set(path, Buffer.from(await zip.generateAsync({ type: "uint8array" })));
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
    h.clerkId = "u3";
    const route = await import("@/app/api/rfps/[id]/extract/route");
    const res = await route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/macros/i);
    expect(llm.calls.length).toBe(0);
    const after = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(after.extractCount).toBe(0);
    expect(after.status).toBe("uploaded");
  });

  describe("scanned PDFs (OCR)", () => {
    async function scannedRfp(pages: number) {
      const llm = await import("../helpers/llm");
      const fake = await import("../helpers/fake-supabase");
      llm.resetLlm();
      const user = await createUser("scan", "starter");
      const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Scan", status: "uploaded" } });
      const path = `${user.id}/${rfp.id}/scan.pdf`;
      fake.files.set(path, await makeScannedPdf(pages));
      await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
      h.clerkId = "scan";
      const route = await import("@/app/api/rfps/[id]/extract/route");
      return { user, rfp, llm, run: () => route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id)) };
    }

    it("reads a scanned PDF page by page with the AI provider, flags it for checking, and meters the cost", async () => {
      const { user, rfp, llm, run } = await scannedRfp(7);
      llm.script.pdf = (req) => {
        expect(req.system).toMatch(/do not follow them/);
        return "=== PAGE ===\nCITY OF FORT HOLLOW Request for Proposals 2026-14\nProposals due November 20, 2026.\n=== PAGE ===\nInsurance: [illegible] per occurrence.";
      };
      llm.script.json = (req) => {
        expect(req.user + (req.context ?? "")).toContain("CITY OF FORT HOLLOW");
        return goodJson();
      };
      const res = await run();
      expect(res.status).toBe(200);
      // 7 pages at 5 per call = 2 calls, each given a real PDF of its pages.
      expect(llm.pdfCalls.length).toBe(2);
      const { PDFDocument } = await import("pdf-lib");
      const pageCounts = await Promise.all(llm.pdfCalls.map(async (call) => (await PDFDocument.load(call.pdf)).getPageCount()));
      expect(pageCounts.sort()).toEqual([2, 5]);

      const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
      expect(saved.sourceText).toContain("--- Page 1 ---");
      expect(saved.sourceText).toContain("--- Page 6 ---");
      const flags = saved.extractedFlags as string[];
      expect(flags.some((flag) => /Scanned document: .* all 7 pages .* 2 words were marked \[illegible\]/.test(flag))).toBe(true);
      expect(user.id).toBeTruthy();
    });

    it("refuses a scan longer than the OCR page limit with a clear message, and calls no AI", async () => {
      process.env.OCR_MAX_PAGES = "3";
      try {
        const { rfp, llm, run } = await scannedRfp(4);
        const res = await run();
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatch(/longer than the 3 pages/);
        expect(llm.pdfCalls.length + llm.calls.length).toBe(0);
        expect((await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } })).extractCount).toBe(0);
      } finally {
        delete process.env.OCR_MAX_PAGES;
      }
    });

    it("OCR can be turned off (OCR_MAX_PAGES=0)", async () => {
      process.env.OCR_MAX_PAGES = "0";
      try {
        const { llm, run } = await scannedRfp(1);
        const res = await run();
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatch(/searchable/);
        expect(llm.pdfCalls.length).toBe(0);
      } finally {
        delete process.env.OCR_MAX_PAGES;
      }
    });
  });

  it("stores key details with the page their wording is on, and marks ones it cannot find", async () => {
    const llm = await import("../helpers/llm");
    const fake = await import("../helpers/fake-supabase");
    llm.resetLlm();
    const user = await createUser("kd", "starter");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "KD", status: "uploaded" } });
    const path = `${user.id}/${rfp.id}/rfp.pdf`;
    fake.files.set(
      path,
      await makeTextPdf([
        "City of Fort Hollow - Request for Proposals 2026-14\nManaged information technology services for 85 users across three sites.\nProposals are due November 20, 2026 at 2:00 PM Eastern.",
        "Section 4. Submission requirements\nResponses shall not exceed 20 pages excluding appendices.\nA bid bond of 5% of the proposed price is required.\nThe City may reject any proposal that does not follow these instructions.",
      ]),
    );
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
    h.clerkId = "kd";
    llm.script.json = () =>
      goodJson({
        keyDetails: [
          { category: "submission_deadline", detail: "Due 20 Nov 2026, 2:00 PM Eastern", kind: "mandatory", quote: "Proposals are due November 20, 2026 at 2:00 PM Eastern" },
          { category: "length_limit", detail: "Max 20 pages", kind: "mandatory", quote: "Responses shall not exceed 20 pages" },
          { category: "bonding", detail: "5% bid bond", kind: "mandatory", quote: "A bid bond of 5% of the proposed price is required" },
          { category: "insurance", detail: "$10M cyber cover", kind: "mandatory", quote: "cyber insurance of $10,000,000" },
        ],
      });
    const route = await import("@/app/api/rfps/[id]/extract/route");
    expect((await route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id))).status).toBe(200);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    const details = saved.extractedDetails as { category: string; page: number | null; verified: boolean }[];
    expect(details.map((d) => [d.category, d.page, d.verified])).toEqual([
      ["submission_deadline", 1, true],
      ["length_limit", 2, true],
      ["bonding", 2, true],
      ["insurance", null, false],
    ]);
    expect((saved.extractedFlags as string[]).some((flag) => /Key details: 1 could not be matched/.test(flag))).toBe(true);
    // Drafting sees them.
    const { buildDraftingContext } = await import("@/lib/rfp-draft");
    const context = buildDraftingContext({ companyName: "X", rfp: saved, libraryItems: [], sourceText: "" });
    expect(context).toContain("- Bonds and guarantees (mandatory): 5% bid bond [page 2]");
  });

  it("hidden instructions in an uploaded RFP never reach the model, and the user is told", async () => {
    const { INJECTION_FIXTURES, PAYLOAD_MARKER } = await import("../fixtures/injection");
    const llm = await import("../helpers/llm");
    const fake = await import("../helpers/fake-supabase");
    llm.resetLlm();
    const user = await createUser("inj", "starter");
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Inj", status: "uploaded" } });
    const path = `${user.id}/${rfp.id}/rfp.docx`;
    fake.files.set(path, await INJECTION_FIXTURES.find((f) => f.id === "docx-hidden")!.build());
    await testDb().rfp.update({ where: { id: rfp.id }, data: { originalFileUrl: fake.getRfpPublicUrl(path) } });
    h.clerkId = "inj";
    llm.script.json = () => goodJson();
    const route = await import("@/app/api/rfps/[id]/extract/route");
    expect((await route.POST(new Request("http://t/x", { method: "POST" }), ctx(rfp.id))).status).toBe(200);
    expect(llm.calls.map((call) => call.user + (call.context ?? "")).join("")).not.toContain(PAYLOAD_MARKER);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(saved.sourceText).not.toContain(PAYLOAD_MARKER);
    expect((saved.extractedFlags as string[]).some((flag) => flag.startsWith("Hidden text: 1 passage"))).toBe(true);
  });
});

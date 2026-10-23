import { describe, expect, it, vi } from "vitest";
import { hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeScannedPdf } from "../helpers/documents";
import { LIMITED_LIBRARY } from "../fixtures/rfps";

/**
 * The Phase 6 walkthrough as one test, through the real routes and actions:
 * sign up with Terms → free proposal → scanned PDF (OCR) → checklist → draft
 * with citations and gaps → Word and PDF export → plan limit → upgrade →
 * outcome → delete workspace. Only Clerk, file storage and the AI are fakes.
 */
const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () =>
    h.clerkId
      ? {
          primaryEmailAddress: { emailAddress: `${h.clerkId}@example.test` },
          emailAddresses: [{ emailAddress: `${h.clerkId}@example.test`, verification: { status: "verified" } }],
        }
      : null,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) => new Request("http://t/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
function upload(name: string, body: Buffer, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(body)], name, { type }));
  return new Request("http://t/api/rfps/upload", { method: "POST", body: form });
}

describe.skipIf(!hasTestDb)("main flow, end to end", () => {
  it("sign-up → scanned RFP → checklist → cited draft → export → limit → upgrade → outcome → delete", async () => {
    await resetDb();
    const fake = await import("../helpers/fake-supabase");
    fake.files.clear();
    const llm = await import("../helpers/llm");
    llm.resetLlm();
    h.clerkId = "founder-test";

    // 1. Sign up: the workspace needs the Terms accepted.
    const { completeOnboarding } = await import("@/lib/actions/onboarding");
    expect((await completeOnboarding({ agencyName: "Ridgeline IT Services LLC", teamSize: "1-10", acceptTerms: false })).ok).toBe(false);
    expect(
      (await completeOnboarding({ agencyName: "Ridgeline IT Services LLC", teamSize: "1-10", acceptTerms: true, segment: "it-services" })).ok,
    ).toBe(true);
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "founder-test" }, include: { subscription: true } });
    expect(user.termsAcceptedAt).not.toBeNull();
    expect(user.subscription).toMatchObject({ tier: "free", planVersion: "2026-10" });
    for (const item of LIBRARY_ITEMS) await testDb().libraryItem.create({ data: { ...item, userId: user.id } });

    // 2. The free proposal: a scanned PDF, read with OCR.
    const { POST: uploadRoute } = await import("@/app/api/rfps/upload/route");
    const res = await uploadRoute(upload("Fort Hollow scan.pdf", await makeScannedPdf(3), "application/pdf"));
    expect(res.status).toBe(200);
    const { id: rfpId } = await res.json();
    llm.script.pdf = () =>
      "=== PAGE ===\nCITY OF FORT HOLLOW Request for Proposals 2026-14: Managed IT Services for 85 users.\nProposals are due November 20, 2026 at 2:00 PM Eastern.\n=== PAGE ===\nBidders must hold a current Kentucky business license. Proposals shall not exceed 20 pages.";
    llm.script.json = (req) =>
      req.user.includes("bid plan") || req.user.includes("Return ONLY a JSON object (no code fences, no commentary) with exactly these keys")
        ? JSON.stringify(llm.SAMPLE_PLAN)
        : JSON.stringify({
            documentType: "public_tender",
            scope: "Managed IT services for the City of Fort Hollow, 85 users",
            deadline: "2026-11-20",
            eligibilityCriteria: ["Current Kentucky business license"],
            desirableCriteria: [],
            evaluationCriteria: ["Technical approach: 40 points"],
            submissionRequirements: ["Maximum 20 pages"],
            questionnaireItems: [],
            flaggedForReview: [],
            keyDetails: [{ category: "length_limit", detail: "Max 20 pages", kind: "mandatory", quote: "Proposals shall not exceed 20 pages" }],
          });
    const { POST: extract } = await import("@/app/api/rfps/[id]/extract/route");
    expect((await extract(new Request("http://t/x", { method: "POST" }), ctx(rfpId))).status).toBe(200);
    let rfp = await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } });
    expect(rfp.extractedDetails).toMatchObject([{ category: "length_limit", page: 2, verified: true }]);
    expect((rfp.extractedFlags as string[]).some((flag) => flag.startsWith("Scanned document"))).toBe(true);

    // 3. Checklist confirmed.
    const { confirmExtraction } = await import("@/lib/actions/rfp-extraction");
    const confirmed = await confirmExtraction({
      rfpId,
      documentType: "public_tender",
      scope: "Managed IT services for the City of Fort Hollow, 85 users",
      deadline: "2026-11-20",
      eligibilityCriteria: "Current Kentucky business license",
      desirableCriteria: "",
      evaluationCriteria: "Technical approach: 40 points",
      questionnaireItems: "",
      flaggedForReview: "",
      submissionRequirements: "Maximum 20 pages",
    });
    expect(confirmed.ok).toBe(true);

    // 4. Draft with citations and gaps.
    llm.script.stream = async function* (req) {
      if (req.user.includes("bid reviewer")) {
        yield "| Requirement | Type | Addressed in | Status | What to do |\n| --- | --- | --- | --- | --- |\n| Kentucky license | Mandatory | Team | Addressed | — |";
        return;
      }
      yield "We have supported Bluegrass Dental Group since 2021 [S2]. We hold ISO 27001 certification. Start date: [[Confirm: start date]].";
    };
    const { POST: draft } = await import("@/app/api/rfps/[id]/draft/route");
    const stream = await (await draft(json({}), ctx(rfpId))).text();
    expect(stream).toContain('"type":"done"');
    const exec = await testDb().draft.findFirstOrThrow({ where: { rfpId, sectionName: "exec_summary" } });
    expect(exec.citations).toMatchObject({ sources: { S2: { title: "Bluegrass Dental Group" } }, unsupported: ["We hold ISO 27001 certification."] });

    // 5. Export: clean Word copy, review copy with sources, and PDF.
    const { POST: exportRoute } = await import("@/app/api/rfps/[id]/export/route");
    const mammoth = await import("mammoth");
    const word = await exportRoute(new Request("http://t/x?format=docx", { method: "POST" }), ctx(rfpId));
    const wordText = (await mammoth.extractRawText({ buffer: Buffer.from(await word.arrayBuffer()) })).value;
    expect(wordText).toContain("Bluegrass Dental Group since 2021.");
    expect(wordText).not.toMatch(/\[S\d/);
    const review = await exportRoute(new Request("http://t/x?format=docx&variant=review", { method: "POST" }), ctx(rfpId));
    expect((await mammoth.extractRawText({ buffer: Buffer.from(await review.arrayBuffer()) })).value).toContain("Sources cited");
    const pdf = await exportRoute(new Request("http://t/x?format=pdf", { method: "POST" }), ctx(rfpId));
    expect(Buffer.from((await pdf.arrayBuffer()).slice(0, 4)).toString()).toBe("%PDF");
    rfp = await testDb().rfp.findUniqueOrThrow({ where: { id: rfpId } });
    expect(rfp.status).toBe("exported");

    // 6. The free trial is one proposal: a second upload is refused.
    const second = await uploadRoute(upload("Second.pdf", await makeScannedPdf(1), "application/pdf"));
    expect(second.status).toBe(403);

    // 7. Upgrade (an admin sets the plan while checkout is not live), then the next upload works.
    process.env.ADMIN_EMAILS = "admin@example.test";
    h.clerkId = "admin";
    const { adminSetPlan } = await import("@/lib/actions/admin");
    expect((await adminSetPlan(user.id, "starter")).ok).toBe(true);
    h.clerkId = "founder-test";
    expect((await uploadRoute(upload("Second.pdf", await makeScannedPdf(1), "application/pdf"))).status).toBe(200);

    // 8. Outcome logged.
    const { updateBidOutcome } = await import("@/lib/actions/outcomes");
    expect(
      await updateBidOutcome({ rfpId, submittedAt: "2026-10-20", outcome: "pending", contractValue: null, contractCurrency: null, notes: null, hoursSaved: "6" }),
    ).toEqual({ ok: true });

    const events = (await testDb().funnelEvent.findMany({ where: { userId: user.id } })).map((event) => event.event).sort();
    expect(events).toEqual(
      ["checklist_confirmed", "complete_signup", "first_draft", "first_export", "first_upload", "outcome_logged", "paid", "second_proposal"].sort(),
    );

    // 9. Delete the workspace: every row and file for this account is gone.
    const { deleteWorkspace } = await import("@/lib/actions/data-deletion");
    expect((await deleteWorkspace("DELETE")).ok).toBe(true);
    expect(await testDb().user.count({ where: { id: user.id } })).toBe(0);
    for (const count of [
      testDb().rfp.count({ where: { userId: user.id } }),
      testDb().draft.count({ where: { rfpId } }),
      testDb().libraryItem.count({ where: { userId: user.id } }),
      testDb().proposalUsage.count({ where: { userId: user.id } }),
      testDb().aiUsage.count({ where: { userId: user.id } }),
      testDb().funnelEvent.count({ where: { userId: user.id } }),
    ]) {
      expect(await count).toBe(0);
    }
    expect([...fake.files.keys()].filter((key) => key.startsWith(`${user.id}/`))).toEqual([]);
  }, 60_000);
});

const LIBRARY_ITEMS = LIMITED_LIBRARY;

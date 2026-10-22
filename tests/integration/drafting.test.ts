import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { FIXTURES, LIMITED_LIBRARY } from "../fixtures/rfps";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream };
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function readEvents(res: Response) {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((part) => part.startsWith("data:"))
    .map((part) => JSON.parse(part.slice(5)) as { type: string; section?: string; message?: string; content?: string });
}

async function setup(text: string, questions: string[] = []) {
  const llm = await import("../helpers/llm");
  llm.resetLlm();
  const user = await createUser("drafter", "starter");
  for (const item of LIMITED_LIBRARY) await testDb().libraryItem.create({ data: { ...item, userId: user.id } });
  const rfp = await testDb().rfp.create({
    data: {
      userId: user.id,
      title: "Fort Hollow Managed IT",
      status: "extracted",
      extractedDocumentType: "public_tender",
      extractedScope: "Managed IT for the City of Fort Hollow",
      extractedEligibility: ["Current SOC 2 Type II report", "Kentucky business license"],
      extractedQuestionnaire: questions,
      sourceText: text,
    },
  });
  h.clerkId = "drafter";
  const route = await import("@/app/api/rfps/[id]/draft/route");
  const run = (body: unknown = {}) =>
    route.POST(new Request("http://t/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), ctx(rfp.id));
  return { rfp, run, llm };
}

describe.skipIf(!hasTestDb)("drafting route", () => {
  beforeEach(resetDb);

  it("streams every section, saves them, and stores the compliance review", async () => {
    const { rfp, run, llm } = await setup(FIXTURES[0].text);
    const { SAMPLE_PLAN } = llm;
    llm.script.json = () => JSON.stringify(SAMPLE_PLAN);
    llm.script.stream = async function* (req) {
      if (req.user.includes("bid reviewer")) yield "| Requirement | Type | Addressed in | Status | What to do |\n| --- | --- | --- | --- | --- |\n| SOC 2 | Mandatory | — | Gap | Provide report |";
      else yield "We hold a current SOC 2 Type II report and ISO 27001 certification. Our Kentucky team supports 85 users.";
    };
    const events = await readEvents(await run());
    expect(events.at(-1)?.type).toBe("done");
    const drafts = await testDb().draft.findMany({ where: { rfpId: rfp.id } });
    expect(drafts.map((d) => d.sectionName).sort()).toEqual(["cover_letter", "exec_summary", "pricing", "team", "technical_approach"]);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(saved.status).toBe("drafted");
    expect(saved.coverageMap).toContain("Gap");
  });

  it("keeps finished sections when one section fails, and reports the failure", async () => {
    const { rfp, run, llm } = await setup(FIXTURES[0].text);
    llm.script.json = () => JSON.stringify(llm.SAMPLE_PLAN);
    llm.script.stream = async function* (req) {
      if (req.user.includes("PRICING")) throw new Error("upstream 500");
      yield "Section text for the City of Fort Hollow.";
    };
    const events = await readEvents(await run());
    expect(events.some((e) => e.type === "section_error" && e.section === "pricing")).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
    expect(await testDb().draft.count({ where: { rfpId: rfp.id } })).toBe(4);
  });

  it("refunds the full-draft allowance when nothing could be written", async () => {
    const { rfp, run, llm } = await setup(FIXTURES[0].text);
    llm.script.json = () => JSON.stringify(llm.SAMPLE_PLAN);
    llm.script.stream = async function* () {
      throw new Error("provider down");
    };
    const events = await readEvents(await run());
    expect(events.at(-1)?.type).toBe("error");
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect(saved.fullDraftCount).toBe(0);
  });

  it("answers every question of a 60-question questionnaire, in order", async () => {
    const qs = Array.from({ length: 60 }, (_, i) => `${i + 1}. Question number ${i + 1}?`);
    const { rfp, run, llm } = await setup("Security questionnaire", qs);
    await testDb().rfp.update({ where: { id: rfp.id }, data: { extractedDocumentType: "security_questionnaire" } });
    llm.script.json = () => JSON.stringify(llm.SAMPLE_PLAN);
    llm.script.stream = async function* (req) {
      const asked = [...req.user.matchAll(/^\d+\. (\d+\. Question number \d+\?)$/gm)].map((m) => m[1]);
      if (asked.length === 0) {
        yield "Narrative.";
        return;
      }
      for (const q of asked) yield `### ${q}\nYes.\n\n`;
    };
    await readEvents(await run());
    const responses = await testDb().draft.findFirstOrThrow({ where: { rfpId: rfp.id, sectionName: "responses" } });
    const answered = [...responses.content.matchAll(/### (\d+)\. Question/g)].map((m) => Number(m[1]));
    expect(answered).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
  });

  it("neutralises document text that tries to close the prompt's data blocks", async () => {
    const injection = FIXTURES.find((f) => f.id === "prompt-injection")!;
    const { run, llm } = await setup(injection.text);
    llm.script.json = () => JSON.stringify(llm.SAMPLE_PLAN);
    llm.script.stream = async function* () {
      yield "Text.";
    };
    await readEvents(await run());
    const context = llm.calls[0].context ?? "";
    // The only real closing tag is the one DraftBid AI writes itself.
    expect(context.match(/<\/original_document>/g)?.length).toBe(1);
    expect(context.match(/<content_library>/g)?.length).toBe(1);
  });
});

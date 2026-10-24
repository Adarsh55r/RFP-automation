import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";
import { makeQuestionnaireXlsx, readBack } from "../helpers/spreadsheets";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function uploadRequest(name: string, body: Buffer | Uint8Array, type: string) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(body)], name, { type }));
  return new Request("http://t/api/rfps/upload", { method: "POST", body: form });
}

const extraction = JSON.stringify({
  documentType: "security_questionnaire",
  scope: "Vendor security assessment for the City of Fort Hollow",
  deadline: "2026-11-20",
  eligibilityCriteria: [],
  desirableCriteria: [],
  evaluationCriteria: [],
  submissionRequirements: ["Return the completed questionnaire"],
  // The model's own question list is replaced by the sheet's rows.
  questionnaireItems: ["Something the model paraphrased"],
  flaggedForReview: [],
});

describe.skipIf(!hasTestDb)("spreadsheet questionnaires", () => {
  beforeEach(async () => {
    await resetDb();
    (await import("../helpers/fake-supabase")).files.clear();
    (await import("../helpers/llm")).resetLlm();
    await createUser("sheet", "starter");
    h.clerkId = "sheet";
  });

  async function uploadAndExtract(name = "Security Questionnaire.xlsx", bytes?: Buffer, type = XLSX_TYPE) {
    const { POST: upload } = await import("@/app/api/rfps/upload/route");
    const res = await upload(uploadRequest(name, bytes ?? (await makeQuestionnaireXlsx()), type));
    expect(res.status).toBe(200);
    const { id } = await res.json();
    const llm = await import("../helpers/llm");
    llm.script.json = () => extraction;
    const { POST: extract } = await import("@/app/api/rfps/[id]/extract/route");
    expect((await extract(new Request("http://t/x", { method: "POST" }), ctx(id))).status).toBe(200);
    return { id, llm };
  }

  it("upload → questions from the sheet's rows → answers written back into the buyer's workbook", async () => {
    const { id, llm } = await uploadAndExtract();
    // The extraction model saw the cells as text.
    expect(llm.calls[0].user + (llm.calls[0].context ?? "")).toContain("Row 5: A: AC-1 | B: Do you enforce multi-factor");

    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id } });
    expect(rfp.extractedQuestionnaire).toEqual([
      "AC-1 Do you enforce multi-factor authentication for all administrative access?",
      "AC-2 Describe how user access is reviewed and how often.",
      "DP-1 Is customer data encrypted at rest? State the algorithm & key length (e.g. <AES-256>).",
    ]);
    expect(rfp.questionnaireMap).toMatchObject({ sheet: "Questionnaire", questionColumn: "B", answerColumn: "C", idColumn: "A" });
    expect((rfp.extractedFlags as string[]).some((flag) => flag.startsWith("Spreadsheet: 3 questions found"))).toBe(true);

    await testDb().draft.create({
      data: {
        rfpId: id,
        sectionName: "responses",
        content: [
          "### AC-1 Do you enforce multi-factor authentication for all administrative access?",
          "**Yes.** MFA is enforced for every admin account [S2].",
          "",
          "### DP-1 Is customer data encrypted at rest? State the algorithm & key length (e.g. <AES-256>).",
          "Yes, with [[Confirm: key length]] keys.",
        ].join("\n"),
      },
    });
    await testDb().rfp.update({ where: { id }, data: { status: "drafted" } });

    const { POST: exportRoute } = await import("@/app/api/rfps/[id]/export/route");
    const res = await exportRoute(new Request("http://t/x?format=sheet", { method: "POST" }), ctx(id));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("-answered.xlsx");
    expect(res.headers.get("X-Unanswered-Rows")).toBe("1");
    const workbook = await readBack(new Uint8Array(await res.arrayBuffer()));
    const sheet = workbook.getWorksheet("Questionnaire")!;
    expect(sheet.getCell("C5").value).toBe("Yes. MFA is enforced for every admin account.");
    expect(sheet.getCell("C8").value).toBe("Yes, with [Confirm: key length] keys.");
    expect(sheet.getCell("C6").value).toBeNull();
    expect(sheet.getCell("C5").dataValidation?.type).toBe("list");
    expect((await testDb().rfp.findUniqueOrThrow({ where: { id } })).status).toBe("exported");
  });

  it("the user can point the questions and answers at other columns", async () => {
    const { id } = await uploadAndExtract();
    const { updateSpreadsheetColumns } = await import("@/lib/actions/questionnaire");

    expect((await updateSpreadsheetColumns({ rfpId: id, sheet: "Questionnaire", questionColumn: "B", answerColumn: "B", idColumn: null, headerRow: 3 })).ok).toBe(false);

    const result = await updateSpreadsheetColumns({ rfpId: id, sheet: "Questionnaire", questionColumn: "B", answerColumn: "D", idColumn: null, headerRow: 3 });
    expect(result).toEqual({ ok: true, questions: 3 });
    const rfp = await testDb().rfp.findUniqueOrThrow({ where: { id } });
    expect(rfp.questionnaireMap).toMatchObject({ answerColumn: "D", idColumn: null });
    expect((rfp.extractedQuestionnaire as string[])[0]).toBe("Do you enforce multi-factor authentication for all administrative access?");

    // Another account cannot change it.
    await createUser("other");
    h.clerkId = "other";
    expect((await updateSpreadsheetColumns({ rfpId: id, sheet: "Questionnaire", questionColumn: "B", answerColumn: "C", idColumn: null, headerRow: 3 })).ok).toBe(false);
  });

  it("CSV questionnaires work the same way", async () => {
    const csv = Buffer.from("ID,Question,Response\nQ1,Do you hold cyber liability insurance?,\nQ2,Describe your data backup policy and frequency.,\n");
    const { id } = await uploadAndExtract("questions.csv", csv, "text/csv");
    await testDb().draft.create({
      data: { rfpId: id, sectionName: "responses", content: "### Q2 Describe your data backup policy and frequency.\nDaily backups, kept for 30 days." },
    });
    await testDb().rfp.update({ where: { id }, data: { status: "drafted" } });
    const { POST: exportRoute } = await import("@/app/api/rfps/[id]/export/route");
    const res = await exportRoute(new Request("http://t/x?format=sheet", { method: "POST" }), ctx(id));
    expect(res.status).toBe(200);
    const text = (await res.text()).replace(/^﻿/, "");
    expect(text).toContain("Q2,Describe your data backup policy and frequency.,\"Daily backups, kept for 30 days.\"");
  });

  it("refuses macro-enabled workbooks and files that are not what their name says", async () => {
    const { POST: upload } = await import("@/app/api/rfps/upload/route");
    const zip = await JSZip.loadAsync(await makeQuestionnaireXlsx());
    zip.file("xl/vbaProject.bin", "macro");
    const macro = await upload(uploadRequest("q.xlsx", await zip.generateAsync({ type: "uint8array" }), XLSX_TYPE));
    expect(macro.status).toBe(400);
    expect((await macro.json()).error).toMatch(/macros/);
    expect((await upload(uploadRequest("q.csv", Buffer.from("MZ\x90\x00\x00binary"), "text/csv"))).status).toBe(400);
    expect((await upload(uploadRequest("q.xlsx", Buffer.from("%PDF-1.7"), XLSX_TYPE))).status).toBe(400);
    expect(await testDb().rfp.count()).toBe(0);
  });

  it("a normal RFP cannot be exported as a spreadsheet", async () => {
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "sheet" } });
    const rfp = await testDb().rfp.create({ data: { userId: user.id, title: "Doc", status: "drafted" } });
    const { POST: exportRoute } = await import("@/app/api/rfps/[id]/export/route");
    expect((await exportRoute(new Request("http://t/x?format=sheet", { method: "POST" }), ctx(rfp.id))).status).toBe(400);
  });
});

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  answerCellText,
  csvToSheet,
  detectQuestionnaire,
  matchAnswers,
  parseCsv,
  questionLabel,
  readXlsx,
  writeAnswersToCsv,
  writeAnswersToXlsx,
  writeCells,
} from "@/lib/spreadsheet";
import { DocumentReadError } from "@/lib/document-safety";
import { makeQuestionnaireXlsx, readBack } from "../helpers/spreadsheets";

const SOFFICE = ["/usr/bin/soffice", "/usr/bin/libreoffice"].find((path) => existsSync(path));

describe("reading a questionnaire workbook", () => {
  it("finds the questions sheet, its header, question, ID and answer columns, and skips section headings", async () => {
    const sheets = await readXlsx(await makeQuestionnaireXlsx());
    expect(sheets.map((s) => s.name)).toEqual(["Instructions", "Questionnaire"]);
    const map = detectQuestionnaire(sheets, "xlsx")!;
    expect(map).toMatchObject({ sheet: "Questionnaire", headerRow: 3, idColumn: "A", questionColumn: "B", answerColumn: "C" });
    expect(map.rows.map((r) => [r.row, r.id])).toEqual([
      [5, "AC-1"],
      [6, "AC-2"],
      [8, "DP-1"],
    ]);
    expect(map.rows[2].question).toBe("Is customer data encrypted at rest? State the algorithm & key length (e.g. <AES-256>).");
    expect(questionLabel(map.rows[0])).toBe("AC-1 Do you enforce multi-factor authentication for all administrative access?");
  });

  it("refuses macro-enabled workbooks", async () => {
    const zip = await JSZip.loadAsync(await makeQuestionnaireXlsx());
    zip.file("xl/vbaProject.bin", "macro");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    await expect(readXlsx(bytes)).rejects.toBeInstanceOf(DocumentReadError);
  });

  it("without a header row, uses the longest text column and the next empty column", () => {
    const sheet = csvToSheet("1,Describe your onboarding process for new clients.\n2,How do you handle after-hours incidents?\n");
    const map = detectQuestionnaire([sheet], "csv")!;
    expect(map).toMatchObject({ headerRow: null, questionColumn: "B", answerColumn: "C" });
    expect(map.rows).toHaveLength(2);
  });
});

describe("matching drafted answers to rows", () => {
  const rows = [
    { row: 5, id: "AC-1", question: "Do you enforce multi-factor authentication for all administrative access?" },
    { row: 6, id: "AC-2", question: "Describe how user access is reviewed and how often." },
    { row: 8, id: "DP-1", question: "Is customer data encrypted at rest?" },
  ];

  it("matches by question text even when answers come back in a different order, and leaves unanswered rows empty", () => {
    const answers = matchAnswers(
      rows,
      [
        "### AC-2 Describe how user access is reviewed and how often.",
        "**Quarterly.** Access is reviewed by the IT lead [S3].",
        "",
        "### AC-1 Do you enforce multi-factor authentication for all administrative access?",
        "Yes. All admin accounts use MFA:",
        "- Microsoft Entra ID",
        "- Hardware keys for domain admins",
      ].join("\n"),
    );
    expect(answers.get(5)).toBe("Yes. All admin accounts use MFA:\n• Microsoft Entra ID\n• Hardware keys for domain admins");
    expect(answers.get(6)).toBe("Quarterly. Access is reviewed by the IT lead.");
    expect(answers.has(8)).toBe(false);
  });

  it("keeps gaps visible in the cell text", () => {
    expect(answerCellText("Yes, with [[Confirm: key length]] keys [S2].")).toBe("Yes, with [Confirm: key length] keys.");
  });
});

describe("writing answers back into the buyer's workbook", () => {
  it("fills only the answer cells and keeps everything else (other sheets, styles, dropdown, formula)", async () => {
    const original = await makeQuestionnaireXlsx();
    const map = detectQuestionnaire(await readXlsx(original), "xlsx")!;
    const { bytes, skipped } = await writeAnswersToXlsx(
      original,
      map,
      new Map([
        [5, "Yes. MFA is enforced for all admin access."],
        [8, "Yes: AES-256 & TLS 1.2+ <in transit>."],
      ]),
    );
    expect(skipped).toEqual([]);

    const workbook = await readBack(bytes);
    const sheet = workbook.getWorksheet("Questionnaire")!;
    expect(sheet.getCell("C5").value).toBe("Yes. MFA is enforced for all admin access.");
    expect(sheet.getCell("C8").value).toBe("Yes: AES-256 & TLS 1.2+ <in transit>.");
    expect(sheet.getCell("C6").value).toBeNull();
    expect(sheet.getCell("C3").value).toBe("Vendor Response");
    expect(sheet.getCell("B5").value).toBe("Do you enforce multi-factor authentication for all administrative access?");
    // The buyer's formatting, dropdown and formula survive.
    expect((sheet.getCell("C5").fill as { fgColor?: { argb?: string } }).fgColor?.argb).toBe("FFFFF2CC");
    expect(sheet.getCell("C5").dataValidation?.type).toBe("list");
    expect(sheet.getCell("A1").font?.bold).toBe(true);
    expect((sheet.getCell("E1").value as { formula?: string }).formula).toBe("COUNTA(A5:A8)");
    expect(workbook.getWorksheet("Instructions")!.getCell("A1").value).toMatch(/Complete every question/);
  });

  it("adds a Response column title when the answer column had none, and never overwrites a formula", () => {
    const xml =
      '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Question</t></is></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>Q?</t></is></c><c r="B2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>';
    const { xml: out, skipped } = writeCells(xml, new Map([["B1", "Response"], ["B2", "x"], ["B4", "new row"]]));
    expect(skipped).toEqual(["B2"]);
    expect(out).toContain('<c r="B1" t="inlineStr"><is><t xml:space="preserve">Response</t></is></c>');
    expect(out).toMatch(/<row r="2">.*<f>1\+1<\/f>/);
    expect(out).toContain('<row r="4"><c r="B4"');
  });

  it.skipIf(!SOFFICE)("LibreOffice opens the filled workbook and reads the answers", async () => {
    const original = await makeQuestionnaireXlsx();
    const map = detectQuestionnaire(await readXlsx(original), "xlsx")!;
    const { bytes } = await writeAnswersToXlsx(original, map, new Map([[5, "Yes, MFA everywhere."]]));
    const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
    try {
      writeFileSync(join(dir, "filled.xlsx"), bytes);
      execFileSync(SOFFICE!, ["--headless", "--convert-to", "csv:Text - txt - csv (StarCalc):44,34,76,1,,0,false,true,false,false,false,2", "--outdir", dir, join(dir, "filled.xlsx")], {
        timeout: 90_000,
        stdio: "ignore",
        env: { ...process.env, HOME: dir },
      });
      const csv = readFileSync(join(dir, "filled-Questionnaire.csv"), "utf8");
      expect(csv).toContain("Yes, MFA everywhere.");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe("CSV questionnaires", () => {
  it("parses quoted fields, semicolons and embedded newlines", () => {
    expect(parseCsv('a;"b; ""quoted""\nline";c\r\n1;2;3')).toEqual([
      ["a", 'b; "quoted"\nline', "c"],
      ["1", "2", "3"],
    ]);
  });

  it("writes answers into the answer column and keeps every other cell", () => {
    const csv = "ID,Question,Response\nQ1,Do you hold cyber insurance?,\nQ2,\"Describe your backup policy, including frequency.\",\n";
    const map = detectQuestionnaire([csvToSheet(csv)], "csv")!;
    expect(map).toMatchObject({ questionColumn: "B", answerColumn: "C", idColumn: "A" });
    const out = writeAnswersToCsv(csv, map, new Map([[3, 'Daily, with "immutable" copies.\nTested monthly.']]));
    expect(parseCsv(out.replace(/^﻿/, "")).slice(0, 3)).toEqual([
      ["ID", "Question", "Response"],
      ["Q1", "Do you hold cyber insurance?", ""],
      ["Q2", "Describe your backup policy, including frequency.", 'Daily, with "immutable" copies.\nTested monthly.'],
    ]);
  });
});

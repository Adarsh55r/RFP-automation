import JSZip from "jszip";
import { assertSafeZipDocument, DocumentReadError } from "@/lib/document-safety";
import { stripCitations } from "@/lib/citations";
import { markdownToPlainText } from "@/lib/markdown";

/**
 * Spreadsheet questionnaires (.xlsx and .csv). A workbook is read straight
 * from its XML; answers are written back by patching only the answer cells,
 * so the buyer's formatting, validation, other sheets and formulas are kept
 * exactly as they sent them. Nothing in the file is ever executed.
 */

export type SpreadsheetFormat = "xlsx" | "csv";

export type Sheet = {
  name: string;
  /** Path of the sheet XML inside the workbook (xlsx only). */
  path: string | null;
  /** Row number (1-based) → column letter → cell text. */
  rows: Map<number, Map<string, string>>;
};

export type QuestionnaireRow = { row: number; id: string | null; question: string };

export type QuestionnaireMap = {
  format: SpreadsheetFormat;
  sheet: string;
  /** Row holding the column titles, or null if the sheet has none. */
  headerRow: number | null;
  questionColumn: string;
  answerColumn: string;
  idColumn: string | null;
  rows: QuestionnaireRow[];
  /** Every sheet's columns with their titles, so the user can correct the mapping without re-reading the file. */
  sheets?: SheetSummary[];
};

export type SheetSummary = {
  name: string;
  headerRow: number | null;
  columns: { letter: string; title: string }[];
};

/** Most questions answered from one sheet; more are flagged rather than drafted. */
export const MAX_SHEET_QUESTIONS = 400;
/** Excel's limit for the text in one cell. */
const MAX_CELL_CHARS = 32_000;

export function spreadsheetFormat(fileName: string): SpreadsheetFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}

// ---------- columns ----------

export function columnIndex(letters: string) {
  let index = 0;
  for (const char of letters.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index;
}

export function columnLetters(index: number) {
  let letters = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  return letters;
}

function splitRef(ref: string) {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  return match ? { column: match[1].toUpperCase(), row: Number(match[2]) } : null;
}

// ---------- XML helpers ----------

function decodeXml(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(text: string) {
  return (
    text
      // Characters XML 1.0 does not allow at all.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? decodeXml(match[1]) : null;
}

/** Text of every <t> run in a string item or inline string, skipping phonetic hints. */
function runText(xml: string) {
  const withoutPhonetic = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
  let text = "";
  for (const match of withoutPhonetic.matchAll(/<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g)) {
    text += decodeXml(match[1] ?? "");
  }
  return text;
}

const ROW_RE = /<((?:\w+:)?)row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1row>)/g;
const CELL_RE = /<((?:\w+:)?)c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1c>)/g;

// ---------- reading ----------

async function loadZip(bytes: Uint8Array) {
  assertSafeZipDocument(bytes);
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new DocumentReadError("damaged");
  }
}

function resolveTarget(target: string) {
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target.replace(/^\.\//, "")}`;
}

export async function readXlsx(bytes: Uint8Array): Promise<Sheet[]> {
  const zip = await loadZip(bytes);
  const workbook = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbook || !rels) throw new DocumentReadError("damaged");

  const targets = new Map<string, string>();
  let sharedPath = "xl/sharedStrings.xml";
  for (const match of rels.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)) {
    const id = attribute(match[0], "Id");
    const target = attribute(match[0], "Target");
    if (!id || !target) continue;
    targets.set(id, resolveTarget(target));
    if (/\/sharedStrings$/.test(attribute(match[0], "Type") ?? "")) sharedPath = resolveTarget(target);
  }

  const shared: string[] = [];
  const sharedXml = await zip.file(sharedPath)?.async("string");
  for (const match of (sharedXml ?? "").matchAll(/<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g)) {
    shared.push(runText(match[1] ?? ""));
  }

  const sheets: Sheet[] = [];
  for (const match of workbook.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = attribute(match[0], "name") ?? `Sheet${sheets.length + 1}`;
    const relId = attribute(match[0], "r:id") ?? attribute(match[0], "relationships:id");
    const path = relId ? targets.get(relId) : undefined;
    const xml = path ? await zip.file(path)?.async("string") : undefined;
    if (!path || !xml) continue;
    sheets.push({ name, path, rows: parseSheetRows(xml, shared) });
  }
  return sheets;
}

function parseSheetRows(xml: string, shared: string[]) {
  const rows = new Map<number, Map<string, string>>();
  let rowNumber = 0;
  for (const rowMatch of xml.matchAll(ROW_RE)) {
    rowNumber = Number(attribute(rowMatch[0], "r") ?? rowNumber + 1);
    const cells = new Map<string, string>();
    let columnNumber = 0;
    for (const cellMatch of (rowMatch[3] ?? "").matchAll(CELL_RE)) {
      const ref = splitRef(attribute(cellMatch[0], "r") ?? "");
      columnNumber = ref ? columnIndex(ref.column) : columnNumber + 1;
      const type = attribute(cellMatch[0], "t");
      const inner = cellMatch[3] ?? "";
      const value = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1];
      let text = "";
      if (type === "s") text = shared[Number(value)] ?? "";
      else if (type === "inlineStr") text = runText(inner);
      else if (type === "b") text = value === "1" ? "TRUE" : "FALSE";
      else if (value !== undefined) text = decodeXml(value);
      text = text.trim();
      if (text) cells.set(columnLetters(columnNumber), text);
    }
    if (cells.size > 0) rows.set(rowNumber, cells);
  }
  return rows;
}

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function quoteCsv(value: string) {
  return /[",\n\r;\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function csvToSheet(text: string): Sheet {
  const rows = new Map<number, Map<string, string>>();
  parseCsv(text).forEach((cells, index) => {
    const map = new Map<string, string>();
    cells.forEach((cell, column) => {
      if (cell.trim()) map.set(columnLetters(column + 1), cell.trim());
    });
    if (map.size > 0) rows.set(index + 1, map);
  });
  return { name: "CSV", path: null, rows };
}

export async function readSpreadsheet(bytes: Uint8Array, format: SpreadsheetFormat): Promise<Sheet[]> {
  if (format === "csv") return [csvToSheet(new TextDecoder().decode(bytes))];
  return readXlsx(bytes);
}

/** The spreadsheet as text for requirement extraction (scope, deadline, instructions). */
export function sheetsToText(sheets: Sheet[]) {
  return sheets
    .map((sheet) => {
      const lines = [...sheet.rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([row, cells]) => `Row ${row}: ${[...cells.entries()].map(([column, text]) => `${column}: ${text}`).join(" | ")}`);
      return `## Sheet: ${sheet.name}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

// ---------- finding the questions ----------

const QUESTION_HEADER = /question|requirement|description|criteri|control|query|specification|clause|item/i;
const PREFERRED_QUESTION_HEADER = /question|requirement/i;
const ANSWER_HEADER = /answer|response|reply|comment|vendor|supplier|bidder|tenderer|respondent|explanation|evidence|compl/i;
const PREFERRED_ANSWER_HEADER = /answer|response/i;
const ID_HEADER = /^(#|no\.?|nr\.?|id|ref\.?|reference|number|item\s*(no\.?|#)?|q\s*(no\.?|#)?|question\s*(no\.?|number|id|ref))$/i;

function columnsOf(sheet: Sheet) {
  const columns = new Set<string>();
  for (const cells of sheet.rows.values()) for (const column of cells.keys()) columns.add(column);
  return [...columns].sort((a, b) => columnIndex(a) - columnIndex(b));
}

function findHeaderRow(sheet: Sheet) {
  let best: { row: number; score: number } | null = null;
  for (const [row, cells] of [...sheet.rows.entries()].sort((a, b) => a[0] - b[0]).slice(0, 15)) {
    const values = [...cells.values()];
    if (!values.some((value) => QUESTION_HEADER.test(value) && value.length <= 60)) continue;
    const score = values.filter((value) => value.length <= 60).length + (values.some((v) => ANSWER_HEADER.test(v)) ? 2 : 0);
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

/** Rows of a sheet that hold questions, given the question (and optional ID) column. */
export function questionRows(sheet: Sheet, map: Pick<QuestionnaireMap, "headerRow" | "questionColumn" | "idColumn">) {
  const rows: QuestionnaireRow[] = [];
  for (const [row, cells] of [...sheet.rows.entries()].sort((a, b) => a[0] - b[0])) {
    if (map.headerRow !== null && row <= map.headerRow) continue;
    const question = cells.get(map.questionColumn)?.replace(/\s+/g, " ").trim() ?? "";
    if (!/[a-z]/i.test(question) || question.length < 8) continue;
    const id = map.idColumn ? cells.get(map.idColumn)?.trim() || null : null;
    // With an ID column, rows without an ID are section headings; without one, short titles
    // ("Data protection") are, unless they end in a question mark.
    if (map.idColumn ? !id : question.split(/\s+/).length < 4 && !question.endsWith("?")) continue;
    rows.push({ row, id, question });
  }
  return rows;
}

function averageLength(sheet: Sheet, column: string, afterRow: number | null) {
  const values = [...sheet.rows.entries()]
    .filter(([row]) => afterRow === null || row > afterRow)
    .map(([, cells]) => cells.get(column) ?? "")
    .filter(Boolean);
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value.length, 0) / values.length;
}

function isEmptyBelow(sheet: Sheet, column: string, afterRow: number | null) {
  return [...sheet.rows.entries()].every(([row, cells]) => (afterRow !== null && row <= afterRow) || !cells.get(column));
}

/** Best guess at where the questions are and where answers go, for one sheet. */
export function detectSheetMap(sheet: Sheet, format: SpreadsheetFormat): QuestionnaireMap | null {
  const columns = columnsOf(sheet);
  if (columns.length === 0) return null;
  const headerRow = findHeaderRow(sheet);
  const header = headerRow !== null ? sheet.rows.get(headerRow) ?? new Map<string, string>() : new Map<string, string>();
  const titled = (pattern: RegExp) => columns.filter((column) => pattern.test(header.get(column) ?? ""));

  const byLength = (candidates: string[]) =>
    [...candidates].sort((a, b) => averageLength(sheet, b, headerRow) - averageLength(sheet, a, headerRow))[0];
  const questionColumn =
    titled(PREFERRED_QUESTION_HEADER)[0] ??
    byLength(titled(QUESTION_HEADER).filter((c) => !ANSWER_HEADER.test(header.get(c) ?? ""))) ??
    byLength(columns);
  if (!questionColumn) return null;

  const idColumn =
    columns.find((column) => column !== questionColumn && ID_HEADER.test(header.get(column) ?? "")) ?? null;
  const answerCandidates = titled(ANSWER_HEADER).filter((c) => c !== questionColumn && c !== idColumn);
  const answerColumn =
    answerCandidates.find((c) => PREFERRED_ANSWER_HEADER.test(header.get(c) ?? "")) ??
    answerCandidates[0] ??
    columns.find((c) => columnIndex(c) > columnIndex(questionColumn) && isEmptyBelow(sheet, c, headerRow)) ??
    columnLetters(columnIndex(columns[columns.length - 1]) + 1);

  const map = { format, sheet: sheet.name, headerRow, questionColumn, answerColumn, idColumn };
  return { ...map, rows: questionRows(sheet, map) };
}

/** The sheet with the most questions, and where its answers go. */
export function detectQuestionnaire(sheets: Sheet[], format: SpreadsheetFormat) {
  const maps = sheets.map((sheet) => detectSheetMap(sheet, format)).filter((map): map is QuestionnaireMap => Boolean(map));
  return maps.sort((a, b) => b.rows.length - a.rows.length)[0] ?? null;
}

/** The question text the drafting prompt and the answer matching both use. */
export function questionLabel(row: QuestionnaireRow) {
  return row.id && !row.question.startsWith(row.id) ? `${row.id} ${row.question}` : row.question;
}

// ---------- matching answers ----------

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Splits the drafted "Questionnaire responses" section into question → answer blocks. */
export function responseBlocks(markdown: string) {
  const blocks: { heading: string; body: string }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of markdown.split("\n")) {
    const heading = /^#{2,4}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      if (current) blocks.push({ heading: current.heading, body: current.lines.join("\n").trim() });
      current = { heading: heading[1], lines: [] };
    } else current?.lines.push(line);
  }
  if (current) blocks.push({ heading: current.heading, body: current.lines.join("\n").trim() });
  return blocks;
}

/** Plain text for a spreadsheet cell: no markup, no citation markers, gaps kept visible. */
export function answerCellText(markdown: string) {
  const text = markdownToPlainText(stripCitations(markdown)).trim();
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text;
}

/** Row → answer text, matching each row to the drafted answer for its question. */
export function matchAnswers(rows: QuestionnaireRow[], responsesMarkdown: string) {
  const blocks = responseBlocks(responsesMarkdown).filter((block) => block.body);
  const used = new Set<number>();
  const answers = new Map<number, string>();
  const find = (row: QuestionnaireRow) => {
    const label = normalize(questionLabel(row));
    const question = normalize(row.question);
    const prefix = question.slice(0, 60);
    const tests = [
      (h: string) => h === label || h === question,
      (h: string) => h.endsWith(question) || h.includes(prefix),
      (h: string) => prefix.length >= 20 && question.includes(h.slice(0, 40)),
    ];
    for (const test of tests) {
      const index = blocks.findIndex((block, i) => !used.has(i) && test(normalize(block.heading)));
      if (index >= 0) return index;
    }
    return -1;
  };
  for (const row of rows) {
    const index = find(row);
    if (index < 0) continue;
    used.add(index);
    answers.set(row.row, answerCellText(blocks[index].body));
  }
  // The same number of answers as questions, none matched by text: they are in order.
  if (answers.size === 0 && blocks.length === rows.length) {
    rows.forEach((row, index) => answers.set(row.row, answerCellText(blocks[index].body)));
  }
  return answers;
}

// ---------- writing ----------

function inlineStringCell(prefix: string, ref: string, style: string | null, text: string) {
  return `<${prefix}c r="${ref}"${style ? ` s="${style}"` : ""} t="inlineStr"><${prefix}is><${prefix}t xml:space="preserve">${escapeXml(text)}</${prefix}t></${prefix}is></${prefix}c>`;
}

/** Writes text into cells of one sheet's XML, keeping each cell's style. Formula cells are never overwritten. */
export function writeCells(xml: string, cells: Map<string, string>) {
  const skipped: string[] = [];
  const byRow = new Map<number, [string, string][]>();
  for (const [ref, text] of cells) {
    const parsed = splitRef(ref);
    if (!parsed) continue;
    byRow.set(parsed.row, [...(byRow.get(parsed.row) ?? []), [parsed.column, text]]);
  }

  const sheetData = /<((?:\w+:)?)sheetData\b[^>]*?(?:\/>|>([\s\S]*?)<\/\1sheetData>)/.exec(xml);
  if (!sheetData) throw new DocumentReadError("damaged");
  const prefix = sheetData[1];
  let body = sheetData[2] ?? "";

  for (const [rowNumber, rowCells] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const rowRe = new RegExp(`<(${prefix})row\\b([^>]*?\\sr="${rowNumber}"[^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/\\1row>)`);
    const existing = rowRe.exec(body);
    let content = existing?.[3] ?? "";
    for (const [column, text] of rowCells.sort((a, b) => columnIndex(a[0]) - columnIndex(b[0]))) {
      const ref = `${column}${rowNumber}`;
      const cellRe = new RegExp(`<${prefix}c\\b[^>]*?\\sr="${ref}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/${prefix}c>)`);
      const cell = cellRe.exec(content);
      if (cell) {
        if (/<(?:\w+:)?f\b/.test(cell[0])) {
          skipped.push(ref);
          continue;
        }
        content = content.replace(cell[0], inlineStringCell(prefix, ref, attribute(cell[0], "s"), text));
        continue;
      }
      // Insert in column order.
      const next = [...content.matchAll(new RegExp(`<${prefix}c\\b[^>]*?\\sr="([A-Z]+)\\d+"`, "g"))].find(
        (match) => columnIndex(match[1]) > columnIndex(column),
      );
      const newCell = inlineStringCell(prefix, ref, null, text);
      content =
        next?.index !== undefined ? content.slice(0, next.index) + newCell + content.slice(next.index) : content + newCell;
    }
    if (existing) {
      body = body.replace(existing[0], `<${prefix}row${existing[2]}>${content}</${prefix}row>`);
    } else {
      const later = [...body.matchAll(new RegExp(`<${prefix}row\\b[^>]*?\\sr="(\\d+)"`, "g"))].find(
        (match) => Number(match[1]) > rowNumber,
      );
      const newRow = `<${prefix}row r="${rowNumber}">${content}</${prefix}row>`;
      body = later?.index !== undefined ? body.slice(0, later.index) + newRow + body.slice(later.index) : body + newRow;
    }
  }

  const replaced = `<${prefix}sheetData>${body}</${prefix}sheetData>`;
  // The <dimension> hint would now be too small; Excel and LibreOffice recompute it when it is absent.
  const out = xml
    .replace(sheetData[0], replaced)
    .replace(/<(?:\w+:)?dimension\b[^>]*\/>/, "");
  return { xml: out, skipped };
}

/** The original workbook with answers (and an answer column title, if it had none) written in. */
export async function writeAnswersToXlsx(bytes: Uint8Array, map: QuestionnaireMap, answers: Map<number, string>) {
  const zip = await loadZip(bytes);
  const sheets = await readXlsx(bytes);
  const sheet = sheets.find((item) => item.name === map.sheet);
  if (!sheet?.path) throw new DocumentReadError("damaged");
  const xml = await zip.file(sheet.path)!.async("string");

  const cells = new Map<string, string>();
  if (map.headerRow !== null && !sheet.rows.get(map.headerRow)?.get(map.answerColumn)) {
    cells.set(`${map.answerColumn}${map.headerRow}`, "Response");
  }
  for (const [row, text] of answers) cells.set(`${map.answerColumn}${row}`, text);

  const written = writeCells(xml, cells);
  zip.file(sheet.path, written.xml);
  const out = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes: out, skipped: written.skipped };
}

export function writeAnswersToCsv(text: string, map: QuestionnaireMap, answers: Map<number, string>) {
  const rows = parseCsv(text);
  const answerIndex = columnIndex(map.answerColumn) - 1;
  const width = Math.max(answerIndex + 1, ...rows.map((row) => row.length));
  const out = rows.map((cells, index) => {
    const row = [...cells, ...new Array(Math.max(0, width - cells.length)).fill("")];
    const rowNumber = index + 1;
    if (map.headerRow === rowNumber && !row[answerIndex]) row[answerIndex] = "Response";
    const answer = answers.get(rowNumber);
    if (answer !== undefined) row[answerIndex] = answer;
    return row.map(quoteCsv).join(",");
  });
  // A byte-order mark so Excel opens UTF-8 text correctly.
  return `﻿${out.join("\r\n")}\r\n`;
}

/**
 * Questions to draft from a mapped sheet, plus review flags. Capped so a huge
 * sheet cannot run up drafting cost; the user is told what was left out.
 */
export function sheetQuestions(map: QuestionnaireMap | null) {
  if (!map || map.rows.length === 0) {
    return {
      map: null,
      questions: null,
      flags: [
        "Spreadsheet: no question rows were found automatically. Check the questions below, or set the question and answer columns under Spreadsheet columns.",
      ],
    };
  }
  const kept = { ...map, rows: map.rows.slice(0, MAX_SHEET_QUESTIONS) };
  const header = map.headerRow !== null ? ` under the titles in row ${map.headerRow}` : "";
  const flags = [
    `Spreadsheet: ${kept.rows.length} questions found in sheet "${map.sheet}", column ${map.questionColumn}${header}; answers will be written to column ${map.answerColumn}. Check this under Spreadsheet columns before drafting.`,
  ];
  if (map.rows.length > MAX_SHEET_QUESTIONS) {
    flags.push(
      `Spreadsheet: only the first ${MAX_SHEET_QUESTIONS} of ${map.rows.length} questions will be drafted. Split the sheet and upload the rest as a second RFP.`,
    );
  }
  return { map: kept, questions: kept.rows.map(questionLabel), flags };
}

/** Column choices for each sheet: its existing columns plus one empty column for answers. */
export function summarizeSheets(sheets: Sheet[]): SheetSummary[] {
  return sheets.map((sheet) => {
    const headerRow = findHeaderRow(sheet);
    const columns = columnsOf(sheet);
    const first = (column: string) =>
      [...sheet.rows.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, cells]) => cells.get(column))
        .find(Boolean) ?? "";
    const title = (column: string) => {
      const text = (headerRow !== null ? sheet.rows.get(headerRow)?.get(column) : undefined) ?? first(column);
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    };
    const extra = columnLetters((columns.length > 0 ? columnIndex(columns[columns.length - 1]) : 0) + 1);
    return {
      name: sheet.name,
      headerRow,
      columns: [...columns.map((letter) => ({ letter, title: title(letter) })), { letter: extra, title: "(empty column)" }].slice(0, 60),
    };
  });
}

export const isColumnLetter = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{1,3}$/.test(value);

/** Reads a stored mapping defensively; null if the RFP is not a spreadsheet. */
export function parseQuestionnaireMap(value: unknown): QuestionnaireMap | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<QuestionnaireMap>;
  if ((raw.format !== "xlsx" && raw.format !== "csv") || typeof raw.sheet !== "string") return null;
  if (!isColumnLetter(raw.questionColumn) || !isColumnLetter(raw.answerColumn)) return null;
  return {
    format: raw.format,
    sheet: raw.sheet,
    headerRow: typeof raw.headerRow === "number" ? raw.headerRow : null,
    questionColumn: raw.questionColumn,
    answerColumn: raw.answerColumn,
    idColumn: isColumnLetter(raw.idColumn) ? raw.idColumn : null,
    rows: Array.isArray(raw.rows)
      ? raw.rows.filter((row): row is QuestionnaireRow => typeof row?.row === "number" && typeof row?.question === "string")
      : [],
    sheets: Array.isArray(raw.sheets) ? raw.sheets : [],
  };
}

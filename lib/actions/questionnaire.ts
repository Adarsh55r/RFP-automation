"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { safeErrorSummary } from "@/lib/safe-log";
import { downloadRfpFile } from "@/lib/rfp-extract";
import {
  isColumnLetter,
  parseQuestionnaireMap,
  questionRows,
  readSpreadsheet,
  sheetQuestions,
} from "@/lib/spreadsheet";

/**
 * Sets which sheet and columns of a spreadsheet questionnaire hold the
 * questions and where the answers go, then re-reads the question rows.
 * Replaces the extracted question list (drafted answers are not touched).
 */
export async function updateSpreadsheetColumns(input: {
  rfpId: string;
  sheet: string;
  questionColumn: string;
  answerColumn: string;
  idColumn: string | null;
  headerRow: number | null;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false as const, error: "You must be signed in." };

  const { questionColumn, answerColumn } = input;
  const idColumn = input.idColumn || null;
  const headerRow = input.headerRow === null ? null : Number(input.headerRow);
  if (
    !isColumnLetter(questionColumn) ||
    !isColumnLetter(answerColumn) ||
    (idColumn !== null && !isColumnLetter(idColumn)) ||
    (headerRow !== null && (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > 10_000))
  ) {
    return { ok: false as const, error: "Choose valid columns." };
  }
  if (questionColumn === answerColumn || idColumn === answerColumn) {
    return { ok: false as const, error: "Answers need their own column, separate from the questions and IDs." };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return { ok: false as const, error: "Complete onboarding first." };
  const rfp = await prisma.rfp.findFirst({ where: { id: input.rfpId, userId: user.id } });
  const current = parseQuestionnaireMap(rfp?.questionnaireMap);
  if (!rfp?.originalFileUrl || !current) return { ok: false as const, error: "Spreadsheet not found." };

  try {
    const { buffer } = await downloadRfpFile(rfp.originalFileUrl);
    const sheets = await readSpreadsheet(new Uint8Array(buffer), current.format);
    const sheet = sheets.find((item) => item.name === input.sheet);
    if (!sheet) return { ok: false as const, error: "That sheet is not in the file." };

    const base = { format: current.format, sheet: sheet.name, headerRow, questionColumn, answerColumn, idColumn };
    const result = sheetQuestions({ ...base, rows: questionRows(sheet, base) });
    if (!result.map) {
      return { ok: false as const, error: "No questions were found in that column. Pick the column that holds the question text." };
    }
    await prisma.rfp.update({
      where: { id: rfp.id },
      data: {
        questionnaireMap: { ...result.map, sheets: current.sheets } as unknown as Prisma.InputJsonValue,
        extractedQuestionnaire: result.questions,
      },
    });
    revalidatePath(`/dashboard/rfps/${rfp.id}`);
    return { ok: true as const, questions: result.questions.length };
  } catch (error) {
    console.error("Updating spreadsheet columns failed:", safeErrorSummary(error));
    return { ok: false as const, error: "Could not re-read the spreadsheet. Try again in a moment." };
  }
}

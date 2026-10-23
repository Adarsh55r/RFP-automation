"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateSpreadsheetColumns } from "@/lib/actions/questionnaire";
import type { SheetSummary } from "@/lib/spreadsheet";

export type SpreadsheetColumns = {
  format: "xlsx" | "csv";
  sheet: string;
  headerRow: number | null;
  questionColumn: string;
  answerColumn: string;
  idColumn: string | null;
  questionCount: number;
  sheets: SheetSummary[];
};

/** Where a spreadsheet questionnaire's questions are, and which column the answers are written into. */
export function SpreadsheetColumnsCard({ rfpId, columns }: { rfpId: string; columns: SpreadsheetColumns }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheet, setSheet] = useState(columns.sheet);
  const [questionColumn, setQuestionColumn] = useState(columns.questionColumn);
  const [answerColumn, setAnswerColumn] = useState(columns.answerColumn);
  const [idColumn, setIdColumn] = useState(columns.idColumn ?? "");
  const [headerRow, setHeaderRow] = useState(columns.headerRow ? String(columns.headerRow) : "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const options = columns.sheets.find((item) => item.name === sheet)?.columns ?? [];
  const label = (letter: string, title: string) => (title ? `${letter}: ${title}` : letter);

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateSpreadsheetColumns({
        rfpId,
        sheet,
        questionColumn,
        answerColumn,
        idColumn: idColumn || null,
        headerRow: headerRow ? Number(headerRow) : null,
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({
        tone: "ok",
        text: `${result.questions} questions found. If you already drafted answers, regenerate them so they match these questions.`,
      });
      router.refresh();
    });
  };

  const columnSelect = (id: string, value: string, onChange: (value: string) => void, optional = false) => (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={pending}>
      {optional ? <option value="">None</option> : null}
      {options.map((option) => (
        <option key={option.letter} value={option.letter}>
          {label(option.letter, option.title)}
        </option>
      ))}
    </Select>
  );

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Table2 className="mt-1 size-5 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="font-sans text-lg font-semibold text-ink">Spreadsheet columns</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate">
            {columns.questionCount > 0
              ? `${columns.questionCount} questions found. Answers are written into the answer column of your original ${columns.format === "xlsx" ? "workbook" : "CSV file"} when you export it; everything else in the file stays as it is.`
              : "No questions were found automatically. Choose the column that holds the questions and the column for your answers."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {columns.sheets.length > 1 ? (
          <label className="flex flex-col gap-2 text-sm font-medium text-ink" htmlFor="sheet-name">
            Sheet
            <Select id="sheet-name" value={sheet} onChange={(event) => setSheet(event.target.value)} disabled={pending}>
              {columns.sheets.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <label className="flex flex-col gap-2 text-sm font-medium text-ink" htmlFor="question-column">
          Questions are in
          {columnSelect("question-column", questionColumn, setQuestionColumn)}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-ink" htmlFor="answer-column">
          Write answers into
          {columnSelect("answer-column", answerColumn, setAnswerColumn)}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-ink" htmlFor="id-column">
          Question IDs (optional)
          {columnSelect("id-column", idColumn, setIdColumn, true)}
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-ink" htmlFor="header-row">
          Column titles are in row (optional)
          <Input
            id="header-row"
            inputMode="numeric"
            value={headerRow}
            onChange={(event) => setHeaderRow(event.target.value.replace(/\D/g, "").slice(0, 5))}
            disabled={pending}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={save} disabled={pending}>
          {pending ? "Re-reading…" : "Use these columns"}
        </Button>
        {message ? (
          <p role="status" className={message.tone === "ok" ? "text-sm text-slate" : "text-sm text-danger"}>
            {message.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** Date helpers shared by the export (server) and the draft editor (browser). */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH = String.raw`(${MONTHS.join("|")}|${MONTHS.map((m) => m.slice(0, 3)).join("|")})\.?`;
const monthIndex = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)));

const US_DATE = String.raw`${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})`;
const UK_DATE = String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH},?\s+(\d{4})`;

function valid(date: Date) {
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The calendar date in a due-date string such as "September 4, 2026, by 4:59 p.m." or "4 September 2026", if unambiguous. */
export function parseDueDate(text: string): Date | null {
  const us = new RegExp(US_DATE, "i").exec(text);
  const uk = new RegExp(UK_DATE, "i").exec(text);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (us) return valid(new Date(Number(us[3]), monthIndex(us[1]), Number(us[2])));
  if (uk) return valid(new Date(Number(uk[3]), monthIndex(uk[2]), Number(uk[1])));
  if (iso) return valid(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  return null;
}

/** Every full date written in a text ("September 16, 2026", "16 September 2026"), with how it was written. */
export function datesIn(text: string): { text: string; date: Date }[] {
  const found: { text: string; date: Date }[] = [];
  for (const match of text.matchAll(new RegExp(US_DATE, "gi"))) {
    const date = valid(new Date(Number(match[3]), monthIndex(match[1]), Number(match[2])));
    if (date) found.push({ text: match[0], date });
  }
  for (const match of text.matchAll(new RegExp(UK_DATE, "gi"))) {
    const date = valid(new Date(Number(match[3]), monthIndex(match[2]), Number(match[1])));
    if (date) found.push({ text: match[0], date });
  }
  return found;
}

/**
 * Dates in the parts that date the bid itself (the cover letter, signed forms,
 * the cover page) that fall after the deadline: a bid dated after its
 * deadline reads as late, whatever day it is actually sent.
 */
export function datesAfterDeadline(dueDate: string, parts: { title: string; text: string }[]) {
  const due = parseDueDate(dueDate);
  if (!due) return [];
  return parts.flatMap(({ title, text }) =>
    datesIn(text.replace(/\[\[[\s\S]*?\]\]/g, " "))
      .filter(({ date }) => date > due)
      .map((item) => ({ title, date: item.text })),
  );
}

/**
 * What changed in the extracted requirements after an addendum was read:
 * the deadline, and items added, removed or reworded in each list. Matching
 * is by wording, so a reordered list is not reported as a change.
 */

export type RequirementLists = {
  deadline: string | null;
  eligibility: string[];
  desirable: string[];
  evaluation: string[];
  submission: string[];
  questionnaire: string[];
};

export const REQUIREMENT_FIELD_LABELS: Record<Exclude<keyof RequirementLists, "deadline">, string> = {
  eligibility: "Mandatory requirements",
  desirable: "Desirable requirements",
  evaluation: "Evaluation criteria",
  submission: "Submission requirements",
  questionnaire: "Questions",
};

type Field = keyof typeof REQUIREMENT_FIELD_LABELS;

export type ExtractionChanges = {
  at: string;
  addenda: string[];
  deadline: { from: string | null; to: string | null } | null;
  added: { field: Field; text: string }[];
  removed: { field: Field; text: string }[];
  changed: { field: Field; from: string; to: string }[];
};

const words = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9$£€%.]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 1),
  );

/** Share of words two items have in common (Jaccard). */
export function similarity(a: string, b: string) {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Above this, an item that differs is the same requirement reworded (for example a new figure). */
const REWORDED = 0.5;

function diffList(field: Field, before: string[], after: string[], out: ExtractionChanges) {
  const remainingBefore = before.filter((item) => !after.some((other) => same(item, other)));
  const remainingAfter = after.filter((item) => !before.some((other) => same(item, other)));

  for (const item of remainingAfter) {
    let best = -1;
    let score = REWORDED;
    remainingBefore.forEach((candidate, index) => {
      const value = similarity(candidate, item);
      if (value >= score) {
        best = index;
        score = value;
      }
    });
    if (best >= 0) {
      out.changed.push({ field, from: remainingBefore[best], to: item });
      remainingBefore.splice(best, 1);
    } else {
      out.added.push({ field, text: item });
    }
  }
  for (const item of remainingBefore) out.removed.push({ field, text: item });
}

export function diffRequirements(before: RequirementLists, after: RequirementLists, addenda: string[], at = new Date()) {
  const out: ExtractionChanges = {
    at: at.toISOString(),
    addenda,
    deadline: before.deadline === after.deadline ? null : { from: before.deadline, to: after.deadline },
    added: [],
    removed: [],
    changed: [],
  };
  for (const field of Object.keys(REQUIREMENT_FIELD_LABELS) as Field[]) {
    diffList(field, before[field], after[field], out);
  }
  return out;
}

export function changeCount(changes: ExtractionChanges) {
  return (changes.deadline ? 1 : 0) + changes.added.length + changes.removed.length + changes.changed.length;
}

/** One review flag summarising the change, shown with the extracted requirements. */
export function changesFlag(changes: ExtractionChanges) {
  const count = changeCount(changes);
  const names = changes.addenda.join(", ");
  if (count === 0) {
    return `Addenda (${names}): re-read with the original. No changes to the requirements were found; still read the addenda yourself.`;
  }
  const parts = [
    changes.deadline ? `deadline ${changes.deadline.from ?? "not stated"} → ${changes.deadline.to ?? "not stated"}` : "",
    changes.added.length ? `${changes.added.length} added` : "",
    changes.changed.length ? `${changes.changed.length} changed` : "",
    changes.removed.length ? `${changes.removed.length} removed` : "",
  ].filter(Boolean);
  return `Addenda (${names}): ${parts.join(", ")}. See "What the addenda changed", and update any drafted sections they affect.`;
}

export function parseExtractionChanges(value: unknown): ExtractionChanges | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ExtractionChanges>;
  if (typeof raw.at !== "string") return null;
  const list = <T,>(items: unknown) => (Array.isArray(items) ? (items as T[]) : []);
  return {
    at: raw.at,
    addenda: list<string>(raw.addenda),
    deadline: raw.deadline ?? null,
    added: list(raw.added),
    removed: list(raw.removed),
    changed: list(raw.changed),
  };
}

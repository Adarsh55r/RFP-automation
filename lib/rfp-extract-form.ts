export function formatDeadlineForInput(
  value: Date | string | null | undefined,
) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function listToEditableText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : String(item ?? "")))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "items" in value) {
    const items = (value as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return listToEditableText(items);
    }
  }
  return "";
}

export function scopeToEditableText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "summary" in value) {
    const summary = (value as { summary?: unknown }).summary;
    if (typeof summary === "string") {
      return summary;
    }
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

export function editableTextToList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

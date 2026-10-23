/** Longest error message kept in logs and error reports. */
export const MAX_LOGGED_MESSAGE = 300;

/**
 * A short, content-free description of an error for server logs. Error
 * messages can quote their input (a failed database write prints the data it
 * tried to write, a JSON error quotes the text it could not parse), so the
 * message is cut short and only the stack frames, which hold code locations
 * and no data, are kept.
 */
export function safeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) return `Non-error thrown: ${typeof error}`;
  const message = error.message.length > MAX_LOGGED_MESSAGE ? `${error.message.slice(0, MAX_LOGGED_MESSAGE)}… [truncated]` : error.message;
  const frames = (error.stack ?? "")
    .split("\n")
    .filter((line) => line.trim().startsWith("at "))
    .slice(0, 6)
    .join("\n");
  const code = (error as { code?: unknown }).code;
  return `${error.name}${code ? ` (${String(code)})` : ""}: ${message}${frames ? `\n${frames}` : ""}`;
}

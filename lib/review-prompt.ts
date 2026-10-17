/** Fired on window after a proposal file has downloaded. */
export const EXPORTED_EVENT = "draftwin:exported";

export const REVIEW_RESPONSES = ["reviewed", "feedback", "later", "declined"] as const;
export type ReviewResponse = (typeof REVIEW_RESPONSES)[number];

/** Ask at most twice in total: after the first export, and once more after "Maybe later". */
export const MAX_REVIEW_PROMPTS = 2;

/** Never ask twice within this window (e.g. a PDF and a Word export back to back). */
export const REVIEW_PROMPT_GAP_MS = 20 * 60 * 60 * 1000;

/** The public review page (Trustpilot, G2, …). The prompt stays off until it is set. */
export function reviewUrl() {
  const url = process.env.REVIEW_URL?.trim();
  return url && /^https:\/\//.test(url) ? url : null;
}

/** Where "Send private feedback" goes. The option is hidden until it is set. */
export function feedbackEmail() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

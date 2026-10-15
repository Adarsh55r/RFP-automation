import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Anthropic is not configured. Set ANTHROPIC_API_KEY in your environment.",
    );
  }

  if (!client) {
    client = new Anthropic({ apiKey });
  }

  return client;
}

/** Haiku is enough for structured RFP extraction and keeps cost down. */
export const EXTRACTION_MODEL =
  process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-haiku-5-5";

/** Opus for proposal drafting — draft quality is the product. */
export const DRAFTING_MODEL =
  process.env.ANTHROPIC_DRAFTING_MODEL ?? "claude-opus-5-5";

/** Models that accept `output_config.effort`. */
export function supportsEffort(model: string) {
  return /^claude-(opus|sonnet|fable|haiku-5)/.test(model);
}

/** Models that accept the server-side refusal fallback (`fallbacks: "default"`). */
export function supportsDefaultFallback(model: string) {
  return /^claude-(opus-5|sonnet-5-5|fable-5-1)/.test(model);
}

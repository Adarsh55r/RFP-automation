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
  process.env.ANTHROPIC_EXTRACTION_MODEL ?? "claude-haiku-4-5-20251001";

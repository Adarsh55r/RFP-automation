import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Set OPENAI_API_KEY in your environment.",
    );
  }

  if (!client) {
    // Drafting fires several requests at once; extra retries ride out rate limits.
    client = new OpenAI({ apiKey, maxRetries: 5 });
  }

  return client;
}

export const OPENAI_EXTRACTION_MODEL =
  process.env.OPENAI_EXTRACTION_MODEL?.trim() || "gpt-4.1";

export const OPENAI_DRAFTING_MODEL =
  process.env.OPENAI_DRAFTING_MODEL?.trim() || "gpt-4.1";

/** GPT-4.1's output limit; larger requests are rejected. */
export const OPENAI_MAX_OUTPUT_TOKENS = 32768;

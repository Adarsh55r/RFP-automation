import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Gemini is not configured. Set GEMINI_API_KEY in your environment.",
    );
  }

  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }

  return client;
}

/** Fast model for testing extraction (new Google AI keys cannot use 2.x). */
export const GEMINI_EXTRACTION_MODEL =
  process.env.GEMINI_EXTRACTION_MODEL ?? "gemini-3.5-flash";

/** Fast model for testing drafting (new Google AI keys cannot use 2.x). */
export const GEMINI_DRAFTING_MODEL =
  process.env.GEMINI_DRAFTING_MODEL ?? "gemini-3.5-flash";

import { getAnthropicClient, DRAFTING_MODEL, EXTRACTION_MODEL } from "@/lib/anthropic";
import {
  getGeminiClient,
  GEMINI_DRAFTING_MODEL,
  GEMINI_EXTRACTION_MODEL,
} from "@/lib/gemini";

export type LlmProvider = "gemini" | "anthropic";

export type LlmPurpose = "extraction" | "drafting";

export type LlmTextRequest = {
  system: string;
  user: string;
  maxTokens?: number;
  purpose: LlmPurpose;
};

function normalizeProvider(value: string | undefined): LlmProvider {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "anthropic" || normalized === "claude") {
    return "anthropic";
  }
  // Default to Gemini for local/testing cost control.
  return "gemini";
}

export function getLlmProvider(): LlmProvider {
  return normalizeProvider(process.env.LLM_PROVIDER);
}

function modelFor(purpose: LlmPurpose, provider: LlmProvider) {
  if (provider === "anthropic") {
    return purpose === "extraction" ? EXTRACTION_MODEL : DRAFTING_MODEL;
  }
  return purpose === "extraction"
    ? GEMINI_EXTRACTION_MODEL
    : GEMINI_DRAFTING_MODEL;
}

export function llmConfigErrorMessage(purpose: LlmPurpose) {
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    return purpose === "extraction"
      ? "AI extraction is not configured yet. Add ANTHROPIC_API_KEY."
      : "AI drafting is not configured yet. Add ANTHROPIC_API_KEY.";
  }
  return purpose === "extraction"
    ? "AI extraction is not configured yet. Add GEMINI_API_KEY."
    : "AI drafting is not configured yet. Add GEMINI_API_KEY.";
}

export function isLlmConfigError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("Anthropic is not configured") ||
      error.message.includes("Gemini is not configured") ||
      error.message.includes("LLM provider is not configured"))
  );
}

async function generateTextWithAnthropic(request: LlmTextRequest) {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: modelFor(request.purpose, "anthropic"),
    max_tokens: request.maxTokens ?? 4096,
    system: request.system,
    messages: [{ role: "user", content: request.user }],
  });

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned an empty response.");
  }

  return block.text;
}

async function generateTextWithGemini(request: LlmTextRequest) {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: modelFor(request.purpose, "gemini"),
    systemInstruction: request.system,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: request.user }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 4096,
    },
  });

  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

/** Non-streaming text generation (extraction, etc.). */
export async function generateLlmText(request: LlmTextRequest) {
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    return generateTextWithAnthropic(request);
  }
  return generateTextWithGemini(request);
}

async function* streamTextWithAnthropic(request: LlmTextRequest) {
  const anthropic = getAnthropicClient();
  const stream = anthropic.messages.stream({
    model: modelFor(request.purpose, "anthropic"),
    max_tokens: request.maxTokens ?? 8192,
    system: request.system,
    messages: [{ role: "user", content: request.user }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

async function* streamTextWithGemini(request: LlmTextRequest) {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: modelFor(request.purpose, "gemini"),
    systemInstruction: request.system,
  });

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: request.user }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 8192,
    },
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

/** Streaming text generation for progressive draft sections. */
export async function* streamLlmText(request: LlmTextRequest) {
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    yield* streamTextWithAnthropic(request);
    return;
  }
  yield* streamTextWithGemini(request);
}

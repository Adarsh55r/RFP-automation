import type Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  DRAFTING_MODEL,
  EXTRACTION_MODEL,
  supportsDefaultFallback,
  supportsEffort,
} from "@/lib/anthropic";
import {
  getGeminiClient,
  GEMINI_DRAFTING_MODEL,
  GEMINI_EXTRACTION_MODEL,
} from "@/lib/gemini";

export type LlmProvider = "gemini" | "anthropic";

export type LlmPurpose = "extraction" | "drafting";

export type LlmEffort = "low" | "medium" | "high";

export type LlmTextRequest = {
  system: string;
  /**
   * Large shared prefix (RFP text, library) reused across several calls.
   * Sent before `user` and prompt-cached on Anthropic.
   */
  context?: string;
  user: string;
  maxTokens?: number;
  purpose: LlmPurpose;
  effort?: LlmEffort;
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

function anthropicParams(request: LlmTextRequest) {
  const model = modelFor(request.purpose, "anthropic");
  const content: Anthropic.Beta.BetaTextBlockParam[] = [];
  if (request.context) {
    content.push({
      type: "text",
      text: request.context,
      cache_control: { type: "ephemeral" },
    });
  }
  content.push({ type: "text", text: request.user });

  const effort =
    request.effort ??
    (process.env.ANTHROPIC_DRAFTING_EFFORT as LlmEffort | undefined);
  const fallback = supportsDefaultFallback(model);

  return {
    model,
    max_tokens: request.maxTokens ?? 16000,
    system: [
      {
        type: "text" as const,
        text: request.system,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content }],
    ...(effort && supportsEffort(model) ? { output_config: { effort } } : {}),
    // On a safety decline, re-run on a fallback model instead of failing the draft.
    ...(fallback
      ? {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }
      : {}),
  };
}

function assertNotRefused(message: Anthropic.Beta.BetaMessage) {
  if (message.stop_reason === "refusal") {
    throw new Error(
      "The AI model declined to write this part of the proposal. Edit the requirements or try again.",
    );
  }
}

async function generateTextWithAnthropic(request: LlmTextRequest) {
  const anthropic = getAnthropicClient();
  const stream = anthropic.beta.messages.stream(anthropicParams(request));
  const message = await stream.finalMessage();
  assertNotRefused(message);

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) {
    throw new Error("Claude returned an empty response.");
  }
  return text;
}

function geminiPrompt(request: LlmTextRequest) {
  return request.context
    ? `${request.context}\n\n${request.user}`
    : request.user;
}

async function generateTextWithGemini(request: LlmTextRequest) {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: modelFor(request.purpose, "gemini"),
    systemInstruction: request.system,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: geminiPrompt(request) }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 16000,
    },
  });

  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

/** Non-streaming text generation (extraction, bid plan, review). */
export async function generateLlmText(request: LlmTextRequest) {
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    return generateTextWithAnthropic(request);
  }
  return generateTextWithGemini(request);
}

async function* streamTextWithAnthropic(request: LlmTextRequest) {
  const anthropic = getAnthropicClient();
  const stream = anthropic.beta.messages.stream(anthropicParams(request));

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }

  assertNotRefused(await stream.finalMessage());
}

async function* streamTextWithGemini(request: LlmTextRequest) {
  const gemini = getGeminiClient();
  const model = gemini.getGenerativeModel({
    model: modelFor(request.purpose, "gemini"),
    systemInstruction: request.system,
  });

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: geminiPrompt(request) }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens ?? 16000,
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

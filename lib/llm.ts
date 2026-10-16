import type Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  DRAFTING_MODEL,
  EXTRACTION_MODEL,
  supportsDefaultFallback,
  supportsEffort,
} from "@/lib/anthropic";
import type { LlmUsage } from "@/lib/ai-usage";
import {
  getOpenAIClient,
  OPENAI_DRAFTING_MODEL,
  OPENAI_EXTRACTION_MODEL,
  OPENAI_MAX_OUTPUT_TOKENS,
} from "@/lib/openai";
import {
  getGeminiClient,
  GEMINI_DRAFTING_MODEL,
  GEMINI_EXTRACTION_MODEL,
} from "@/lib/gemini";

export type LlmProvider = "gemini" | "anthropic" | "openai";

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
  /** The response must be a single JSON object (bid plan, extraction). */
  json?: boolean;
  /** Called once per model call with its token usage (for metering). */
  onUsage?: (usage: LlmUsage) => void;
};

function reportUsage(
  request: LlmTextRequest,
  provider: LlmProvider,
  usage: { input?: number | null; cached?: number | null; output?: number | null } | null | undefined,
) {
  if (!request.onUsage || !usage) return;
  request.onUsage({
    provider,
    model: modelFor(request.purpose, provider),
    inputTokens: usage.input ?? 0,
    cachedInputTokens: usage.cached ?? 0,
    outputTokens: usage.output ?? 0,
  });
}

function anthropicUsage(message: Anthropic.Beta.BetaMessage) {
  const usage = message.usage;
  const cached = usage.cache_read_input_tokens ?? 0;
  return {
    input: usage.input_tokens + cached + (usage.cache_creation_input_tokens ?? 0),
    cached,
    output: usage.output_tokens,
  };
}

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
};

function geminiUsage(metadata: GeminiUsageMetadata | undefined) {
  if (!metadata) return null;
  return {
    input: metadata.promptTokenCount,
    cached: metadata.cachedContentTokenCount,
    output: (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0),
  };
}

function hasKey(name: string) {
  return Boolean(process.env[name]?.trim());
}

/**
 * OpenAI (GPT-4.1) is the product's AI provider: whenever OPENAI_API_KEY is
 * set it is used, whatever LLM_PROVIDER says. LLM_PROVIDER only chooses
 * between the other providers when no OpenAI key is configured.
 */
export function getLlmProvider(): LlmProvider {
  if (hasKey("OPENAI_API_KEY")) {
    return "openai";
  }
  const requested = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if ((requested === "anthropic" || requested === "claude") && hasKey("ANTHROPIC_API_KEY")) {
    return "anthropic";
  }
  if (requested === "gemini" && hasKey("GEMINI_API_KEY")) {
    return "gemini";
  }
  if (hasKey("ANTHROPIC_API_KEY")) return "anthropic";
  if (hasKey("GEMINI_API_KEY")) return "gemini";
  // Nothing configured: report the OpenAI key as the one to add.
  return "openai";
}

let loggedProvider = false;

function logProviderOnce(purpose: LlmPurpose) {
  if (loggedProvider) return;
  loggedProvider = true;
  const provider = getLlmProvider();
  console.info(`[llm] Using ${provider} (${modelFor(purpose, provider)}) for AI requests.`);
}

/** Turns provider outages and rate limits into a message a user can act on. */
export function friendlyLlmError(error: unknown, purpose: LlmPurpose, fallback: string) {
  if (isLlmConfigError(error)) {
    return llmConfigErrorMessage(purpose);
  }
  const message = error instanceof Error ? error.message : "";
  const status = (error as { status?: number } | null)?.status;
  if (status === 429 || /\b429\b|rate limit|quota/i.test(message)) {
    return "The AI service is rate-limiting this account right now. Wait a minute and try again. If it keeps happening, raise your OpenAI usage tier.";
  }
  if ((status && status >= 500) || /\b50[0-4]\b|overloaded|high demand|unavailable/i.test(message)) {
    return "The AI service is temporarily busy. Please try again in a minute.";
  }
  if (status === 401 || /incorrect api key|invalid api key|\b401\b/i.test(message)) {
    return "The AI service rejected the API key. Check OPENAI_API_KEY in your environment settings.";
  }
  return message || fallback;
}

function modelFor(purpose: LlmPurpose, provider: LlmProvider) {
  if (provider === "anthropic") {
    return purpose === "extraction" ? EXTRACTION_MODEL : DRAFTING_MODEL;
  }
  if (provider === "openai") {
    return purpose === "extraction" ? OPENAI_EXTRACTION_MODEL : OPENAI_DRAFTING_MODEL;
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
  if (provider === "openai") {
    return purpose === "extraction"
      ? "AI extraction is not configured yet. Add OPENAI_API_KEY."
      : "AI drafting is not configured yet. Add OPENAI_API_KEY.";
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
      error.message.includes("OpenAI is not configured") ||
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
  reportUsage(request, "anthropic", anthropicUsage(message));
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

function openAIParams(request: LlmTextRequest) {
  // Shared context goes first in the user message so OpenAI's automatic
  // prompt caching reuses it across the parallel drafting calls.
  return {
    model: modelFor(request.purpose, "openai"),
    ...(request.json ? { response_format: { type: "json_object" as const } } : {}),
    max_completion_tokens: Math.min(request.maxTokens ?? 16000, OPENAI_MAX_OUTPUT_TOKENS),
    messages: [
      { role: "system" as const, content: request.system },
      {
        role: "user" as const,
        content: request.context ? `${request.context}\n\n${request.user}` : request.user,
      },
    ],
  };
}

async function generateTextWithOpenAI(request: LlmTextRequest) {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create(openAIParams(request));
  reportUsage(request, "openai", completion.usage && {
    input: completion.usage.prompt_tokens,
    cached: completion.usage.prompt_tokens_details?.cached_tokens,
    output: completion.usage.completion_tokens,
  });
  const message = completion.choices[0]?.message;
  if (message?.refusal) {
    throw new Error(
      "The AI model declined to write this part of the proposal. Edit the requirements or try again.",
    );
  }
  const text = message?.content ?? "";
  if (!text.trim()) {
    throw new Error("OpenAI returned an empty response.");
  }
  return text;
}

async function* streamTextWithOpenAI(request: LlmTextRequest) {
  const openai = getOpenAIClient();
  const stream = await openai.chat.completions.create({
    ...openAIParams(request),
    stream: true,
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    // The final chunk carries usage and no choices.
    if (chunk.usage) {
      reportUsage(request, "openai", {
        input: chunk.usage.prompt_tokens,
        cached: chunk.usage.prompt_tokens_details?.cached_tokens,
        output: chunk.usage.completion_tokens,
      });
    }
    const delta = chunk.choices[0]?.delta;
    if (delta?.refusal) {
      throw new Error(
        "The AI model declined to write this part of the proposal. Edit the requirements or try again.",
      );
    }
    if (delta?.content) {
      yield delta.content;
    }
  }
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
      ...(request.json ? { responseMimeType: "application/json" } : {}),
    },
  });

  reportUsage(request, "gemini", geminiUsage(result.response.usageMetadata as GeminiUsageMetadata | undefined));
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

/** Non-streaming text generation (extraction, bid plan, review). */
export async function generateLlmText(request: LlmTextRequest) {
  logProviderOnce(request.purpose);
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    return generateTextWithAnthropic(request);
  }
  if (provider === "openai") {
    return generateTextWithOpenAI(request);
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

  const final = await stream.finalMessage();
  reportUsage(request, "anthropic", anthropicUsage(final));
  assertNotRefused(final);
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

  const final = await result.response;
  reportUsage(request, "gemini", geminiUsage(final.usageMetadata as GeminiUsageMetadata | undefined));
}

/** Streaming text generation for progressive draft sections. */
export async function* streamLlmText(request: LlmTextRequest) {
  logProviderOnce(request.purpose);
  const provider = getLlmProvider();
  if (provider === "anthropic") {
    yield* streamTextWithAnthropic(request);
    return;
  }
  if (provider === "openai") {
    yield* streamTextWithOpenAI(request);
    return;
  }
  yield* streamTextWithGemini(request);
}

import { safeErrorSummary } from "@/lib/safe-log";
import { prisma } from "@/lib/db";

export type LlmUsage = {
  provider: string;
  model: string;
  /** All prompt tokens, including any served from the provider's cache. */
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** US dollars per million tokens: [input, cached input, output]. */
const PRICES: { match: RegExp; rates: [number, number, number] }[] = [
  { match: /^gpt-4\.1-nano/, rates: [0.1, 0.025, 0.4] },
  { match: /^gpt-4\.1-mini/, rates: [0.4, 0.1, 1.6] },
  { match: /^gpt-4\.1/, rates: [2, 0.5, 8] },
  { match: /^claude-opus-5-5/, rates: [4, 0.2, 20] },
  { match: /^claude-sonnet-5-5/, rates: [2, 0.2, 10] },
  { match: /^claude-haiku-5-5/, rates: [0.1, 0.01, 0.5] },
  { match: /^gemini-.*flash/, rates: [0.3, 0.075, 2.5] },
];
/** Unknown models are costed at GPT-4.1 rates so caps err on the safe side. */
const FALLBACK_RATES: [number, number, number] = [2, 0.5, 8];

/** [input, cached input, output] US dollars per million tokens for a model. */
export function modelRates(model: string): [number, number, number] {
  return PRICES.find((entry) => entry.match.test(model))?.rates ?? FALLBACK_RATES;
}

export function usageCostMicros(usage: LlmUsage) {
  const [input, cached, output] = modelRates(usage.model);
  const uncached = Math.max(usage.inputTokens - usage.cachedInputTokens, 0);
  // rate is $ per 1M tokens, so tokens × rate is already in micro-dollars.
  return Math.round(uncached * input + usage.cachedInputTokens * cached + usage.outputTokens * output);
}

export type UsageContext = { userId: string; rfpId: string | null; action: string };

/** Returns an onUsage callback that records each model call. Never throws. */
export function usageRecorder(context: UsageContext) {
  return (usage: LlmUsage) => {
    void prisma.aiUsage
      .create({
        data: {
          userId: context.userId,
          rfpId: context.rfpId,
          action: context.action,
          provider: usage.provider,
          model: usage.model,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          costMicros: usageCostMicros(usage),
        },
      })
      .catch((error) => console.error("[ai-usage] Could not record usage:", safeErrorSummary(error)));
  };
}

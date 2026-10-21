import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({ chat: { completions: { create: h.create } } }),
  OPENAI_DRAFTING_MODEL: "gpt-4.1",
  OPENAI_EXTRACTION_MODEL: "gpt-4.1",
  OPENAI_MAX_OUTPUT_TOKENS: 32768,
}));

process.env.OPENAI_API_KEY = "test-key-not-real";

function completion(content: string, finish_reason: string) {
  return { choices: [{ message: { content, refusal: null }, finish_reason }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
}

async function* chunks(parts: string[], finish: string) {
  for (const p of parts) yield { choices: [{ delta: { content: p }, finish_reason: null }] };
  yield { choices: [{ delta: {}, finish_reason: finish }] };
  yield { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } };
}

describe("LLM output that hits the length limit", () => {
  beforeEach(() => h.create.mockReset());

  it("a structured (JSON) call that was cut off raises a clear, specific error", async () => {
    const { generateLlmText, friendlyLlmError } = await import("@/lib/llm");
    h.create.mockResolvedValue(completion('{"scope": "Managed IT', "length"));
    const promise = generateLlmText({ purpose: "extraction", system: "s", user: "u", json: true });
    await expect(promise).rejects.toThrow();
    const error = await promise.catch((e) => e);
    const message = friendlyLlmError(error, "extraction", "fallback");
    expect(message).not.toBe("fallback");
    expect(message).toMatch(/one pass/i);
  });

  it("a complete call returns the text unchanged", async () => {
    const { generateLlmText } = await import("@/lib/llm");
    h.create.mockResolvedValue(completion('{"ok": true}', "stop"));
    await expect(generateLlmText({ purpose: "extraction", system: "s", user: "u", json: true })).resolves.toBe('{"ok": true}');
  });

  it("a streamed section that was cut off ends with a visible placeholder, not a silent stop", async () => {
    const { streamLlmText } = await import("@/lib/llm");
    h.create.mockResolvedValue(chunks(["## Approach\n", "We will deliver the trans"], "length"));
    let text = "";
    for await (const part of streamLlmText({ purpose: "drafting", system: "s", user: "u" })) text += part;
    expect(text).toContain("We will deliver the trans");
    expect(text).toMatch(/\[\[.*(length|cut off|incomplete).*\]\]/i);
  });

  it("a streamed section that finished normally gets no marker", async () => {
    const { streamLlmText } = await import("@/lib/llm");
    h.create.mockResolvedValue(chunks(["Done."], "stop"));
    let text = "";
    for await (const part of streamLlmText({ purpose: "drafting", system: "s", user: "u" })) text += part;
    expect(text).toBe("Done.");
  });
});

import type { LlmTextRequest } from "@/lib/llm";

export type Script = {
  json?: (request: LlmTextRequest) => string | Promise<string>;
  stream?: (request: LlmTextRequest) => AsyncGenerator<string>;
};

export const calls: LlmTextRequest[] = [];
export const script: Script = {};

export async function fakeGenerate(request: LlmTextRequest) {
  calls.push(request);
  if (!script.json) throw new Error("no json script");
  return script.json(request);
}

export async function* fakeStream(request: LlmTextRequest) {
  calls.push(request);
  if (!script.stream) throw new Error("no stream script");
  yield* script.stream(request);
}

export function resetLlm() {
  calls.length = 0;
  delete script.json;
  delete script.stream;
}

export const SAMPLE_PLAN = {
  bidderName: "Ridgeline IT Services LLC",
  buyerName: "City of Fort Hollow",
  buyerAddress: "100 Main Street, Fort Hollow, KY",
  buyerContact: "",
  solicitationNumber: "2026-14",
  projectTitle: "Managed Information Technology Services",
  dueDate: "November 20, 2026 at 2:00 PM EST",
  language: "en-US",
  currency: "USD",
  buyerPriorities: ["24/7 help desk"],
  winThemes: [{ theme: "Local team", evidence: "Lexington office" }],
  requiredStructure: [],
  keyFacts: ["85 users"],
  lengthGuidance: "20 pages",
  evidencePlan: {},
};

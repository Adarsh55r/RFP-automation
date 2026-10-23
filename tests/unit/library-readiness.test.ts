import { describe, expect, it } from "vitest";
import { draftStrength, setupSteps } from "@/lib/library-readiness";
import { libraryTemplates } from "@/lib/library-templates";

describe("setup checklist", () => {
  it("tracks each step from the library counts", () => {
    const steps = setupSteps({ counts: { case_study: 2, saved_answer: 1 }, profileLength: 120, rfpCount: 1 });
    expect(steps.filter((step) => step.done).map((step) => step.id)).toEqual(["case_studies", "first_rfp"]);
    expect(setupSteps({ counts: {}, profileLength: 400, rfpCount: 0 })[0].done).toBe(true);
  });
});

describe("draft strength", () => {
  const library = [
    { type: "company_profile" as const, title: "Profile", content: "Ridgeline IT. ISO 9001 certified." },
    { type: "case_study" as const, title: "A", content: "..." },
    { type: "case_study" as const, title: "B", content: "..." },
    { type: "team_bio" as const, title: "Jo", content: "..." },
  ];

  it("names credentials the RFP mentions that the library does not support", () => {
    const strength = draftStrength(library, {
      requirementsText: "Bidders must hold ISO 9001 and SOC 2 Type II.",
      keyDetails: [],
      questionCount: 0,
    });
    const credentials = strength.checks.find((check) => check.label.startsWith("Credentials"))!;
    expect(credentials.ok).toBe(false);
    expect(credentials.fix).toMatch(/mentions SOC 2, which your library does not/);
    expect(strength.level).toBe("fair");
  });

  it("is strong when the library covers the RFP, and asks for more bios when key personnel are required", () => {
    const covered = draftStrength([...library, { type: "saved_answer", title: "Q", content: "A" }], {
      requirementsText: "ISO 9001 required.",
      keyDetails: [],
      questionCount: 0,
    });
    expect(covered).toMatchObject({ level: "strong", score: 100 });
    const people = draftStrength([...library, { type: "saved_answer", title: "Q", content: "A" }], {
      requirementsText: "",
      keyDetails: [{ category: "key_personnel", detail: "Named project manager", kind: "mandatory", quote: null, page: null, verified: true }],
      questionCount: 0,
    });
    expect(people.checks.find((check) => check.label === "Bios for named roles")?.ok).toBe(false);
  });
});

describe("library templates", () => {
  it("contain no facts, only placeholders for the user's own details", () => {
    for (const template of Object.values(libraryTemplates)) {
      expect(template.content).toMatch(/\[\[[^\]]+\]\]/);
      // No digits outside placeholders: no invented years, numbers or limits.
      expect(template.content.replace(/\[\[[^\]]+\]\]/g, "")).not.toMatch(/\d/);
    }
  });
});

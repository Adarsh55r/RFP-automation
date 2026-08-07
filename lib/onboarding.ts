export const teamSizeOptions = [
  { value: "1-10", label: "1–10 people", hint: "Boutique or specialist desk" },
  { value: "11-30", label: "11–30 people", hint: "Growing delivery agency" },
  { value: "31-80", label: "31–80 people", hint: "Multi-team pre-sales" },
] as const;

export type TeamSize = (typeof teamSizeOptions)[number]["value"];

export type OnboardingPayload = {
  agencyName: string;
  teamSize: TeamSize;
  intendedPlan?: string;
};

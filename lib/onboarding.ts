export const teamSizeOptions = [
  { value: "1-10", label: "1–10 people", hint: "Founder-led or specialist team" },
  { value: "11-30", label: "11–30 people", hint: "Growing small business" },
  { value: "31-80", label: "31–80 people", hint: "Several people writing bids" },
] as const;

export type TeamSize = (typeof teamSizeOptions)[number]["value"];

export type OnboardingPayload = {
  agencyName: string;
  teamSize: TeamSize;
  intendedPlan?: string;
  /** The user ticked "I agree to the Terms of Service and Privacy Policy". */
  acceptTerms: boolean;
};

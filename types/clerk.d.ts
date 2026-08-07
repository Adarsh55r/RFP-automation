export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      onboardingCompleted?: boolean;
    };
  }

  interface UserUnsafeMetadata {
    intendedPlan?: string | null;
    agencyName?: string;
    teamSize?: "1-10" | "11-30" | "31-80";
    onboardingCompleted?: boolean;
  }
}

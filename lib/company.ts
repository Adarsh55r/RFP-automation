/**
 * Who operates DraftBid AI. Every value wrapped in {{…}} is a placeholder the
 * founder must replace before these pages go live (see FOUNDER_TODO.md); the
 * admin Setup page flags any that remain.
 */
export const COMPANY = {
  productName: "DraftBid AI",
  legalName: "{{LEGAL_ENTITY_NAME}}",
  registeredAddress: "{{REGISTERED_ADDRESS}}",
  companyNumber: "{{COMPANY_NUMBER}}",
  governingLaw: "{{GOVERNING_LAW}}",
  venue: "{{VENUE}}",
  contactEmail: "{{CONTACT_EMAIL}}",
  privacyEmail: "privacy@draftbidai.com",
  securityEmail: "{{SECURITY_EMAIL}}",
  founderName: "{{FOUNDER_NAME}}",
  founderBio: "{{FOUNDER_BIO}}",
  founderPhotoUrl: "{{FOUNDER_PHOTO_URL}}",
} as const;

/**
 * Whether the founder has confirmed, from each AI provider's account terms,
 * that API data is not used to train models. Until then the site does not say so.
 */
export const AI_NO_TRAINING_CONFIRMED = false;

export function isPlaceholder(value: string) {
  return /\{\{[A-Z0-9_]+\}\}/.test(value);
}

/** Company fields still holding a placeholder. */
export function companyPlaceholders() {
  return Object.entries(COMPANY)
    .filter(([, value]) => isPlaceholder(value))
    .map(([key]) => key);
}

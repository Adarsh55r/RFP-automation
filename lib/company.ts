/**
 * Who runs DraftBid AI. It is an independent product built and run by its
 * founder, not a registered company, so the public pages name only the
 * product and one contact address, and make no claims about a legal entity,
 * registered address or jurisdiction. If a company is formed later, add its
 * details here and to the Terms, Privacy Policy and DPA (see FOUNDER_TODO.md).
 */
export const COMPANY = {
  productName: "DraftBid AI",
  contactEmail: "privacy@draftbidai.com",
  privacyEmail: "privacy@draftbidai.com",
  securityEmail: "privacy@draftbidai.com",
} as const;

/**
 * Whether the founder has confirmed, from each AI provider's account terms,
 * that API data is not used to train models. Until then the site does not say so.
 */
export const AI_NO_TRAINING_CONFIRMED = false;

/**
 * Optional booking page for the done-with-you setup (e.g. a scheduling link).
 * Until it is set, "Get help with your first bid" goes to the setup add-on on
 * the pricing page, and the add-on's button opens an email.
 */
export const SETUP_BOOKING_URL = "";

export function setupHelpHref() {
  return SETUP_BOOKING_URL || "/pricing#setup";
}

/** Where the setup add-on's own button goes: the booking page if set, otherwise an email. */
export function setupRequestHref() {
  return SETUP_BOOKING_URL || `mailto:${COMPANY.contactEmail}?subject=${encodeURIComponent("Done-with-you setup")}`;
}

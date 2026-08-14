/** Keyboard focus ring — use on every interactive control. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const focusRingDanger =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const focusRingOnDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-raised focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark";

/** Inline text links on light surfaces. */
export const textLink =
  "rounded-control font-medium text-brand transition-colors duration-hover ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Wordmark / text links on brand-dark. */
export const textLinkOnDark =
  "rounded-control font-sans font-semibold text-surface-raised transition-colors duration-hover ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-raised focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark";

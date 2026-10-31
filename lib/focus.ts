/** Keyboard focus ring — use on every interactive control. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Focus for text fields: the border lights up with a soft brand halo instead of an offset ring. */
export const fieldFocus =
  "focus-visible:outline-none focus-visible:border-brand focus-visible:shadow-[0_0_0_4px_rgb(var(--glow)/0.16)]";

export const focusRingDanger =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export const focusRingOnDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark";

/** Inline text links on light surfaces. */
export const textLink =
  "rounded-control font-medium text-brand transition-colors duration-hover ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/** Wordmark / text links on brand-dark. */
export const textLinkOnDark =
  "rounded-control font-sans font-semibold text-white transition-colors duration-hover ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark";

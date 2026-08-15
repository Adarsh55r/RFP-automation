const HEADER_OFFSET_PX = 80;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function hashFromHref(href: string): string | null {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return null;
  const hash = href.slice(hashIndex + 1);
  return hash || null;
}

export function scrollToHash(hash: string) {
  const target = document.getElementById(hash);
  if (!target) return false;

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const top =
    target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX;

  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}

export function scrollToTop() {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  window.scrollTo({ top: 0, behavior });
}

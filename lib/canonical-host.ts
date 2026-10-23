/**
 * Optional redirect so only one host serves pages: requests to the www or
 * apex twin of the canonical host get a permanent redirect to it. Off unless
 * CANONICAL_HOST_REDIRECT=1, because a Vercel domain redirect in the opposite
 * direction would make a loop; Vercel's own domain redirect is the preferred
 * way (FOUNDER_TODO.md).
 */
export function canonicalRedirect(requestUrl: URL, host: string | null, siteUrl: string, enabled: boolean) {
  if (!enabled || !host) return null;
  const canonical = new URL(siteUrl);
  const requested = host.toLowerCase().split(":")[0];
  const target = canonical.hostname.toLowerCase();
  const twin = target.startsWith("www.") ? target.slice(4) : `www.${target}`;
  if (requested !== twin) return null;
  const destination = new URL(requestUrl.pathname + requestUrl.search, canonical.origin);
  return destination.toString();
}

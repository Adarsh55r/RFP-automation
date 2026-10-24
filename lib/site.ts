/**
 * The public address search engines and AI assistants should use for every
 * page: canonical tags, sitemap, Open Graph. Set NEXT_PUBLIC_SITE_URL to the
 * domain Vercel serves as primary (www or not); the other one must redirect.
 */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "https://draftbidai.com";

function normalizeSiteUrl(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
export const SITE_NAME = "DraftBid AI";
export const SITE_TAGLINE = "Compliant first drafts of RFP responses, written from your own documents";
export const SITE_DESCRIPTION =
  "DraftBid AI is RFP response software for small and mid-sized businesses. Upload an RFP, public-sector tender, or questionnaire as PDF, Word, Excel or a scan; it extracts every requirement into a checklist, drafts a compliant proposal from your own past work with the source of each claim, flags anything it cannot support, and exports to Word or PDF.";

/**
 * Public pages listed in the sitemap. `updated` is when the page's content
 * last changed: bump it when you edit that page, because search engines only
 * trust lastmod dates that are accurate.
 */
export const PUBLIC_PAGES = [
  { path: "/", updated: "2026-10-25", priority: 1 },
  { path: "/pricing", updated: "2026-10-25", priority: 0.8 },
  { path: "/privacy", updated: "2026-10-23", priority: 0.3 },
  { path: "/terms", updated: "2026-10-23", priority: 0.3 },
  { path: "/security", updated: "2026-10-23", priority: 0.5 },
  { path: "/subprocessors", updated: "2026-10-23", priority: 0.3 },
  { path: "/dpa", updated: "2026-10-23", priority: 0.3 },
  { path: "/about", updated: "2026-10-23", priority: 0.4 },
  { path: "/for/it-services", updated: "2026-10-25", priority: 0.7 },
  { path: "/for/consultancies", updated: "2026-10-25", priority: 0.7 },
  { path: "/for/service-contractors", updated: "2026-10-25", priority: 0.7 },
  { path: "/for/consultants", updated: "2026-10-25", priority: 0.6 },
  { path: "/use-cases/uk-tenders", updated: "2026-10-25", priority: 0.6 },
  { path: "/use-cases/security-questionnaires", updated: "2026-10-25", priority: 0.6 },
  { path: "/tools/rfp-checklist", updated: "2026-10-25", priority: 0.7 },
] as const;

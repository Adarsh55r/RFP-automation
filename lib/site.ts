/** The public address search engines and AI assistants should use for every page. */
export const SITE_URL = "https://draftbidai.com";
export const SITE_NAME = "DraftBid AI";
export const SITE_TAGLINE = "Compliant first drafts of RFP responses, written from your own documents";
export const SITE_DESCRIPTION =
  "DraftBid AI is RFP response software for small and mid-sized businesses. Upload an RFP, public-sector tender, or security questionnaire as PDF or Word; it extracts every requirement into a checklist, drafts a compliant proposal from your own past work, flags anything it cannot support, and exports to Word or PDF.";

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
] as const;

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Signed-in areas: nothing there is useful to a search engine. */
const PRIVATE_PATHS = ["/dashboard", "/onboarding", "/api/"];

/** AI assistants and AI search engines. Named so it is explicit that they may read and cite the public pages. */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // A crawler follows only the most specific group that names it, so the same paths are repeated here.
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // /llms.txt is left out on purpose: AI assistants look for it at that fixed
  // address, and listing it here could get a plain-text file indexed as a page.
  const pages = PUBLIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(page.updated),
    changeFrequency: "monthly" as const,
    priority: page.priority,
  }));
  // Guides join the sitemap only once their copy is written and published.
  const guides = GUIDES.filter((guide) => guide.published).map((guide) => ({
    url: `${SITE_URL}/guides/${guide.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [...pages, ...guides];
}

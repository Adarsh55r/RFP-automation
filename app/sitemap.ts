import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // /llms.txt is left out on purpose: AI assistants look for it at that fixed
  // address, and listing it here could get a plain-text file indexed as a page.
  return PUBLIC_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path === "/" ? "" : page.path}`,
    lastModified: new Date(page.updated),
    changeFrequency: "monthly",
    priority: page.priority,
  }));
}

import { safeFetchText, UnsafeUrlError } from "@/lib/safe-fetch";

/**
 * Reads a company's own public website so its profile and case studies can
 * be drafted into the content library. Only runs when the user asks; follows
 * robots.txt; reads the home page plus a few same-site pages that usually
 * describe the company (about, services, case studies, team).
 */

export const MAX_IMPORT_PAGES = 6;
const MAX_PAGE_CHARS = 15_000;
const MAX_TOTAL_CHARS = 60_000;
const USER_AGENT_TOKEN = "draftbidai";

// ---------- robots.txt ----------

type RobotsRule = { allow: boolean; path: string };

/** Rules that apply to us: our own user-agent group if there is one, otherwise "*". */
export function parseRobots(text: string) {
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (field === "allow" || field === "disallow")) {
        current.rules.push({ allow: field === "allow", path: value });
      }
    }
  }
  const own = groups.find((group) => group.agents.some((agent) => agent !== "*" && USER_AGENT_TOKEN.includes(agent.replace(/[^a-z]/g, ""))));
  return (own ?? groups.find((group) => group.agents.includes("*")))?.rules ?? [];
}

function ruleMatches(rulePath: string, path: string) {
  if (!rulePath) return false;
  const pattern = rulePath
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  return new RegExp(`^${pattern}`).test(path);
}

/** Longest matching rule wins; ties go to Allow (as Google and RFC 9309 do). */
export function robotsAllows(rules: RobotsRule[], path: string) {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!ruleMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

// ---------- HTML ----------

function decodeEntities(text: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

/** Visible text of an HTML page (scripts, styles, navigation chrome and hidden elements removed). */
export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|head|nav|footer|form)\b[\s\S]*?<\/\1>/gi, " ")
      // Elements hidden from readers, which can hold text meant only for machines.
      .replace(/<([a-z0-9]+)\b[^>]*(\bhidden\b|aria-hidden="true"|display:\s*none|visibility:\s*hidden)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const USEFUL_PATH = /about|who-we-are|company|services|what-we-do|solutions|case|work|projects|portfolio|clients|customers|team|people|leadership|expertise|capabilit|industr|sectors|accreditation|certification/i;

/** Same-site links that probably describe the company, best first. */
export function pickCompanyLinks(html: string, base: URL, limit: number) {
  const seen = new Set<string>([base.origin + base.pathname]);
  const links: { url: URL; score: number }[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(decodeEntities(match[1]), base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (!/^https?:$/.test(url.protocol) || /\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|mp4|svg)$/i.test(url.pathname)) continue;
    const key = url.origin + url.pathname.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    url.search = "";
    url.hash = "";
    const score = (USEFUL_PATH.test(url.pathname) ? 10 : 0) - url.pathname.split("/").length;
    if (score > 0) links.push({ url, score });
  }
  return links.sort((a, b) => b.score - a.score).slice(0, limit).map((link) => link.url);
}

// ---------- crawl ----------

export type CrawledSite = { pages: { url: string; text: string }[]; skippedByRobots: number };

export function normalizeSiteUrl(input: string) {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function crawlCompanySite(input: string, fetchText = safeFetchText): Promise<CrawledSite> {
  const start = new URL(normalizeSiteUrl(input));
  let rules: RobotsRule[] = [];
  try {
    const robots = await fetchText(`${start.origin}/robots.txt`, { maxBytes: 256 * 1024 });
    if (robots.status >= 500) throw new UnsafeUrlError("This website is not responding properly right now. Try again later.");
    if (robots.status === 200) rules = parseRobots(robots.body);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    // No robots.txt reachable: proceed, as crawlers do for a missing file.
  }

  let skippedByRobots = 0;
  const pages: { url: string; text: string }[] = [];
  let total = 0;
  const read = async (url: URL) => {
    if (!robotsAllows(rules, url.pathname)) {
      skippedByRobots += 1;
      return null;
    }
    const page = await fetchText(url.toString());
    if (page.status !== 200 || !/text\/(html|plain)/i.test(page.contentType)) return null;
    const text = (/html/i.test(page.contentType) ? htmlToText(page.body) : page.body).slice(0, MAX_PAGE_CHARS);
    if (text.length < 100 || total >= MAX_TOTAL_CHARS) return page;
    const kept = text.slice(0, MAX_TOTAL_CHARS - total);
    total += kept.length;
    pages.push({ url: page.url, text: kept });
    return page;
  };

  const home = await read(start);
  if (home) {
    for (const link of pickCompanyLinks(home.body, new URL(home.url), MAX_IMPORT_PAGES - 1)) {
      if (total >= MAX_TOTAL_CHARS) break;
      await read(link).catch(() => null);
    }
  }
  return { pages, skippedByRobots };
}

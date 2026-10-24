"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { beginAccountAiTask } from "@/lib/ai-guard";
import { usageRecorder } from "@/lib/ai-usage";
import { prisma } from "@/lib/db";
import { LibraryItemType } from "@/lib/generated/prisma";
import { addLibraryItems } from "@/lib/library-store";
import { friendlyLlmError, generateLlmText } from "@/lib/llm";
import { neutralizePromptTags } from "@/lib/rfp-draft";
import { safeErrorSummary } from "@/lib/safe-log";
import { UnsafeUrlError } from "@/lib/safe-fetch";
import { WEBSITE_IMPORTS_PER_DAY, WEBSITE_IMPORT_SYSTEM, parseWebsiteDraft } from "@/lib/website-draft";
import { crawlCompanySite, normalizeSiteUrl } from "@/lib/website-import";

/**
 * Drafts a company profile and case studies from the user's own website into
 * their library. Every imported item says where it came from and asks the
 * user to check it; nothing is used in a proposal until it is in the library.
 */
export async function importFromWebsite(siteUrl: string) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { ok: false as const, error: "You must be signed in." };
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { subscription: { select: { tier: true, planVersion: true } } },
  });
  if (!user) return { ok: false as const, error: "Complete onboarding first." };
  if (typeof siteUrl !== "string" || siteUrl.trim().length < 4 || siteUrl.length > 300) {
    return { ok: false as const, error: "Enter your website address, for example example.com." };
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  const importsToday = await prisma.aiUsage.count({
    where: { userId: user.id, action: "website_import", createdAt: { gte: today } },
  });
  if (importsToday >= WEBSITE_IMPORTS_PER_DAY) {
    return { ok: false as const, error: `You can import from a website ${WEBSITE_IMPORTS_PER_DAY} times a day. Try again tomorrow.` };
  }

  const guard = await beginAccountAiTask(user, user.subscription?.tier ?? "free");
  if (!guard.ok) return { ok: false as const, error: guard.error };

  try {
    const site = await crawlCompanySite(siteUrl);
    if (site.pages.length === 0) {
      return {
        ok: false as const,
        error:
          site.skippedByRobots > 0
            ? "This website's robots.txt asks automated tools not to read these pages, so nothing was imported. Copy the text into your library instead."
            : "No readable text was found at that address. Check the address, or copy the text into your library instead.",
      };
    }

    const pagesText = site.pages
      .map((page) => `<page url="${page.url.replace(/"/g, "'")}">\n${neutralizePromptTags(page.text)}\n</page>`)
      .join("\n\n");
    const raw = await generateLlmText({
      purpose: "extraction",
      json: true,
      maxTokens: 8000,
      system: WEBSITE_IMPORT_SYSTEM,
      user: `Website pages:\n\n${pagesText}`,
      onUsage: usageRecorder({ userId: user.id, rfpId: null, action: "website_import" }),
    });
    const draft = parseWebsiteDraft(raw);

    const source = normalizeSiteUrl(siteUrl);
    const note = `Imported from ${source} on ${new Date().toISOString().slice(0, 10)}. Check every detail and remove marketing claims you cannot back up before relying on this.`;
    const candidates: { type: LibraryItemType; title: string; content: string }[] = [];
    if (draft.companyProfile) {
      candidates.push({ type: LibraryItemType.company_profile, title: "Company profile (from website)", content: `${note}\n\n${draft.companyProfile}` });
    }
    for (const study of draft.caseStudies) {
      candidates.push({ type: LibraryItemType.case_study, title: `${study.title} (from website)`, content: `${note}\n\n${study.content}` });
    }
    const { created, skippedForLimits, keptExistingProfile } = await addLibraryItems(user, candidates);

    revalidatePath("/dashboard/library");
    revalidatePath("/dashboard");
    return {
      ok: true as const,
      created,
      pagesRead: site.pages.length,
      skippedByRobots: site.skippedByRobots,
      skippedForLimits,
      keptExistingProfile,
    };
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false as const, error: error.message };
    console.error("Website import failed:", safeErrorSummary(error));
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "EPRIVATE" || code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ECONNRESET") {
      return { ok: false as const, error: "Could not reach that website. Check the address and that it is public." };
    }
    return { ok: false as const, error: friendlyLlmError(error, "extraction", "Import failed. Try again in a moment.") };
  } finally {
    await guard.release();
  }
}

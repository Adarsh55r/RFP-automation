import { faqs } from "@/lib/faqs";
import { plans } from "@/lib/plans";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * /llms.txt: a plain summary of the product for AI assistants, following the
 * llms.txt convention. Built from the same plan and FAQ data as the site.
 */
export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_TAGLINE}. ${SITE_DESCRIPTION}`,
    "",
    "Who it is for: small and mid-sized businesses in the US, UK and other English-speaking markets that answer RFPs without a dedicated bid team, including US state, local and education (SLED) RFPs, UK public-sector tenders, commercial RFPs and security questionnaires.",
    "",
    "How it works: 1) upload the RFP (PDF or Word with selectable text); 2) check the extracted requirements, deadline and evaluation criteria; 3) draft the proposal from your own content library; 4) fill the highlighted gaps and export to Word or PDF.",
    "",
    "## Pages",
    "",
    `- [Home](${SITE_URL}/): what ${SITE_NAME} does and how it works`,
    `- [Pricing](${SITE_URL}/pricing): plans, limits and FAQs`,
    `- [Privacy policy](${SITE_URL}/privacy): how customer and RFP data is handled`,
    `- [Sign up](${SITE_URL}/sign-up): start on the free plan`,
    "",
    "## Plans (per month)",
    "",
    ...plans.map(
      (plan) =>
        `- ${plan.name}: $${plan.monthly.usd} / £${plan.monthly.gbp}. ${plan.summary} Includes: ${plan.features.join("; ")}.`,
    ),
    "",
    "## FAQ",
    "",
    ...faqs.flatMap((faq) => [`### ${faq.question}`, "", faq.answer, ""]),
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

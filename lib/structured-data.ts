import { faqs } from "@/lib/faqs";
import { displayPrice, publicPlans } from "@/lib/plans";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const organizationId = `${SITE_URL}/#organization`;

/** Home page: who makes the product, the site, and the product itself with its plans. */
export function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/apple-icon.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { "@id": organizationId },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "RFP response and proposal software",
        operatingSystem: "Web browser",
        publisher: { "@id": organizationId },
        featureList: [
          "Extracts requirements, deadlines, page limits and evaluation criteria from RFPs, tenders and questionnaires, with the page each came from",
          "Reads PDF, Word, Excel and CSV files, and scanned documents with OCR",
          "Re-reads requirements when addenda arrive and shows what changed",
          "Drafts proposals from your own past proposals, case studies, résumés and saved answers, citing the source of each claim",
          "Marks unsupported statements and missing facts for review instead of inventing them",
          "Exports to Word and PDF, and writes questionnaire answers back into the buyer's spreadsheet",
        ],
        offers: publicPlans.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: displayPrice(plan, "usd", "monthly").amount,
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing`,
          description: plan.summary,
        })),
      },
    ],
  };
}

/** Pricing page: the FAQs shown on it. */
export function faqStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

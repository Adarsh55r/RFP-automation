import { faqs } from "@/lib/faqs";
import { plans } from "@/lib/plans";
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
          "Extracts requirements, deadlines and evaluation criteria from RFPs, tenders and security questionnaires",
          "Flags deadlines, addenda and requirements to double-check against the document",
          "Drafts proposals from your own case studies, bios and saved answers",
          "Marks gaps as placeholders instead of inventing facts",
          "Exports to Word and PDF",
        ],
        offers: plans.map((plan) => ({
          "@type": "Offer",
          name: `${plan.name} plan`,
          price: plan.monthly.usd,
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

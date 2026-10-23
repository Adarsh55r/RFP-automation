import { getLlmProvider } from "@/lib/llm";

export type Subprocessor = {
  name: string;
  purpose: string;
  data: string;
  location: string;
  /** Whether this deployment currently uses it. */
  inUse: boolean;
};

const has = (name: string) => Boolean(process.env[name]?.trim());

/**
 * Every third party that can receive customer data, found by reading the
 * code and its configuration. Regions marked {{…}} depend on account settings
 * the founder must confirm. Keep in sync with the code: a test checks that
 * each integration in package.json appears here.
 */
export function getSubprocessors(): Subprocessor[] {
  const provider = getLlmProvider();
  return [
    {
      name: "Vercel Inc.",
      purpose: "Hosting and running the application; cookie-free page-view analytics",
      data: "All data passing through the app, including uploads in transit; page URLs and coarse device data for analytics",
      location: "{{VERCEL_REGION}} (United States by default)",
      inUse: true,
    },
    {
      name: "Neon (database hosting)",
      purpose: "Postgres database",
      data: "Account details, extracted requirements, full RFP text, library items, drafts, usage records",
      location: "{{NEON_REGION}}",
      inUse: true,
    },
    {
      name: "Supabase Inc.",
      purpose: "File storage for uploaded RFP files",
      data: "Original RFP files (PDF, Word)",
      location: "{{SUPABASE_REGION}}",
      inUse: true,
    },
    {
      name: "Clerk Inc.",
      purpose: "Sign-in, account security and sign-in emails",
      data: "Name, email address, sign-in method and session data",
      location: "United States",
      inUse: true,
    },
    {
      name: "OpenAI, L.L.C.",
      purpose: "AI processing: reading RFPs and drafting proposal text",
      data: "RFP text, library content and drafts sent in each request",
      location: "United States",
      inUse: provider === "openai",
    },
    {
      name: "Anthropic, PBC",
      purpose: "AI processing (used only when configured instead of OpenAI)",
      data: "RFP text, library content and drafts sent in each request",
      location: "United States",
      inUse: provider === "anthropic",
    },
    {
      name: "Google LLC (Gemini API)",
      purpose: "AI processing (used only when configured instead of OpenAI)",
      data: "RFP text, library content and drafts sent in each request",
      location: "United States",
      inUse: provider === "gemini",
    },
    {
      name: "Functional Software, Inc. (Sentry)",
      purpose: "Error monitoring",
      data: "Technical error details, the page, and your account ID; never file or draft content",
      location: "United States",
      inUse: has("NEXT_PUBLIC_SENTRY_DSN"),
    },
    {
      name: "Slack Technologies (internal alerts)",
      purpose: "Alerting our team when an account reaches its AI usage limit",
      data: "Account email and usage amount",
      location: "United States",
      inUse: has("ALERT_WEBHOOK_URL"),
    },
    {
      name: "{{PAYMENT_PROVIDER}}",
      purpose: "Payments and invoices, once paid plans are live",
      data: "Billing name, address, tax ID, payment details (card data is held by the provider, not by us)",
      location: "{{PAYMENT_PROVIDER_REGION}}",
      inUse: false,
    },
  ];
}

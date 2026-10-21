import { prisma } from "@/lib/db";
import { getLlmProvider } from "@/lib/llm";
import { feedbackEmail, reviewUrl } from "@/lib/review-prompt";
import { NEEDS_UPGRADE_SQL } from "@/lib/schema-upgrade";
import { getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Which settings this deployment is actually running with, for the admin
 * "Setup" page. Never returns secret values: only whether each one is set,
 * plus a harmless hint (a host name, a count, an email the admin chose).
 */

export type CheckState = "on" | "missing" | "invalid" | "off" | "info";

export type SetupCheck = {
  id: string;
  group: "Core" | "Growth" | "Monitoring";
  label: string;
  /** Required checks block the product; optional ones only switch a feature on. */
  required: boolean;
  state: CheckState;
  detail: string;
  /** Where to fix it, shown when the check is not "on". */
  fix?: string;
};

const has = (name: string) => Boolean(process.env[name]?.trim());

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function databaseCheck(): Promise<SetupCheck> {
  const base = { id: "database", group: "Core" as const, label: "Database", required: true };
  if (!has("DATABASE_URL")) {
    return { ...base, state: "missing", detail: "DATABASE_URL is not set.", fix: "Add your Neon pooled connection string as DATABASE_URL." };
  }
  try {
    const [row] = await prisma.$queryRawUnsafe<{ needsUpgrade: boolean }[]>(NEEDS_UPGRADE_SQL);
    return row?.needsUpgrade
      ? {
          ...base,
          state: "invalid",
          detail: "Connected, but the schema is behind this version of the app.",
          fix: "Redeploy. The app upgrades the database when it starts; check the Vercel logs for [schema-upgrade] if this stays red.",
        }
      : { ...base, state: "on", detail: "Connected, schema up to date." };
  } catch {
    return { ...base, state: "invalid", detail: "DATABASE_URL is set but the database could not be reached.", fix: "Check the Neon connection string and that the project is not paused." };
  }
}

/** Uploaded RFPs are confidential; a public bucket would let anyone with a file's URL read it. */
async function bucketPrivacyCheck(): Promise<SetupCheck | null> {
  if (!has("NEXT_PUBLIC_SUPABASE_URL") || !has("SUPABASE_SERVICE_ROLE_KEY")) return null;
  const base = { id: "bucket-privacy", group: "Core" as const, label: "RFP files are private", required: true };
  try {
    const { data, error } = await getSupabaseAdmin().storage.getBucket(getRfpStorageBucket());
    if (error || !data) {
      return { ...base, state: "invalid", detail: `Could not read the "${getRfpStorageBucket()}" bucket.`, fix: "Check SUPABASE_RFP_BUCKET and that the bucket exists." };
    }
    return data.public
      ? {
          ...base,
          state: "invalid",
          detail: "The storage bucket is public: anyone who has a file's link can download a customer's RFP.",
          fix: "Supabase → Storage → the bucket → Edit bucket → turn off \"Public bucket\". DraftWin already uses short-lived signed links.",
        }
      : { ...base, state: "on", detail: "Bucket is private; files open through 60-second signed links." };
  } catch {
    return { ...base, state: "invalid", detail: "Could not check the storage bucket.", fix: "Check the Supabase keys." };
  }
}

export async function getSetupStatus() {
  const provider = getLlmProvider();
  const providerKey = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY" }[provider];
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim()).filter(Boolean);
  const rawReviewUrl = process.env.REVIEW_URL?.trim();
  const review = reviewUrl();
  const rawSupport = process.env.SUPPORT_EMAIL?.trim();
  const support = feedbackEmail();
  const sourceMaps = has("SENTRY_AUTH_TOKEN") && has("SENTRY_ORG") && has("SENTRY_PROJECT");

  const bucket = await bucketPrivacyCheck();
  const checks: SetupCheck[] = [
    await databaseCheck(),
    ...(bucket ? [bucket] : []),
    has(providerKey)
      ? {
          id: "ai",
          group: "Core",
          label: "AI provider",
          required: true,
          state: "on",
          detail: `${provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Gemini"} key set (${providerKey}).`,
        }
      : {
          id: "ai",
          group: "Core",
          label: "AI provider",
          required: true,
          state: "missing",
          detail: "No AI key is set, so extraction and drafting fail.",
          fix: "Add OPENAI_API_KEY.",
        },
    has("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") && has("CLERK_SECRET_KEY")
      ? { id: "auth", group: "Core", label: "Sign-in (Clerk)", required: true, state: "on", detail: "Publishable and secret keys set." }
      : {
          id: "auth",
          group: "Core",
          label: "Sign-in (Clerk)",
          required: true,
          state: "missing",
          detail: "A Clerk key is missing.",
          fix: "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.",
        },
    has("NEXT_PUBLIC_SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY")
      ? {
          id: "storage",
          group: "Core",
          label: "File storage (Supabase)",
          required: true,
          state: "on",
          detail: `Bucket "${process.env.SUPABASE_RFP_BUCKET?.trim() || "rfp-uploads"}".`,
        }
      : {
          id: "storage",
          group: "Core",
          label: "File storage (Supabase)",
          required: true,
          state: "missing",
          detail: "Uploads fail without storage.",
          fix: "Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
    {
      id: "admins",
      group: "Core",
      label: "Admin access",
      required: true,
      state: admins.length ? "on" : "missing",
      detail: admins.length ? `${admins.length} admin email${admins.length === 1 ? "" : "s"} in ADMIN_EMAILS.` : "Nobody can open /admin.",
      fix: admins.length ? undefined : "Add ADMIN_EMAILS with your sign-in email.",
    },
    review
      ? { id: "review", group: "Growth", label: "Review request", required: false, state: "on", detail: `Card sends people to ${hostOf(review)}.` }
      : rawReviewUrl
        ? {
            id: "review",
            group: "Growth",
            label: "Review request",
            required: false,
            state: "invalid",
            detail: "REVIEW_URL is set but is not a full https:// link, so the card stays off.",
            fix: "Use the complete link, starting with https:// (e.g. https://forms.gle/…).",
          }
        : {
            id: "review",
            group: "Growth",
            label: "Review request",
            required: false,
            state: "off",
            detail: "The review card after an export is switched off.",
            fix: "Add REVIEW_URL (a Google Form, Trustpilot, or G2 link starting with https://).",
          },
    support
      ? { id: "feedback", group: "Growth", label: "Private feedback email", required: false, state: "on", detail: `Feedback goes to ${support}.` }
      : {
          id: "feedback",
          group: "Growth",
          label: "Private feedback email",
          required: false,
          state: rawSupport ? "invalid" : "off",
          detail: rawSupport ? "SUPPORT_EMAIL is not a valid email address." : 'The "Send private feedback" option is hidden.',
          fix: "Add SUPPORT_EMAIL, e.g. your Gmail address.",
        },
    {
      id: "spend-alerts",
      group: "Growth",
      label: "Spend-cap alerts",
      required: false,
      state: has("ALERT_WEBHOOK_URL") ? "on" : "off",
      detail: has("ALERT_WEBHOOK_URL")
        ? "Alerts post to your webhook when an account hits its AI cap."
        : "Cap alerts only appear in the logs and on the Alerts page.",
      fix: has("ALERT_WEBHOOK_URL") ? undefined : "Optional: add ALERT_WEBHOOK_URL (a Slack incoming webhook).",
    },
    has("NEXT_PUBLIC_SENTRY_DSN")
      ? { id: "sentry", group: "Monitoring", label: "Error alerts (Sentry)", required: false, state: "on", detail: "Errors are reported to Sentry." }
      : {
          id: "sentry",
          group: "Monitoring",
          label: "Error alerts (Sentry)",
          required: false,
          state: "off",
          detail: "Errors are only in the Vercel logs; nobody is emailed.",
          fix: "Add NEXT_PUBLIC_SENTRY_DSN from Sentry > Project settings > Client Keys.",
        },
    {
      id: "sourcemaps",
      group: "Monitoring",
      label: "Readable error traces",
      required: false,
      state: sourceMaps ? "on" : "off",
      detail: sourceMaps ? "Source maps upload to Sentry at build time." : "Sentry errors show compiled code locations.",
      fix: sourceMaps ? undefined : "Optional: add SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT.",
    },
    {
      id: "analytics",
      group: "Monitoring",
      label: "Visitor analytics",
      required: false,
      state: "info",
      detail: "Installed in the app. It records visits once Analytics is enabled for the project in Vercel.",
      fix: "Vercel > your project > Analytics > Enable.",
    },
  ];

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  return {
    checks,
    blocking: checks.filter((check) => check.required && check.state !== "on").length,
    optionalOff: checks.filter((check) => !check.required && (check.state === "off" || check.state === "invalid")).length,
    deployment: {
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      commit: commit ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    },
  };
}

/** For the sidebar badge: settings that are required but missing, or set incorrectly. */
export async function getSetupAttentionCount() {
  const { checks } = await getSetupStatus();
  return checks.filter((check) => (check.required && check.state !== "on") || check.state === "invalid").length;
}

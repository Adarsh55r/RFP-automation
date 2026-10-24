import { safeErrorSummary } from "@/lib/safe-log";
import * as Sentry from "@sentry/nextjs";

/**
 * Runs once when a server instance starts, before it serves requests.
 * Starts error reporting, then upgrades an older database in place so a
 * deploy never runs new code against an old schema.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }
  try {
    const { upgradeSchemaIfNeeded } = await import("@/lib/schema-upgrade");
    await upgradeSchemaIfNeeded();
  } catch (error) {
    console.error("[schema-upgrade] Could not upgrade the database schema:", safeErrorSummary(error));
    Sentry.captureException(error);
  }
}

/** Sends uncaught errors from server components, route handlers, and actions to Sentry. */
export const onRequestError = Sentry.captureRequestError;

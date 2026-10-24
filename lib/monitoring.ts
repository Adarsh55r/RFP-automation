import * as Sentry from "@sentry/nextjs";
import { MAX_LOGGED_MESSAGE } from "@/lib/safe-log";

/** Same DSN for browser and server; the DSN is not a secret. Sentry stays off until it is set. */
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

/** Options shared by the browser, Node, and edge Sentry clients. */
export const sentryBaseOptions = {
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Errors only: no performance tracing or session replay, so no proposal content leaves the app.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event: Sentry.ErrorEvent) {
    return scrubEvent(event);
  },
  beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
    return scrubBreadcrumb(breadcrumb);
  },
};

/**
 * Removes anything that could carry document content from an error report:
 * request bodies and cookies, long exception messages (a failed database
 * write or JSON parse can quote its input), and free-form extra data.
 */
export function scrubEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value && exception.value.length > MAX_LOGGED_MESSAGE) {
      exception.value = `${exception.value.slice(0, MAX_LOGGED_MESSAGE)}… [truncated]`;
    }
  }
  if (event.message && event.message.length > MAX_LOGGED_MESSAGE) {
    event.message = `${event.message.slice(0, MAX_LOGGED_MESSAGE)}… [truncated]`;
  }
  delete event.extra;
  return event;
}

/** Console messages and request bodies never become breadcrumbs. */
export function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.data) {
    // Keep only the method, URL and status of network calls.
    const { method, url, status_code } = breadcrumb.data as Record<string, unknown>;
    breadcrumb.data = { method, url, status_code };
  }
  return breadcrumb;
}

/**
 * Reports an error that the app caught and turned into a friendly message,
 * so it still reaches Sentry. Only the account id is attached, never content.
 */
export function reportError(
  error: unknown,
  context: { area: string; userId?: string; rfpId?: string; extra?: Record<string, string | number> },
) {
  if (!sentryDsn) return;
  Sentry.withScope((scope) => {
    scope.setTag("area", context.area);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.rfpId) scope.setTag("rfpId", context.rfpId);
    if (context.extra) scope.setContext("details", context.extra);
    Sentry.captureException(error);
  });
}

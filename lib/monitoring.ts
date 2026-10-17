import * as Sentry from "@sentry/nextjs";

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
    // Never send request bodies or cookies (they can contain RFP text or session tokens).
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
};

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

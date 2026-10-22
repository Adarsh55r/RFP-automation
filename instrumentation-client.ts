import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/monitoring";

Sentry.init({
  ...sentryBaseOptions,
  ignoreErrors: [
    // Browser noise that is not a DraftBid AI bug.
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
});

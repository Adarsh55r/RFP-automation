import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/lib/monitoring";

Sentry.init(sentryBaseOptions);

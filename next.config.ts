import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep PDF libs external so webpack does not rebundle pdf.js or pdfmake.
  serverExternalPackages: ["unpdf", "pdfjs-dist", "pdfmake"],
};

// Uploading source maps (readable stack traces in Sentry) needs a Sentry auth
// token at build time. Without one the build is left exactly as it was.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default uploadSourceMaps
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      telemetry: false,
    })
  : nextConfig;

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "athletix",
  project: "javascript-nextjs",

  // Only log source-map upload in CI.
  silent: !process.env.CI,

  // Prettier stack traces (slightly slower builds).
  widenClientFileUpload: true,

  // Route browser error reports through our own domain to dodge ad-blockers on
  // field phones. M1's middleware MUST exclude /monitoring from auth, or client
  // error reporting breaks.
  tunnelRoute: "/monitoring",

  // No `webpack: {...}` block: this project builds with Turbopack, where Sentry's
  // webpack-only options (treeshake, automaticVercelMonitors) are inert and warn.
});

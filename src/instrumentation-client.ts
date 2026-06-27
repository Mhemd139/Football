// Sentry init for the browser — runs whenever a user loads a page. This is the
// field-phone capture (React crashes, unhandled rejections). Shares the hardened
// options (errors-only, PII scrub, prod-gating).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/monitoring/sentry-options";

Sentry.init(sentryInitOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

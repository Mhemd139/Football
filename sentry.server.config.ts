// Sentry init for the Node.js server runtime. Used whenever the server handles a
// request. Options (errors-only, privacy scrub, prod-gating) live in one shared
// module so client/server/edge can't drift. https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/monitoring/sentry-options";

Sentry.init(sentryInitOptions);

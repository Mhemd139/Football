// Sentry init for the edge runtime (middleware, edge routes). Required even when
// running locally. Shares the same hardened options as server/client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sentryInitOptions } from "@/lib/monitoring/sentry-options";

Sentry.init(sentryInitOptions);

import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Shared Sentry init options for client / server / edge runtimes. One source so
// the privacy scrub and the gating can't drift across the three config files.
//
// Errors-only, privacy-first: this app holds minors' data, so default-deny what
// leaves the device (Seqaya Android pattern) rather than allow-list what to drop.

// PII field names that must never reach Sentry. Matches the players/profiles
// schema (src/lib/supabase/types.ts). Scrubbing an absent field is a no-op, so
// this also covers legacy event shapes (e.g. the dropped guardian_name).
const PII_KEYS = [
  "national_id",
  "guardian_phone",
  "guardian_name",
  "phone",
  "guardian_name_ar",
] as const;

// Exported for tests — this is the guard that keeps minors' PII out of Sentry.
export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = (PII_KEYS as readonly string[]).includes(k) ? "[scrubbed]" : scrub(v);
    }
    return out;
  }
  return value;
}

function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  // Default-deny the auto-attached fingerprinting/PII surfaces.
  if (event.user) {
    // Keep only the Supabase user id + role we set deliberately; drop ip/email/etc.
    event.user = { id: event.user.id, ...(event.user.role ? { role: event.user.role } : {}) };
  }
  if (event.request?.cookies) delete event.request.cookies;
  if (event.request?.headers) {
    delete event.request.headers["cookie"];
    delete event.request.headers["authorization"];
  }
  // Deep-scrub any PII fields the SDK swept into extra/contexts.
  if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
  return event;
}

// DSN is public (it only lets clients SEND events), so reading the literal the
// wizard wrote is fine — but env wins so prod/preview can override per Vercel.
const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  process.env.SENTRY_DSN ??
  "https://42a029f2bf41723a2db61916f971175c@o4511636083965952.ingest.de.sentry.io/4511636107034704";

// Gate: send nothing outside production. Dev/preview crashes stay local, so we
// never burn the free-tier quota during the build and never leak dev data.
const enabled = process.env.NODE_ENV === "production";

export const sentryInitOptions = {
  dsn,
  enabled,
  sendDefaultPii: false,
  // Errors-only — no tracing, no replay, no logs (free-tier + privacy).
  tracesSampleRate: 0,
  beforeSend,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
};

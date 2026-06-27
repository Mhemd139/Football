# Keeper — Crash Visibility + Test Harness — Design

> **Agent:** 🧤 Keeper — reliability/observability/test. Fifth agent on TFC Manager
> (alongside Sweeper=backend, Loom=UI, Pitch=motion/a11y, Atlas=PM/UX).
> Keeper catches what gets past Sweeper's invariants and makes it visible: runtime
> crashes, failed tests, broken health signals. Last line, sees the whole pitch.
>
> **Date:** 2026-06-27 · **Status:** approved design, ready for implementation plan.

---

## 1. Problem

Two needs, one root cause — we can't see what breaks:

1. **Owner, remote:** when the app crashes on a coach's or parent's phone in the
   field, the owner has no way to know *why* from far away. Today: a white screen
   and a "it stopped working" phone call.
2. **Agents, token cost:** to know what's broken and where, an agent must re-read
   the codebase or the owner must paste stack traces. Both burn tokens. We want a
   compact, grouped signal — *this file, this line, this often* — to act on directly.

Both solved by one tool: **Sentry** (`@sentry/nextjs`). Sentry groups errors by
exact `file:line` + route with frequency, enriched with device/role/locale context.
The owner reads the dashboard; the agent reads the issue and goes straight to the
broken code.

**Prior art check:** the sibling `C:\Dev\basketball` repo has **no** crash
monitoring (no `@sentry/*` dep, no `captureException`, plain `next.config.ts`,
no DSN). Nothing to copy. TFC Manager is the first to get this.

## 2. Scope (locked)

- **Errors only.** No performance tracing, no session replay.
  - *Why:* lightest footprint, stays inside the free tier (5k errors/mo), and —
    critically — **never records the screens of a child-data app.** Replay on an
    app holding minors' names/IDs is a privacy liability, not a feature.
- **Privacy scrub (non-negotiable):** `sendDefaultPii: false` + a `beforeSend` hook
  that drops `phone`, `national_id`, `guardian_phone`, `guardian_name` from any
  event before it leaves the device. This app holds minors' data.
- **One vendor.** No custom `error_events` table, no bespoke dashboard, no graphify
  graph for this. Sentry's own dashboard is the "graph."

## 3. Architecture — Sentry wiring (Next.js 16, App Router)

Next 16 exposes three capture points; `@sentry/nextjs` wires all three. Verified
against `node_modules/next/dist/docs` — not assumed from training data.

| File | New/Edit | Runtime | Catches |
|---|---|---|---|
| `src/instrumentation-client.ts` | new | browser (the phones) | React render crashes, unhandled rejections, `window.onerror` — **the field-phone capture** |
| `instrumentation.ts` | new | server (Node + Edge) | `register()` boots server SDK; `onRequestError` reports Server Component / Server Action / route-handler errors |
| `sentry.server.config.ts` | new | Node | server SDK init (DSN, scrub, release) |
| `sentry.edge.config.ts` | new | Edge | edge SDK init (middleware/edge routes) |
| `next.config.ts` | edit | build | wrap export: `withSentryConfig(withNextIntl(nextConfig))` — uploads source maps so minified `a.b.c` → `attendance-screen.tsx:142` |

**Composition is load-bearing:** the existing `withNextIntl(...)` plugin must stay
exactly as-is; Sentry wraps *outside* it. Final: `withSentryConfig(withNextIntl(nextConfig))`.

### 3.1 Context enrichment — make each crash useful

Attached to every event:

- **User:** `Sentry.setUser({ id: auth.uid(), role })` set once after OTP verify
  (in the verify path that already establishes the session). Lets the owner filter
  "crashed for a *parent*" vs "for the coach." Only the Supabase user id + role —
  no PII.
- **Locale tag:** `ar` / `he`. RTL bugs often reproduce in only one language;
  this makes them filterable.
- **Route:** automatic from the Sentry Next integration.
- **Release:** Vercel git SHA (`VERCEL_GIT_COMMIT_SHA`), so a crash maps to the
  deploy that introduced it.

### 3.2 React error boundaries — catch client crashes gracefully

TFC has `loading.tsx` throughout but **no `error.tsx` / `global-error.tsx`**.
Without them a render crash = white screen, which violates the global constraint
"no blank screens ever" (plan.md §3, CLAUDE.md). These boundaries do double duty:
satisfy that constraint *and* are the client capture point feeding Sentry.

- `src/app/global-error.tsx` (new) — catastrophic layout crash → report to Sentry
  → warm RTL "something went wrong" fallback. Must render its own `<html dir>` /
  `<body>` (it replaces the root layout when it fires).
- `src/app/(app)/error.tsx` (new) — per-screen crash inside the app shell →
  report to Sentry → fallback with a **retry** affordance (`reset()`), not a dead
  screen. Bilingual copy via the existing next-intl catalogs.

Both call `Sentry.captureException(error)` in an effect, keyed on `error.digest`
so the same crash isn't double-reported on re-render.

## 4. Architecture — Test harness (Keeper's standing job)

TFC has **no tests yet**. BasketBall uses Vitest + Playwright; we mirror that stack.

- **Vitest** — unit + invariant tests. Config + first smoke test that proves the
  runner works. Sweeper writes the DB-invariant/RLS tests per plan.md §4 (money
  category invariant, offline-replay dedup, parent read-scope); **Keeper owns the
  harness they run in**, the config, and regression coverage on shared logic
  (e.g. the `<Money>` formatter, locale/numeral rendering).
- **Playwright** — e2e for the gate-critical no-think flows once screens exist
  (attendance ≤ 60s, 2-tap payment). **Not built now** — scaffolded when there's a
  flow to drive. Listed here so the harness decision is recorded, not so we build
  ahead of need (YAGNI).

This spec **implements the Sentry half + the Vitest harness skeleton**. Playwright
e2e and the per-milestone invariant tests are follow-on work, tracked but not in
this plan's code.

## 5. What this spec does NOT do (YAGNI)

Performance tracing · session replay · custom error table · bespoke dashboard ·
graphify graph · Playwright e2e flows (deferred) · CI pipeline wiring (follow-on) ·
alerting/Slack/email routing (Sentry defaults suffice for one owner).

## 6. Setup dependency (needs the owner)

The Sentry SDK install is a CLI wizard requiring a **Sentry account + project DSN**.
Keeper writes all code and config; the owner must either complete the wizard login
or paste a DSN into `.env.local` (`NEXT_PUBLIC_SENTRY_DSN`, plus
`SENTRY_AUTH_TOKEN` for source-map upload). **No secret is committed** — env only,
matching the project's existing rule. The plan will flag the exact stop point.

## 7. Acceptance criteria

- A thrown error in a Server Action appears in Sentry with the real `file:line`
  (source maps working), route, role, and locale.
- A forced client render crash on a phone viewport appears in Sentry **and** shows
  the warm RTL fallback (no white screen).
- `national_id` / phone / guardian fields are **absent** from the captured event
  payload (scrub verified).
- `withNextIntl` still functions — AR/HE + RTL unaffected by the config wrap.
- `npm run test` runs Vitest green on a smoke test.
- No DSN/secret committed to git.

## 8. Open follow-ons (tracked, not in this plan)

- Sweeper's per-milestone invariant/RLS tests (M3 dedup, M4 money invariant, M7
  parent-scope) — run in Keeper's harness.
- Playwright e2e for the North Star flows once M3/M4 screens land.
- CI wiring (run tests + typecheck on PR) when the team wants a gate.

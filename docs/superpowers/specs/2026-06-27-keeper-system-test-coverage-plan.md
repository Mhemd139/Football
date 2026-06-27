# Keeper — System Test Coverage Plan

> **Agent:** 🧤 Keeper (reliability/tests). **Date:** 2026-06-27.
> Goal (owner's words): "tests across the whole system for performance and other metrics."

## Honest scope first (what "performance tests" should and shouldn't mean here)

The owner asked for performance + metrics tests across the system. A naive reading —
synthetic load tests, k6 against the DB, Lighthouse CI — would be **mostly wasted** on
this app, and I won't build theatre. Why:

- It's a **single-club** app (one coach, ~tens of users, free Supabase tier). There is no
  concurrency/throughput problem to load-test. Hammering it with 10k virtual users proves
  nothing real.
- The product's actual performance contract is **one number**: attendance for 22 players
  in **≤ 60 s** (plan.md North Star) — a *client interaction* budget, not server throughput.
- Vercel/Sentry already give real-world latency + Web Vitals on the production deploy. I
  don't need to reinvent that with a synthetic rig.

So I'm translating "performance and other metrics" into what actually protects this system:
**fast, deterministic tests on the highest-consequence logic, plus performance *budgets* on
the one path where speed is a product promise.** Correctness of the money/attendance/locale
metrics is the real ask hiding inside "metrics."

## Layers (built in order, highest-consequence first)

### Layer 1 — Money logic (the 3am-sign-bug guard) — HIGHEST PRIORITY
Pure, DB-free, highest-consequence code in the app: `src/lib/money/actions.ts` has
`money()` (rounds to 2dp so float sums stay exact at agora precision), `sumPayments`, and
the balance/status derivation (`paid | partial | overdue | upcoming`, `remaining = due −
paid`). A rounding or status bug here mis-states what a parent owes — the exact failure the
two-table money design exists to prevent. Extract the pure helpers if needed and unit-test:
- `money()` rounds half-up at 2dp; `0.1 + 0.2` style float error never leaks.
- `sumPayments` over [] = 0; over partial payments = exact.
- status derivation: fully paid → `paid`; partial → `partial`; past due_date unpaid →
  `overdue`; future → `upcoming`; remaining never negative on overpay.

### Layer 2 — Offline queue invariant (the North Star durability spine)
`src/lib/events/queue.ts` — the IndexedDB attendance queue. The subtle, breakable bit is
**dedup + the `queued_at`-match-before-delete** guard (a row re-marked mid-sync must survive
the post-sync delete). Test with `fake-indexeddb` (Node, deterministic):
- enqueue same `client_id` twice → one row (dedup), latest wins.
- drain deletes only rows whose `queued_at` matches what synced; a row re-queued during the
  (mocked) `syncAttendance` call is preserved, not clobbered.
- drain on empty queue = no-op; `getQueuedCount` reflects pending rows.
- `syncAttendance` mocked — this tests the queue's durability/dedup logic, not the network.

### Layer 3 — Numeral / locale rendering (Atlas's `.num` invariant)
Western numerals must render even in Arabic UI (`3500`, not `٣٥٠٠`) and stay LTR-isolated in
RTL (memory: western-numerals-rule). Whatever formats money/numbers is the unit under test:
- numbers render as Western digits under both `ar` and `he` locales.
- the bidi-isolation wrapper (`.num`) is applied to numeric runs, not surrounding text.
(If formatting is inline in components, test the smallest extractable formatter; don't mount
whole screens — that's Layer 4's job if at all.)

### Layer 4 — Performance budget (the ≤60s promise, as a guardrail not a load test)
One micro-benchmark, not a load test: assemble a 22-row attendance batch and measure the
**pure client-side cost** of `enqueueAttendance` + `drainQueue` (with `syncAttendance`
mocked to a fixed small delay) against `fake-indexeddb`. Assert it completes well under a
generous budget (e.g. < 500 ms for the queue ops over 22 rows) so a future O(n²) regression
in the queue is caught. This guards the *code path's* contribution to the 60s budget; the
real end-to-end 60s gate stays a human on-phone test (Atlas's M3 checklist) — a unit test
can't prove thumb-reach speed, and I won't pretend it does.

## Explicitly NOT building (YAGNI / would be theatre)
Synthetic load tests (k6/artillery) · Lighthouse CI · DB throughput benchmarks · mounting
full screens to "measure render" · perf assertions with flaky wall-clock thresholds on CI.
Real latency/Web-Vitals come from Sentry + Vercel on prod, already live.

## Harness notes
- Vitest (already wired, `npm test`). Add `fake-indexeddb` as the only new devDep (Layers 2 & 4).
- Layer 1 & 3 are `environment: node`; Layers 2 & 4 import `fake-indexeddb/auto`.
- Sweeper owns the **DB-side** invariant tests (`supabase/tests/*.sql`) — I do NOT duplicate
  them in JS. My layer is the pure app logic + client paths that SQL tests can't reach.

## Done = every layer green under `npm test`, committed on a branch, Playground updated.

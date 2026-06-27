# Keeper — Fool-Proofing (Negative/Adversarial Test) Attack Plan

**Status:** PLANNED — held until `sweeper-overpay-credit-roster-split` merges to `main`.
**Owner:** Keeper 🧤  ·  **Date:** 2026-06-28
**Decision (owner):** Logic layer only (Vitest). Expose + report holes; do NOT fix app code (Sweeper's lane). Write the pass once, against the final merged shape — not a moving target.

## Why hold
On `sweeper-overpay-credit-roster-split`, the pure money helpers (`money`, `sumPayments`,
`deriveStatus`, `deriveBalance`, `monthDueDate`) are **private + inlined** inside the
`"use server"` `src/lib/money/actions.ts`, and `numerals.ts`/`balance.ts` (extracted on
`keeper-system-test-coverage`) don't exist here. Testing them now means either editing
Sweeper's live file (out of lane) or testing code that changes on his next commit. So the
money/cheque/overpay attacks wait for merge; only the branch-independent targets are ready.

## The principle
A fool-proofing test feeds a boundary **garbage or hostile input** and asserts the code
either rejects it cleanly (typed error / `null`) or handles it safely — **never** silently
corrupts state, returns a malformed value, or throws unhandled. The test is the alarm, not
the fix. Passing = already guarded. Failing = a real hole → reported to Sweeper/Atlas.

---

## Target 1 — `normalizeIsraeliPhone` (src/lib/auth/phone.ts)  [READY — no Sweeper dep]
Pure, exported, raw-user-input. Contract: return valid E.164 `+972XXXXXXXXX` or `null`.

| Input | Coach reality | Assert |
|---|---|---|
| `""` / `"   "` | empty / whitespace submit | `null` (no throw) |
| `"+"` | typed a plus, nothing else | `null` |
| `"052-348-1100"` | dashes | `+972523481100` |
| `"+972523481100"` / `"972523481100"` / `"523481100"` | every accepted shape | `+972523481100` |
| `"٠٥٢٣٤٨١١٠٠"` (Arabic-Indic digits) | **bilingual landmine** — Arabic keyboard | ⚠️ currently `null` (regex `\D` strips them). Likely a REAL hole in an Arabic-primary app. Flag to Sweeper/Atlas. |
| `"052abc3481100"` | letters spliced in | `null` (not a malformed `+972`) |
| `"0000000000000"` | all zeros, long | `null` |
| `"03-6510000"` (landline, starts 3) | wrong number type | `null` (national must start with 5) |
| `"00972523481100"` | intl `00` prefix | document actual: `00…` → national starts `0`→sliced→`0972…` len≠9 → `null`. Decide if `00` should be accepted. |
| 10 000-char string | paste accident / abuse | `null`, returns fast (no hang) |

**Headline finding (pre-verified by reading the code):** Arabic-Indic digits are stripped →
a valid number typed in Arabic numerals is silently rejected. In an Arabic-primary RTL app
this is a plausible real-user failure. Report; fix is Sweeper's (normalize Arabic digits to
Western before the regex — ties to the western-numerals rule).

## Target 2 — Offline attendance queue (src/lib/events/queue.ts)  [READY — no Sweeper dep]
Already covered by `queue.test.ts` on the keeper branch; extend with abuse cases.

- `enqueueAttendance(eventId, [])` — empty rows: commits a no-op, drain stays clean.
- enqueue with `eventId = ""` — does a blank event id poison the store?
- drain with `syncAttendance` rejecting (network/server error) — rows are KEPT, error propagates (no silent swallow).
- `queued_at` sub-ms collision (already flagged) — two re-marks same ms get identical stamp; the match-before-delete guard can over-delete. Narrow but real.
- drain a store with a row missing `client_id` (corrupt/old-schema row) — no unhandled throw.

## Target 3 — Money / cheque / overpay  [BLOCKED until Sweeper merges]
Attack the FINAL merged `actions.ts` surface. Requires the helpers be importable (ask
Sweeper to export them, or re-extract to `balance.ts` post-merge — coordinate, don't fork).

- `money("abc")` → `NaN`-corruption check. `money("")`, `money(" 150 ")`, `money(null as any)`.
- `recordPayment` amount: `0`, negative, `NaN`, `Infinity`, string `"abc"`, `"١٥٠"` (Arabic), `1e308`.
- `recordPayment` method: unknown method string, empty, casing (`"CASH"`).
- cheque path: `method:"cheque"` with empty/whitespace `chequeNumber` → must reject (`cheque_number_required`), not save a numberless cheque.
- `generateDues("not-a-date")`, `generateDues("")`, `generateDues("2026-13-99")` → `invalid_input`, not a crash / bad due_date.
- overpay: pay > due → `overpaid` status, `remaining === 0`, `credit === surplus` (the fix Sweeper just made — lock it with a regression test).
- `updateClubSettings({ default_dues: -1 })`, `NaN`, huge → rejected.

## Target 4 — Numeral formatter `fmtNumber`  [BLOCKED — inlined in money-screen on this branch]
After it's extractable: `fmtNumber(NaN)`, `fmtNumber(Infinity)`, negative, huge, and the
core contract — output is ALWAYS Western digits regardless of locale (Arabic UI included).

---

## Execution order (post-merge)
1. New Keeper branch off updated `main` (carries the existing 30 + these).
2. Targets 1 & 2 first (ready now, no dep) — but bundled into the one pass, not fragmented.
3. Targets 3 & 4 once helpers are importable.
4. Run `npm test`. Green = guarded. Red = hole → report to Sweeper (code) / Atlas (product calls like "should `00` intl prefix be accepted", "is overpay a credit").
5. Never fix app code here. Tests expose; Sweeper fixes.

// Pure money math — no DB, no server deps — so the highest-consequence logic in
// the app (what a parent owes) is unit-testable in isolation. The server actions
// in actions.ts import these; the values come from the DB but the arithmetic and
// status derivation live here, where a rounding/sign bug can be caught by a test
// before it ever mis-states a balance.

export type DueStatus = "paid" | "partial" | "overdue" | "upcoming";

// Coerce a money value to a number at the read boundary. PostgREST may serialize
// numeric as a string to preserve precision; Number() normalizes both
// ("150.00" and 150 -> 150). Round to 2dp to keep float sums exact at agora
// precision (so 0.1 + 0.2 never leaks 0.30000000000000004 into a balance).
export const money = (v: number | string): number =>
  Math.round(Number(v) * 100) / 100;

export function sumPayments(payments: { amount: number | string }[]): number {
  return money(payments.reduce((acc, p) => acc + Number(p.amount), 0));
}

// Past due = the due date is strictly before today (date-only comparison, no tz
// skew from comparing a date string to a full timestamp). `today` is injectable
// so the rule is testable without mocking the clock.
export function isPastDue(dueDate: string, today = new Date().toISOString().slice(0, 10)): boolean {
  return dueDate < today;
}

export function deriveStatus(
  amountDue: number,
  paid: number,
  dueDate: string,
  today?: string,
): DueStatus {
  if (paid >= amountDue) return "paid";
  if (paid > 0) return "partial";
  // unpaid: overdue once the due date has passed, otherwise still upcoming.
  return isPastDue(dueDate, today) ? "overdue" : "upcoming";
}

// remaining = due − paid, rounded. Faithful to actions.ts (NOT clamped at 0 — an
// overpayment yields a negative remaining today). Keeper flagged the negative-on-
// overpay edge to Sweeper/Atlas; not changing money behavior under a test task.
export function remaining(due: number, paid: number): number {
  return money(due - paid);
}

// Default due date: the 10th of the period's month.
export function monthDueDate(period: string): string {
  const d = new Date(period);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 10))
    .toISOString()
    .slice(0, 10);
}

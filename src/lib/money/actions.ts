"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/supabase/types";

export type Due = Omit<Tables<"dues">, "created_at">;
export type Salary = Omit<Tables<"salaries">, "created_at">;
export type PaymentMethod = Enums<"payment_method">;
export type PaymentStatus = Enums<"payment_status">;
export type DueStatus = "paid" | "partial" | "overdue" | "upcoming" | "overpaid";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Who the row belongs to — embedded so the UI renders a name, not a UUID. The
// list/overdue rows carry this; the per-row balance reads don't need it.
type PlayerRef = { full_name: string; jersey_number: number | null };

const DUE_COLUMNS = "id, player_id, period, amount_due, due_date";
const SALARY_COLUMNS = "id, player_id, period, amount, paid_at";
// Player embed for the list rows (PostgREST to-one join, same pattern as
// getEventRoster). FK players.id ← dues/salaries.player_id is to-one → a single
// object, not an array.
const PLAYER_EMBED = "player:players!inner(full_name, jersey_number)";

// The staff member who logged a payment — shown in the ledger for cash
// accountability ("which coach took this money"). null only for legacy M4 rows
// that predate recorded_by being populated.
type Actor = { full_name: string | null };

// A logged payment as the coach/owner ledger renders it: who paid, how much, by
// what method + status, its cheque number (cheques only), when, and which staff
// member logged it. The player name, due's period, and logger name come from
// embeds so a row reads without extra queries.
export type LedgerPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  cheque_number: string | null;
  paid_at: string;
  period: string;
  player: PlayerRef;
  recorded_by: Actor | null;
};

// payment → due → player (to-one hops, FK on the child side → nested objects, not
// arrays; !inner drops orphans). recorded_by → profiles is a SEPARATE to-one embed
// with an explicit FK hint (payments has two FKs — to dues and to profiles — so
// the hint disambiguates). Left join (no !inner): legacy rows have a null logger.
const LEDGER_EMBED =
  "due:dues!inner(period, player:players!inner(full_name, jersey_number)), " +
  "recorded_by:profiles!payments_recorded_by_fkey(full_name)";

type RawLedgerRow = {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  cheque_number: string | null;
  paid_at: string;
  due: { period: string; player: PlayerRef };
  recorded_by: Actor | null;
};

// Shape a raw payment+embed row into the ledger row the UI renders. Coerces money
// at the boundary (see `money`).
function toLedgerPayment(p: RawLedgerRow): LedgerPayment {
  return {
    id: p.id,
    amount: money(p.amount),
    method: p.method,
    status: p.status,
    cheque_number: p.cheque_number,
    paid_at: p.paid_at,
    period: p.due.period,
    player: p.due.player,
    recorded_by: p.recorded_by,
  };
}

// A balance is amount_due minus the sum of its payments; status is derived, never
// stored (it would drift on every payment and at every midnight). `credit` is the
// surplus when a coach overpaid (cash-at-pitch reality) — kept explicit so the
// money screen never shows the ambiguous "paid" + negative-remaining combo.
type Balance = {
  due: number;
  paid: number;
  remaining: number;
  credit: number;
  status: DueStatus;
};

// Coerce a money value to a number at the read boundary. PostgREST may serialize
// numeric as a string to preserve precision; the generated types say `number`.
// Number() normalizes both ("150.00" and 150 -> 150) so the math is never string
// concatenation. Round to 2dp to keep float sums exact at agora precision.
const money = (v: number | string): number =>
  Math.round(Number(v) * 100) / 100;

// Derive the balance shape from due + paid + due date. One source of truth so the
// per-row and list reads can't drift. `remaining` is floored at 0 (never a bare
// negative — that's the ambiguous money state product-context forbids); the
// surplus surfaces as `credit` with its own `overpaid` status instead.
function deriveBalance(
  due: number,
  paid: number,
  dueDate: string,
): { remaining: number; credit: number; status: DueStatus } {
  const credit = money(Math.max(0, paid - due));
  const remaining = money(Math.max(0, due - paid));
  return { remaining, credit, status: deriveStatus(due, paid, dueDate) };
}

function deriveStatus(amountDue: number, paid: number, dueDate: string): DueStatus {
  if (paid > amountDue) return "overpaid";
  if (paid >= amountDue) return "paid"; // exact (paid === due, includes 0-due case)
  if (paid > 0) return "partial";
  // unpaid: overdue once the due date has passed, otherwise still upcoming.
  return isPastDue(dueDate) ? "overdue" : "upcoming";
}

// Past due = the due date is strictly before today (date-only comparison, no tz
// skew from comparing a date string to a full timestamp).
function isPastDue(dueDate: string): boolean {
  return dueDate < new Date().toISOString().slice(0, 10);
}

// ── Generation (owner-triggered, idempotent) ───────────────────────────────

// One dues row per active kid (beet_sefer/league) at the club default, for the
// given month. Re-running the same period is a no-op (UNIQUE(player_id, period)).
export async function generateDues(
  period: string,
): Promise<Result<{ created: number; skipped: number }>> {
  if (Number.isNaN(new Date(period).getTime())) {
    return { ok: false, error: "dues.invalid_input" };
  }
  const supabase = await createClient();

  const [settings, kids] = await Promise.all([
    supabase.from("club_settings").select("default_dues").eq("id", true).single(),
    supabase
      .from("players")
      .select("id, teams!inner(category)")
      .eq("active", true)
      .in("teams.category", ["beet_sefer", "league"]),
  ]);
  if (settings.error || kids.error) {
    console.error("generateDues load failed:", settings.error ?? kids.error);
    return { ok: false, error: "dues.load_failed" };
  }

  if (kids.data.length === 0) return { ok: true, data: { created: 0, skipped: 0 } };

  const due_date = monthDueDate(period);
  const amount_due = money(settings.data.default_dues);
  const rows = kids.data.map((k) => ({
    player_id: k.id,
    period,
    amount_due,
    due_date,
  }));

  const { data, error } = await supabase
    .from("dues")
    .upsert(rows, { onConflict: "player_id,period", ignoreDuplicates: true })
    .select("id");
  if (error) {
    console.error("generateDues save failed:", error);
    return { ok: false, error: "dues.save_failed" };
  }
  return { ok: true, data: { created: data.length, skipped: kids.data.length - data.length } };
}

// One salary row per active Bogrim that HAS a salary set. A Bogrim with no salary
// is skipped + counted (never zeroed) so the UI can prompt the owner to set it.
export async function generateSalaries(
  period: string,
): Promise<Result<{ created: number; skipped: number }>> {
  if (Number.isNaN(new Date(period).getTime())) {
    return { ok: false, error: "salaries.invalid_input" };
  }
  const supabase = await createClient();

  const { data: bogrim, error } = await supabase
    .from("players")
    .select("id, monthly_salary, teams!inner(category)")
    .eq("active", true)
    .eq("teams.category", "bogrim");
  if (error) {
    console.error("generateSalaries load failed:", error);
    return { ok: false, error: "salaries.load_failed" };
  }

  const rows = bogrim
    .filter((b) => b.monthly_salary != null)
    .map((b) => ({ player_id: b.id, period, amount: b.monthly_salary as number }));
  if (rows.length === 0) return { ok: true, data: { created: 0, skipped: bogrim.length } };

  const { data, error: saveErr } = await supabase
    .from("salaries")
    .upsert(rows, { onConflict: "player_id,period", ignoreDuplicates: true })
    .select("id");
  if (saveErr) {
    console.error("generateSalaries save failed:", saveErr);
    return { ok: false, error: "salaries.save_failed" };
  }
  return { ok: true, data: { created: data.length, skipped: bogrim.length - data.length } };
}

// ── Payments ────────────────────────────────────────────────────────────────

// Record a payment against a dues row. client_id is client-generated + UNIQUE so
// an offline replay never double-charges. Returns the recomputed balance.
// Cash/transfer arrive 'cleared' (they count immediately). A cheque arrives
// 'pending' and MUST carry its number — the number is how a bounced cheque is
// later traced back to its player (the DB CHECK enforces this too; we reject
// early for a clean error). The number is meaningless for cash/transfer, so it's
// dropped there to satisfy the same constraint.
export async function recordPayment(input: {
  dueId: string;
  amount: number;
  method: PaymentMethod;
  clientId: string;
  chequeNumber?: string;
}): Promise<Result<Balance>> {
  const dueId = input.dueId?.trim();
  const clientId = input.clientId?.trim();
  if (!dueId || !clientId) return { ok: false, error: "payments.invalid_input" };
  if (!(input.amount > 0)) return { ok: false, error: "payments.invalid_input" };

  const isCheque = input.method === "cheque";
  if (input.method !== "cash" && input.method !== "transfer" && !isCheque) {
    return { ok: false, error: "payments.invalid_input" };
  }
  const chequeNumber = input.chequeNumber?.trim();
  if (isCheque && !chequeNumber) {
    return { ok: false, error: "payments.cheque_number_required" };
  }

  const supabase = await createClient();
  // recorded_by = the authenticated staff member, set SERVER-SIDE from the session
  // — never trusted from the client (forging a payment as another coach). The
  // ledger shows this for cash accountability (Atlas/owner ruling 2026-06-28).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "payments.unauthorized" };

  const { error } = await supabase.from("payments").upsert(
    {
      due_id: dueId,
      amount: input.amount,
      method: input.method,
      client_id: clientId,
      status: isCheque ? "pending" : "cleared",
      cheque_number: isCheque ? chequeNumber : null,
      recorded_by: user.id,
    },
    { onConflict: "client_id" },
  );
  if (error) {
    console.error("recordPayment failed:", error);
    return { ok: false, error: "payments.save_failed" };
  }

  return balanceForDue(supabase, dueId);
}

// Mark a cheque as bounced. The payment row STAYS (the owner must see whose cheque
// bounced, to chase it) but flips to 'bounced', so it stops counting toward the
// due — the balance reopens to overdue/partial, derived at read-time. Only a
// cheque can bounce; refuse anything else rather than silently no-op. Returns the
// reopened balance so the caller can show it immediately.
export async function markChequeBounced(
  paymentId: string,
): Promise<Result<Balance>> {
  const id = paymentId?.trim();
  if (!id) return { ok: false, error: "payments.invalid_input" };

  const supabase = await createClient();
  const { data: payment, error: loadErr } = await supabase
    .from("payments")
    .select("due_id, method")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) {
    console.error("markChequeBounced load failed:", loadErr);
    return { ok: false, error: "payments.load_failed" };
  }
  if (!payment) return { ok: false, error: "payments.not_found" };
  if (payment.method !== "cheque") {
    return { ok: false, error: "payments.not_a_cheque" };
  }

  // Only flip the status — deliberately DON'T touch recorded_by. It holds the coach
  // who LOGGED the cheque, which is exactly who the owner chases when it bounces;
  // overwriting it with the bouncer would destroy that. A separate bounce-actor is
  // a future column, not this one (Atlas ruling: ledger shows the original logger).
  const { error } = await supabase
    .from("payments")
    .update({ status: "bounced" })
    .eq("id", id);
  if (error) {
    console.error("markChequeBounced failed:", error);
    return { ok: false, error: "payments.save_failed" };
  }

  return balanceForDue(supabase, payment.due_id);
}

// Resolve a cheque number back to its payment + the player who gave it. THE
// primary bounce-reconciliation path: the bank returns a bounced cheque with only
// a number on it, no name, and the owner recovers whose it is from that number.
// Exact match (the number is the key, not a search term).
export async function findPaymentByChequeNumber(
  chequeNumber: string,
): Promise<Result<LedgerPayment | null>> {
  const number = chequeNumber?.trim();
  if (!number) return { ok: false, error: "payments.invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .select(`id, amount, method, status, cheque_number, paid_at, ${LEDGER_EMBED}`)
    .eq("cheque_number", number)
    .maybeSingle();
  if (error) {
    console.error("findPaymentByChequeNumber failed:", error);
    return { ok: false, error: "payments.load_failed" };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: toLedgerPayment(data as RawLedgerRow) };
}

// ── Reads ─────────────────────────────────────────────────────────────────

export async function getPlayerBalance(
  playerId: string,
  period: string,
): Promise<Result<Balance>> {
  const supabase = await createClient();
  const { data: due, error } = await supabase
    .from("dues")
    .select("id")
    .eq("player_id", playerId)
    .eq("period", period)
    .maybeSingle();
  if (error) {
    console.error("getPlayerBalance failed:", error);
    return { ok: false, error: "dues.load_failed" };
  }
  // No dues generated for this player/period yet — a real zero balance, not an error.
  if (!due) {
    return {
      ok: true,
      data: { due: 0, paid: 0, remaining: 0, credit: 0, status: "upcoming" },
    };
  }
  return balanceForDue(supabase, due.id);
}

export type DueWithStatus = Due & {
  paid: number;
  remaining: number;
  credit: number;
  status: DueStatus;
  player: PlayerRef;
};

// Shape a raw dues row + its embedded payments into the derived-balance row the
// UI renders. Coerces money at the boundary (see `money`).
type RawDueRow = Due & {
  payments: { amount: number; status: PaymentStatus }[];
  player: PlayerRef;
};
function toDueWithStatus(d: RawDueRow): DueWithStatus {
  const due = money(d.amount_due);
  const paid = sumPayments(d.payments);
  const { payments: _payments, ...rest } = d;
  return {
    ...rest,
    amount_due: due,
    paid,
    ...deriveBalance(due, paid, d.due_date),
  };
}

const LIST_LIMIT = 500;

export async function listDues(filter: {
  period?: string;
  status?: DueStatus;
}): Promise<Result<DueWithStatus[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("dues")
    .select(`${DUE_COLUMNS}, ${PLAYER_EMBED}, payments(amount, status)`)
    .order("due_date", { ascending: true })
    .limit(LIST_LIMIT);
  if (filter.period) query = query.eq("period", filter.period);

  const { data, error } = await query;
  if (error) {
    console.error("listDues failed:", error);
    return { ok: false, error: "dues.load_failed" };
  }

  const rows = data.map(toDueWithStatus);
  const filtered = filter.status
    ? rows.filter((r) => r.status === filter.status)
    : rows;
  return { ok: true, data: filtered };
}

export type SalaryWithPlayer = Salary & { player: PlayerRef };

export async function listSalaries(filter: {
  period?: string;
}): Promise<Result<SalaryWithPlayer[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("salaries")
    .select(`${SALARY_COLUMNS}, ${PLAYER_EMBED}`)
    .order("period", { ascending: false })
    .limit(LIST_LIMIT);
  if (filter.period) query = query.eq("period", filter.period);

  const { data, error } = await query;
  if (error) {
    console.error("listSalaries failed:", error);
    return { ok: false, error: "salaries.load_failed" };
  }
  return { ok: true, data: data.map((s) => ({ ...s, amount: money(s.amount) })) };
}

// Overdue = past the due date AND still owing money. This includes PARTIALLY-paid
// dues (status 'partial'), not just untouched ones — a kid who paid half and is
// past due still owes. Filtering on status==='overdue' alone would miss them.
export async function getOverdue(): Promise<Result<DueWithStatus[]>> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("dues")
    .select(`${DUE_COLUMNS}, ${PLAYER_EMBED}, payments(amount, status)`)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(LIST_LIMIT);
  if (error) {
    console.error("getOverdue failed:", error);
    return { ok: false, error: "dues.load_failed" };
  }

  const owing = data.map(toDueWithStatus).filter((r) => r.remaining > 0);
  return { ok: true, data: owing };
}

// ── Transaction ledger (coach/owner — M4.5) ─────────────────────────────────

// Every payment logged, newest first — the coach/owner transaction ledger. Bounded
// + filterable by player, period, and/or cheque number. Read-only over payment
// data. The cheque-number filter is an exact match (it's the bounce-lookup key).
export async function listPayments(filter: {
  period?: string;
  playerId?: string;
  chequeNumber?: string;
}): Promise<Result<LedgerPayment[]>> {
  const supabase = await createClient();
  let query = supabase
    .from("payments")
    .select(`id, amount, method, status, cheque_number, paid_at, ${LEDGER_EMBED}`)
    .order("paid_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (filter.period) query = query.eq("due.period", filter.period);
  if (filter.playerId) query = query.eq("due.player_id", filter.playerId);
  if (filter.chequeNumber) query = query.eq("cheque_number", filter.chequeNumber.trim());

  const { data, error } = await query;
  if (error) {
    console.error("listPayments failed:", error);
    return { ok: false, error: "payments.load_failed" };
  }

  return { ok: true, data: (data as RawLedgerRow[]).map(toLedgerPayment) };
}

// ── Settings (owner-only — RLS enforces) ────────────────────────────────────

export async function updateClubSettings(input: {
  default_dues: number;
}): Promise<Result<null>> {
  if (!(input.default_dues >= 0)) {
    return { ok: false, error: "settings.invalid_input" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_settings")
    .update({ default_dues: input.default_dues })
    .eq("id", true);
  if (error) {
    console.error("updateClubSettings failed:", error);
    return { ok: false, error: "settings.save_failed" };
  }
  return { ok: true, data: null };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// A payment counts toward a due's paid total ONLY when it has CLEARED. A pending
// cheque hasn't really paid yet; a bounced cheque un-paid. Both contribute 0, so
// the due stays open / reopens — the read-time half of the cheque lifecycle
// (M4.5). Cash/transfer are 'cleared' on arrival, so they count as before.
function sumPayments(payments: { amount: number; status: PaymentStatus }[]): number {
  return money(
    payments
      .filter((p) => p.status === "cleared")
      .reduce((acc, p) => acc + Number(p.amount), 0),
  );
}

async function balanceForDue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dueId: string,
): Promise<Result<Balance>> {
  const { data, error } = await supabase
    .from("dues")
    .select("amount_due, due_date, payments(amount, status)")
    .eq("id", dueId)
    .single();
  if (error) {
    console.error("balanceForDue failed:", error);
    return { ok: false, error: "dues.load_failed" };
  }
  const due = money(data.amount_due);
  const paid = sumPayments(data.payments);
  return {
    ok: true,
    data: { due, paid, ...deriveBalance(due, paid, data.due_date) },
  };
}

// Default due date: the 10th of the period's month.
function monthDueDate(period: string): string {
  const d = new Date(period);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 10))
    .toISOString()
    .slice(0, 10);
}

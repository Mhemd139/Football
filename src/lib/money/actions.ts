"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/supabase/types";

export type Due = Omit<Tables<"dues">, "created_at">;
export type Salary = Omit<Tables<"salaries">, "created_at">;
export type PaymentMethod = Enums<"payment_method">;
export type DueStatus = "paid" | "partial" | "overdue" | "upcoming";

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

// A balance is amount_due minus the sum of its payments; status is derived, never
// stored (it would drift on every payment and at every midnight).
type Balance = { due: number; paid: number; remaining: number; status: DueStatus };

// Coerce a money value to a number at the read boundary. PostgREST may serialize
// numeric as a string to preserve precision; the generated types say `number`.
// Number() normalizes both ("150.00" and 150 -> 150) so the math is never string
// concatenation. Round to 2dp to keep float sums exact at agora precision.
const money = (v: number | string): number =>
  Math.round(Number(v) * 100) / 100;

function deriveStatus(amountDue: number, paid: number, dueDate: string): DueStatus {
  if (paid >= amountDue) return "paid";
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
export async function recordPayment(input: {
  dueId: string;
  amount: number;
  method: PaymentMethod;
  clientId: string;
}): Promise<Result<Balance>> {
  const dueId = input.dueId?.trim();
  const clientId = input.clientId?.trim();
  if (!dueId || !clientId) return { ok: false, error: "payments.invalid_input" };
  if (!(input.amount > 0)) return { ok: false, error: "payments.invalid_input" };
  if (input.method !== "cash" && input.method !== "transfer") {
    return { ok: false, error: "payments.invalid_input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").upsert(
    {
      due_id: dueId,
      amount: input.amount,
      method: input.method,
      client_id: clientId,
    },
    { onConflict: "client_id" },
  );
  if (error) {
    console.error("recordPayment failed:", error);
    return { ok: false, error: "payments.save_failed" };
  }

  return balanceForDue(supabase, dueId);
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
    return { ok: true, data: { due: 0, paid: 0, remaining: 0, status: "upcoming" } };
  }
  return balanceForDue(supabase, due.id);
}

export type DueWithStatus = Due & {
  paid: number;
  remaining: number;
  status: DueStatus;
  player: PlayerRef;
};

// Shape a raw dues row + its embedded payments into the derived-balance row the
// UI renders. Coerces money at the boundary (see `money`).
type RawDueRow = Due & { payments: { amount: number }[]; player: PlayerRef };
function toDueWithStatus(d: RawDueRow): DueWithStatus {
  const due = money(d.amount_due);
  const paid = sumPayments(d.payments);
  const { payments: _payments, ...rest } = d;
  return {
    ...rest,
    amount_due: due,
    paid,
    remaining: money(due - paid),
    status: deriveStatus(due, paid, d.due_date),
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
    .select(`${DUE_COLUMNS}, ${PLAYER_EMBED}, payments(amount)`)
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
    .select(`${DUE_COLUMNS}, ${PLAYER_EMBED}, payments(amount)`)
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

function sumPayments(payments: { amount: number }[]): number {
  return money(payments.reduce((acc, p) => acc + Number(p.amount), 0));
}

async function balanceForDue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dueId: string,
): Promise<Result<Balance>> {
  const { data, error } = await supabase
    .from("dues")
    .select("amount_due, due_date, payments(amount)")
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
    data: {
      due,
      paid,
      remaining: money(due - paid),
      status: deriveStatus(due, paid, data.due_date),
    },
  };
}

// Default due date: the 10th of the period's month.
function monthDueDate(period: string): string {
  const d = new Date(period);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 10))
    .toISOString()
    .slice(0, 10);
}

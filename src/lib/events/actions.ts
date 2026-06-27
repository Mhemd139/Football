"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, Enums } from "@/lib/supabase/types";

// Selected columns only — timestamps omitted, the UI doesn't render them.
export type Event = Omit<Tables<"events">, "created_at" | "updated_at">;
export type Attendance = Tables<"attendance">;
export type EventType = Enums<"event_type">;
export type AttendanceStatus = Enums<"attendance_status">;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const EVENT_COLUMNS = "id, team_id, title, type, starts_at, location";
const ATTENDANCE_COLUMNS =
  "id, event_id, player_id, status, reason_minutes, reason_cause, client_id, recorded_at, synced_at";

// What a coach sets when scheduling a session. Server owns id/timestamps.
type EventInput = {
  team_id: string;
  title: string;
  type: EventType;
  starts_at: string;
  location?: string | null;
};

// One attendance mark as the client recorded it (possibly offline). client_id is
// generated on the client so a re-sync is idempotent (upsert on client_id).
export type AttendanceRow = {
  player_id: string;
  status: AttendanceStatus;
  reason_minutes?: number | null;
  reason_cause?: string | null;
  client_id: string;
  recorded_at?: string | null;
};

// ── Events ───────────────────────────────────────────────────────────────

export async function createEvent(input: EventInput): Promise<Result<Event>> {
  const clean = sanitizeEvent(input);
  if (!clean) return { ok: false, error: "events.invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert(clean)
    .select(EVENT_COLUMNS)
    .single();

  if (error) {
    console.error("createEvent failed:", error);
    return { ok: false, error: "events.save_failed" };
  }
  return { ok: true, data };
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<Result<Event>> {
  const clean = sanitizeEventPatch(patch);
  if (clean === null || Object.keys(clean).length === 0) {
    return { ok: false, error: "events.invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update(clean)
    .eq("id", id)
    .select(EVENT_COLUMNS)
    .single();

  if (error) {
    console.error("updateEvent failed:", error);
    return { ok: false, error: "events.save_failed" };
  }
  return { ok: true, data };
}

// Hard delete — attendance rows cascade (FK on delete cascade). A session
// scheduled by mistake leaves no orphan marks behind.
export async function deleteEvent(id: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    console.error("deleteEvent failed:", error);
    return { ok: false, error: "events.save_failed" };
  }
  return { ok: true, data: null };
}

// Sessions starting within the given UTC day [dayStart, dayStart+24h). The
// caller passes the day boundary so the server doesn't guess the client's tz.
export async function getTodaySessions(
  dayStartIso: string,
): Promise<Result<Event[]>> {
  const start = new Date(dayStartIso);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "events.invalid_input" };
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("getTodaySessions failed:", error);
    return { ok: false, error: "events.load_failed" };
  }
  return { ok: true, data };
}

// Events in [from, to). Bounded by the range — no unbounded scan.
export async function listEvents(
  fromIso: string,
  toIso: string,
): Promise<Result<Event[]>> {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "events.invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("listEvents failed:", error);
    return { ok: false, error: "events.load_failed" };
  }
  return { ok: true, data };
}

// One event with its team name — for the attendance screen header. The team
// name is joined in a single query (no extra round-trip).
export type EventWithTeam = Event & { team_name: string };

export async function getEvent(id: string): Promise<Result<EventWithTeam>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(`${EVENT_COLUMNS}, teams!inner(name)`)
    .eq("id", id)
    .single();

  if (error) {
    console.error("getEvent failed:", error);
    return { ok: false, error: "events.load_failed" };
  }

  const { teams, ...event } = data;
  return { ok: true, data: { ...event, team_name: teams.name } };
}

// ── Attendance ─────────────────────────────────────────────────────────────

// The roster for an event: the active team players + ANY player who already has
// a mark for this event, with that mark (if any). `historical` flags a player who
// is on the roster ONLY because they have a saved mark — i.e. they're no longer
// an active member of the team (deactivated since), kept so a past event's
// breakdown reconciles against what was actually saved.
//
// Why a union, not two functions: a NEW session has no marks, so the union is
// exactly the active roster (live take-attendance, unchanged). A PAST event
// surfaces every marked player, active or not — an attendance record is a
// point-in-time fact; deactivating a player later doesn't un-happen it (Atlas
// ruling). One read serves both with no caller decision.
type RosterPlayer = {
  player_id: string;
  full_name: string;
  jersey_number: number | null;
  status: AttendanceStatus | null;
  historical: boolean;
};

export async function getEventRoster(
  eventId: string,
): Promise<Result<RosterPlayer[]>> {
  const supabase = await createClient();

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("team_id")
    .eq("id", eventId)
    .single();
  if (eventErr) {
    console.error("getEventRoster (event) failed:", eventErr);
    return { ok: false, error: "events.load_failed" };
  }

  const [active, marks] = await Promise.all([
    supabase
      .from("players")
      .select("id, full_name, jersey_number")
      .eq("team_id", event.team_id)
      .eq("active", true),
    supabase
      .from("attendance")
      .select("player_id, status")
      .eq("event_id", eventId),
  ]);

  if (active.error || marks.error) {
    console.error("getEventRoster failed:", active.error ?? marks.error);
    return { ok: false, error: "attendance.load_failed" };
  }

  const byPlayer = new Map<string, AttendanceStatus>();
  for (const m of marks.data) byPlayer.set(m.player_id, m.status);

  // Any marked player NOT in the active set is a historical member (deactivated
  // since they were marked). Fetch only those, so the past event reconciles.
  const activeIds = new Set(active.data.map((p) => p.id));
  const missingIds = [...byPlayer.keys()].filter((id) => !activeIds.has(id));

  let historical: { id: string; full_name: string; jersey_number: number | null }[] = [];
  if (missingIds.length > 0) {
    const { data, error } = await supabase
      .from("players")
      .select("id, full_name, jersey_number")
      .in("id", missingIds);
    if (error) {
      console.error("getEventRoster (historical) failed:", error);
      return { ok: false, error: "attendance.load_failed" };
    }
    historical = data;
  }

  const rows: RosterPlayer[] = [
    ...active.data.map((p) => ({
      player_id: p.id,
      full_name: p.full_name,
      jersey_number: p.jersey_number,
      status: byPlayer.get(p.id) ?? null,
      historical: false,
    })),
    ...historical.map((p) => ({
      player_id: p.id,
      full_name: p.full_name,
      jersey_number: p.jersey_number,
      status: byPlayer.get(p.id) ?? null,
      historical: true,
    })),
  ];

  // Sort once over the merged set (was DB-side; now in JS since two sources
  // merge): jersey number ascending, nulls last, then name.
  rows.sort((a, b) => {
    if (a.jersey_number !== b.jersey_number) {
      if (a.jersey_number == null) return 1;
      if (b.jersey_number == null) return -1;
      return a.jersey_number - b.jersey_number;
    }
    return a.full_name.localeCompare(b.full_name);
  });

  return { ok: true, data: rows };
}

// Save a roster's marks. Upsert on client_id so a re-save (or an offline replay)
// updates the same row instead of duplicating — this is the offline guarantee.
export async function saveAttendance(
  eventId: string,
  rows: AttendanceRow[],
): Promise<Result<null>> {
  const clean = sanitizeAttendance(eventId, rows);
  if (!clean) return { ok: false, error: "attendance.invalid_input" };
  if (clean.length === 0) return { ok: true, data: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .upsert(clean, { onConflict: "client_id" });

  if (error) {
    console.error("saveAttendance failed:", error);
    return { ok: false, error: "attendance.save_failed" };
  }
  return { ok: true, data: null };
}

// Replay an offline batch on reconnect. Each row already carries its event_id
// + client_id, so this is the same idempotent upsert as saveAttendance.
export async function syncAttendance(
  batch: (AttendanceRow & { event_id: string })[],
): Promise<Result<null>> {
  const clean = sanitizeBatch(batch);
  if (!clean) return { ok: false, error: "attendance.invalid_input" };
  if (clean.length === 0) return { ok: true, data: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .upsert(clean, { onConflict: "client_id" });

  if (error) {
    console.error("syncAttendance failed:", error);
    return { ok: false, error: "attendance.save_failed" };
  }
  return { ok: true, data: null };
}

// ── Validation (boundary) ──────────────────────────────────────────────────

function sanitizeEvent(input: EventInput): TablesInsert<"events"> | null {
  const title = input.title?.trim();
  const team_id = input.team_id?.trim();
  const starts_at = input.starts_at?.trim();
  if (!title || !team_id || !starts_at) return null;
  if (input.type !== "training" && input.type !== "match") return null;
  if (Number.isNaN(new Date(starts_at).getTime())) return null;

  return {
    team_id,
    title,
    type: input.type,
    starts_at,
    location: input.location?.trim() || null,
  };
}

// Allow-list an event patch. team_id is editable (a session can be reassigned to
// another team in the same club — unlike a player, an event carries no money
// invariant). Returns null on an invalid value; {} means nothing to update.
function sanitizeEventPatch(
  p: Partial<EventInput>,
): Partial<TablesInsert<"events">> | null {
  const out: Partial<TablesInsert<"events">> = {};

  if (p.team_id !== undefined) {
    const team_id = p.team_id?.trim();
    if (!team_id) return null;
    out.team_id = team_id;
  }
  if (p.title !== undefined) {
    const title = p.title?.trim();
    if (!title) return null;
    out.title = title;
  }
  if (p.type !== undefined) {
    if (p.type !== "training" && p.type !== "match") return null;
    out.type = p.type;
  }
  if (p.starts_at !== undefined) {
    const starts_at = p.starts_at?.trim();
    if (!starts_at || Number.isNaN(new Date(starts_at).getTime())) return null;
    out.starts_at = starts_at;
  }
  if (p.location !== undefined) out.location = p.location?.trim() || null;

  return out;
}

// Validate a roster's marks for one event. A bad row fails the whole save (a
// partial roster is worse than a retry). reason fields only make sense for
// late/absent — present rows drop them.
function sanitizeAttendance(
  eventId: string,
  rows: AttendanceRow[],
): TablesInsert<"attendance">[] | null {
  const event_id = eventId?.trim();
  if (!event_id) return null;
  return mapRows(rows, () => event_id);
}

// Same validation for a sync batch, but each row brings its own event_id.
function sanitizeBatch(
  batch: (AttendanceRow & { event_id: string })[],
): TablesInsert<"attendance">[] | null {
  return mapRows(batch, (r) => (r as { event_id?: string }).event_id?.trim());
}

function mapRows(
  rows: AttendanceRow[],
  eventIdOf: (row: AttendanceRow) => string | undefined,
): TablesInsert<"attendance">[] | null {
  const out: TablesInsert<"attendance">[] = [];
  for (const r of rows) {
    const event_id = eventIdOf(r);
    const player_id = r.player_id?.trim();
    const client_id = r.client_id?.trim();
    if (!event_id || !player_id || !client_id) return null;
    if (
      r.status !== "present" &&
      r.status !== "late" &&
      r.status !== "absent"
    ) {
      return null;
    }
    const excused = r.status !== "present";
    out.push({
      event_id,
      player_id,
      status: r.status,
      reason_minutes: excused ? num(r.reason_minutes) : null,
      reason_cause: excused ? r.reason_cause?.trim() || null : null,
      client_id,
      recorded_at: r.recorded_at || undefined,
      // refresh on every upsert — the DB default only fires on INSERT, so a
      // re-synced row would otherwise keep its first-sync time forever.
      synced_at: new Date().toISOString(),
    });
  }
  return out;
}

const num = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? null : v;

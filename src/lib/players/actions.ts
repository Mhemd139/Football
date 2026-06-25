"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, Enums } from "@/lib/supabase/types";

// Selected columns only (COLUMNS) — timestamps omitted, the UI doesn't use them.
export type Player = Omit<Tables<"players">, "created_at" | "updated_at">;
export type Team = Omit<Tables<"teams">, "created_at" | "updated_at">;
export type Category = Enums<"player_category">;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const PLAYER_COLUMNS =
  "id, team_id, full_name, national_id, birthdate, jersey_number, position, height_cm, guardian_name, guardian_phone, monthly_salary, active";
const TEAM_COLUMNS = "id, category, name, active";

// Fields a coach may set/edit on a player. Server owns id/active/timestamps;
// the team (and therefore the category) is set by which roster you're in.
type PlayerInput = {
  team_id: string;
  full_name: string;
  national_id?: string | null;
  birthdate?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  height_cm?: number | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};

// ── Teams ──────────────────────────────────────────────────────────────

export async function listTeams(category: Category): Promise<Result<Team[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select(TEAM_COLUMNS)
    .eq("category", category)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("listTeams failed:", error);
    return { ok: false, error: "teams.load_failed" };
  }
  return { ok: true, data };
}

export async function createTeam(
  category: Category,
  name: string,
): Promise<Result<Team>> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "teams.invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ category, name: clean })
    .select(TEAM_COLUMNS)
    .single();

  if (error) {
    console.error("createTeam failed:", error);
    return { ok: false, error: "teams.save_failed" };
  }
  return { ok: true, data };
}

// Active-player count per team in a category — for the teams-list screen.
export async function teamPlayerCounts(
  category: Category,
): Promise<Result<Record<string, number>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("team_id, teams!inner(category)")
    .eq("active", true)
    .eq("teams.category", category);

  if (error) {
    console.error("teamPlayerCounts failed:", error);
    return { ok: false, error: "players.load_failed" };
  }
  const counts: Record<string, number> = {};
  for (const row of data) counts[row.team_id] = (counts[row.team_id] ?? 0) + 1;
  return { ok: true, data: counts };
}

// ── Players ────────────────────────────────────────────────────────────

export async function listPlayers(teamId: string): Promise<Result<Player[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("team_id", teamId)
    .eq("active", true)
    .order("jersey_number", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });

  if (error) {
    console.error("listPlayers failed:", error);
    return { ok: false, error: "players.load_failed" };
  }
  return { ok: true, data };
}

export async function getPlayer(id: string): Promise<Result<Player>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    console.error("getPlayer failed:", error);
    return { ok: false, error: "players.load_failed" };
  }
  return { ok: true, data };
}

export async function createPlayer(input: PlayerInput): Promise<Result<Player>> {
  const clean = sanitize(input);
  if (!clean) return { ok: false, error: "players.invalid_input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .insert(clean)
    .select(PLAYER_COLUMNS)
    .single();

  if (error) {
    console.error("createPlayer failed:", error);
    return { ok: false, error: "players.save_failed" };
  }
  return { ok: true, data };
}

export async function updatePlayer(
  id: string,
  patch: Partial<PlayerInput>,
): Promise<Result<Player>> {
  // Allow-list the patch: server actions are reachable by direct POST, and the
  // Partial<PlayerInput> type is erased at runtime. Never let a caller write
  // id/active/timestamps — and NOT team_id: moving a player to a team in a
  // different category would silently flip their money direction (dues<->salary),
  // and the FK can't catch that (a wrong-category team is still a valid team).
  // Team is set once at createPlayer (by the roster you entered); edit can't
  // re-pick it. A same-category transfer, if ever needed, is an explicit feature
  // that must compare categories before writing. Mirrors createPlayer's sanitize.
  const clean = sanitizePatch(patch);
  if (clean === null || Object.keys(clean).length === 0) {
    return { ok: false, error: "players.invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update(clean)
    .eq("id", id)
    .select(PLAYER_COLUMNS)
    .single();

  if (error) {
    console.error("updatePlayer failed:", error);
    return { ok: false, error: "players.save_failed" };
  }
  return { ok: true, data };
}

// Soft delete — preserves history (plan: removal keeps historical records).
export async function deactivatePlayer(id: string): Promise<Result<null>> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({ active: false })
    .eq("id", id);

  if (error) {
    console.error("deactivatePlayer failed:", error);
    return { ok: false, error: "players.save_failed" };
  }
  return { ok: true, data: null };
}

// Validate at the boundary: name + team required, numbers are numbers.
function sanitize(input: PlayerInput): TablesInsert<"players"> | null {
  const full_name = input.full_name?.trim();
  const team_id = input.team_id?.trim();
  if (!full_name || !team_id) return null;

  const num = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? null : v;

  return {
    team_id,
    full_name,
    national_id: input.national_id?.trim() || null,
    birthdate: input.birthdate || null,
    jersey_number: num(input.jersey_number),
    position: input.position?.trim() || null,
    height_cm: num(input.height_cm),
    guardian_name: input.guardian_name?.trim() || null,
    guardian_phone: input.guardian_phone?.trim() || null,
  };
}

// Allow-list an update patch to the editable fields only. Returns null on an
// invalid value (empty team_id, blanked-out required name); {} means nothing
// editable was supplied. id/active/timestamps can never be set here.
function sanitizePatch(
  p: Partial<PlayerInput>,
): Partial<TablesInsert<"players">> | null {
  const out: Partial<TablesInsert<"players">> = {};
  const num = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? null : v;

  // team_id is intentionally NOT editable here — see the function comment.
  if (p.full_name !== undefined) {
    const name = p.full_name?.trim();
    if (!name) return null; // required field — cannot be blanked
    out.full_name = name;
  }
  if (p.national_id !== undefined) out.national_id = p.national_id?.trim() || null;
  if (p.birthdate !== undefined) out.birthdate = p.birthdate || null;
  if (p.jersey_number !== undefined) out.jersey_number = num(p.jersey_number);
  if (p.position !== undefined) out.position = p.position?.trim() || null;
  if (p.height_cm !== undefined) out.height_cm = num(p.height_cm);
  if (p.guardian_name !== undefined)
    out.guardian_name = p.guardian_name?.trim() || null;
  if (p.guardian_phone !== undefined)
    out.guardian_phone = p.guardian_phone?.trim() || null;

  return out;
}

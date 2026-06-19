"use server";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert, Enums } from "@/lib/supabase/types";

// The columns we actually select (COLUMNS) — timestamps omitted, the UI doesn't use them.
export type Player = Omit<Tables<"players">, "created_at" | "updated_at">;
export type Category = Enums<"player_category">;

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const COLUMNS =
  "id, category, full_name, national_id, birthdate, jersey_number, position, height_cm, guardian_name, guardian_phone, active";

// Fields a coach may set/edit. Server owns id/active/timestamps.
type PlayerInput = {
  category: Category;
  full_name: string;
  national_id?: string | null;
  birthdate?: string | null;
  jersey_number?: number | null;
  position?: string | null;
  height_cm?: number | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};

export async function listPlayers(category: Category): Promise<Result<Player[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select(COLUMNS)
    .eq("category", category)
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
    .select(COLUMNS)
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
    .select(COLUMNS)
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
  // id/active/timestamps or an invalid category (the dues-vs-salary split is
  // load-bearing). Mirrors createPlayer's sanitize step.
  const clean = sanitizePatch(patch);
  if (clean === null || Object.keys(clean).length === 0) {
    return { ok: false, error: "players.invalid_input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .update(clean)
    .eq("id", id)
    .select(COLUMNS)
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

// Validate at the boundary: name required, category valid, numbers are numbers.
function sanitize(input: PlayerInput): TablesInsert<"players"> | null {
  const full_name = input.full_name?.trim();
  if (!full_name) return null;
  if (!["beet_sefer", "league", "bogrim"].includes(input.category)) return null;

  const num = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? null : v;

  return {
    category: input.category,
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
// invalid value (bad category, blanked-out required name); {} means nothing
// editable was supplied. id/active/timestamps can never be set here.
function sanitizePatch(
  p: Partial<PlayerInput>,
): Partial<TablesInsert<"players">> | null {
  const out: Partial<TablesInsert<"players">> = {};
  const num = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? null : v;

  if (p.category !== undefined) {
    if (!["beet_sefer", "league", "bogrim"].includes(p.category)) return null;
    out.category = p.category;
  }
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

// The 7 canonical football positions — the single source of truth shared by the
// add/edit picker, the roster row, and the player card so colors + labels can't
// drift. Owner-locked set (GK·CB·FB·DM·CM·W·ST); the snake_case values match
// Sweeper's coming `player_position` enum exactly, so when the migration lands
// this stays put and callers swap `string` for `Enums<"player_position">`.
//
// `color` = the precise per-position tone (Atlas to ratify — flagged on the
// Playground; two brush the reserved money/attendance hues). `lit` = the broad
// line bucket for the floodlit tile (only 4 tones exist in CSS), so the tile
// reads by line while the chip dot/border carries the exact position color.
// i18n labels live under `players.pos_*` (rendered by the caller's translator).

export type Position =
  | "goalkeeper"
  | "centre_back"
  | "full_back"
  | "defensive_mid"
  | "central_mid"
  | "winger"
  | "striker";

export type PositionMeta = {
  value: Position;
  color: string;
  soft: string;
  lit: "blue" | "green" | "gold" | "red";
};

// Order = back-to-front, the way a coach reads a team sheet.
export const POSITIONS: PositionMeta[] = [
  { value: "goalkeeper", color: "#F59E0B", soft: "#FEF3E2", lit: "gold" },
  { value: "centre_back", color: "#475569", soft: "#EEF2F6", lit: "blue" },
  { value: "full_back", color: "#0D9488", soft: "#E6F5F2", lit: "blue" },
  { value: "defensive_mid", color: "#4F46E5", soft: "#ECEBFC", lit: "green" },
  { value: "central_mid", color: "#7C3AED", soft: "#F1EAFD", lit: "green" },
  { value: "winger", color: "#0EA5E9", soft: "#E6F5FD", lit: "blue" },
  { value: "striker", color: "#E11D48", soft: "#FDE7EC", lit: "red" },
];

const BY_VALUE = new Map(POSITIONS.map((p) => [p.value, p]));

// Resolve a stored position to its meta. Pre-enum free-text rows (or null) won't
// match one of the 7 → null, so the caller renders no position rather than a
// stale string with a guessed color.
export function positionMeta(position: string | null | undefined): PositionMeta | null {
  return position ? BY_VALUE.get(position as Position) ?? null : null;
}

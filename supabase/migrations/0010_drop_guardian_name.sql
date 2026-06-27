-- Drop players.guardian_name. Owner ruling (2026-06-27): "the name of the parent
-- isn't something we shall save — we save a phone number, not a name." A coach
-- calls the guardian; the name carries no value. guardian_phone stays.
--
-- DEPLOY ORDER (code-first): the app no longer SELECTs this column — it was
-- removed from PLAYER_COLUMNS / PlayerInput / sanitize / sanitizePatch in
-- src/lib/players/actions.ts, and Pitch removed it from the form + profile UI.
-- A select still naming a dropped column would 400, so that code ships BEFORE
-- this DROP. Existing guardian_name values are discarded by design (owner's call).
alter table public.players drop column guardian_name;

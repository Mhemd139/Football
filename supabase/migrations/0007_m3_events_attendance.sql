-- M3: Events & Attendance (the North Star, offline-safe).
-- Events attach to the working unit (team_id, not category — PM amendment
-- 2026-06-20). Attendance is replay-safe: client generates a client_id offline,
-- the unique constraint + upsert make a double-sync land exactly one row.

-- 1. events: training/match sessions a team's roster attends.
create type public.event_type as enum ('training', 'match');

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id),
  title      text not null,
  type       public.event_type not null,
  starts_at  timestamptz not null,
  location   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- today's-sessions + per-team listing both scan by start time within a team.
create index events_team_starts_idx on public.events (team_id, starts_at);

create trigger trg_events_touch
  before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.events enable row level security;

create policy events_select_staff on public.events
  for select using (public.current_role() in ('coach','owner'));
create policy events_write_staff on public.events
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

-- 2. attendance: one row per (event, player). client_id is the offline idempotency
-- key — UNIQUE so re-syncing the same locally-recorded mark never duplicates.
create type public.attendance_status as enum ('present', 'late', 'absent');

create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  player_id      uuid not null references public.players(id),
  status         public.attendance_status not null,
  reason_minutes int,
  reason_cause   text,
  client_id      uuid not null unique,
  recorded_at    timestamptz not null default now(),
  synced_at      timestamptz not null default now()
);
-- the roster screen reads every mark for one event; the dedup path hits client_id
-- (already unique-indexed by the constraint above).
create index attendance_event_idx on public.attendance (event_id);

alter table public.attendance enable row level security;

create policy attendance_select_staff on public.attendance
  for select using (public.current_role() in ('coach','owner'));
create policy attendance_write_staff on public.attendance
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

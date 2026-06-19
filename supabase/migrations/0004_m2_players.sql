-- M2: players + categories. ONE table; category drives money direction only.
-- Bogrim take attendance like everyone; club pays them (salaries), never dues.

create type public.player_category as enum ('beet_sefer', 'league', 'bogrim');

create table public.players (
  id            uuid primary key default gen_random_uuid(),
  category      public.player_category not null,
  full_name     text not null,
  national_id   text,
  birthdate     date,
  jersey_number int,
  position      text,
  height_cm     int,
  guardian_name  text,
  guardian_phone text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index players_category_active on public.players (category, active);

create trigger trg_players_touch
  before update on public.players
  for each row execute function public.touch_updated_at();

-- RLS: coach/owner only (no parent branch yet — parent lands in M7).
-- ponytail: all coaches+owner see all categories. Per-category visibility is an
-- M6 concern (ships with invite/roles, gate-tested there) — not built now.
alter table public.players enable row level security;

create policy players_select_staff on public.players
  for select using (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role in ('coach','owner'))
  );

create policy players_write_staff on public.players
  for all using (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role in ('coach','owner'))
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role in ('coach','owner'))
  );

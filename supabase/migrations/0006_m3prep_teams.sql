-- M3-prep (PM amendment 2026-06-20): category → team → player.
-- The team is the working unit; category moves to teams.category and still
-- drives money direction only. players.category is dropped after backfill.

-- 1. teams: a few per category, coach-named (free text), soft-deletable.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  category public.player_category not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_category_active_idx on public.teams (category, active);

-- reuse the players touch-trigger function for updated_at
create trigger trg_teams_touch
  before update on public.teams
  for each row execute function public.touch_updated_at();

alter table public.teams enable row level security;

create policy teams_select_staff on public.teams
  for select using (public.current_role() in ('coach','owner'));
create policy teams_write_staff on public.teams
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

-- 2. seed one team per category so every existing/new player has a home.
insert into public.teams (category, name) values
  ('beet_sefer', 'بيت سيفر'),
  ('league',     'ليجا'),
  ('bogrim',     'بوجريم');

-- 3. players: link to a team; backfill from the player's current category, then
-- make it required and drop the now-derived category column.
alter table public.players add column team_id uuid references public.teams(id);

update public.players p
  set team_id = t.id
  from public.teams t
  where t.category = p.category and t.name = (
    case p.category
      when 'beet_sefer' then 'بيت سيفر'
      when 'league'     then 'ليجا'
      when 'bogrim'     then 'بوجريم'
    end
  );

alter table public.players alter column team_id set not null;

drop index if exists players_category_active;
alter table public.players drop column category;
create index players_team_active on public.players (team_id, active);

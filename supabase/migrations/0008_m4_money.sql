-- M4: Money — dues/payments (kids) + salaries (Bogrim), generated + invariant-tested.
-- Two tables by money DIRECTION, never one signed table (avoids the sign bug).
-- The load-bearing invariant — a Bogrim never lands in dues, a kid never in
-- salaries — is enforced by BEFORE INSERT/UPDATE triggers that resolve category
-- through player -> team -> teams.category (a CHECK can't cross tables; PM
-- amendment 2026-06-20). Money is player_id-keyed; category is derived live.

-- Money is numeric(10,2) in shekels everywhere — never float (rounding bugs).

-- 1. club_settings: single-row club config. default_dues is the per-kid amount
-- generateDues stamps. 150.00 is a throwaway placeholder (owner edits in-app via
-- updateClubSettings before real use — Atlas requirement 2026-06-25).
create table public.club_settings (
  id           boolean primary key default true,
  default_dues numeric(10,2) not null default 150.00,
  updated_at   timestamptz not null default now(),
  constraint club_settings_singleton check (id)
);
insert into public.club_settings (id) values (true);

create trigger trg_club_settings_touch
  before update on public.club_settings
  for each row execute function public.touch_updated_at();

alter table public.club_settings enable row level security;
create policy club_settings_select_staff on public.club_settings
  for select using (public.current_role() in ('coach','owner'));
-- owner-only write: the dues default is an owner setting, not coach-facing.
create policy club_settings_write_owner on public.club_settings
  for all using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

-- 2. per-Bogrim salary lives on the player (salary is a property of the person).
-- NULL for kids; a Bogrim with NULL salary is skipped + reported by generate.
alter table public.players add column monthly_salary numeric(10,2);

-- 3. category guards — SECURITY DEFINER so the player->team->category lookup is
-- not blocked by the caller's RLS; fail-closed.
create function public.assert_dues_category()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cat public.player_category;
begin
  select t.category into cat
  from public.players p join public.teams t on t.id = p.team_id
  where p.id = new.player_id;
  if cat is null then
    raise exception 'dues: player % has no resolvable team/category', new.player_id;
  end if;
  if cat not in ('beet_sefer','league') then
    raise exception 'dues: player % is category % — only beet_sefer/league pay dues', new.player_id, cat;
  end if;
  return new;
end $$;

create function public.assert_salary_category()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cat public.player_category;
begin
  select t.category into cat
  from public.players p join public.teams t on t.id = p.team_id
  where p.id = new.player_id;
  if cat is null then
    raise exception 'salary: player % has no resolvable team/category', new.player_id;
  end if;
  if cat <> 'bogrim' then
    raise exception 'salary: player % is category % — only bogrim draw salaries', new.player_id, cat;
  end if;
  return new;
end $$;

-- 4. dues (kids only). status is DERIVED at read-time (paid|partial|overdue|
-- upcoming) from payments vs amount_due vs due_date — never stored (would drift).
create table public.dues (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id),
  period     date not null,
  amount_due numeric(10,2) not null,
  due_date   date not null,
  created_at timestamptz not null default now(),
  unique (player_id, period)
);
create index dues_due_date_idx on public.dues (due_date);

create trigger trg_dues_category
  before insert or update on public.dues
  for each row execute function public.assert_dues_category();

alter table public.dues enable row level security;
create policy dues_select_staff on public.dues
  for select using (public.current_role() in ('coach','owner'));
create policy dues_write_staff on public.dues
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

-- 5. payments against a dues row. client_id UNIQUE = offline-safe (same pattern
-- as attendance). recorded_by = the staff member who logged it.
create type public.payment_method as enum ('cash', 'transfer');

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  due_id      uuid not null references public.dues(id) on delete cascade,
  amount      numeric(10,2) not null,
  method      public.payment_method not null,
  paid_at     timestamptz not null default now(),
  client_id   uuid not null unique,
  recorded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index payments_due_idx on public.payments (due_id);

alter table public.payments enable row level security;
create policy payments_select_staff on public.payments
  for select using (public.current_role() in ('coach','owner'));
create policy payments_write_staff on public.payments
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

-- 6. salaries (Bogrim only). paid_at NULL = unpaid (the only status salaries need).
create table public.salaries (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id),
  period     date not null,
  amount     numeric(10,2) not null,
  paid_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (player_id, period)
);
create index salaries_player_period_idx on public.salaries (player_id, period);

create trigger trg_salaries_category
  before insert or update on public.salaries
  for each row execute function public.assert_salary_category();

alter table public.salaries enable row level security;
create policy salaries_select_staff on public.salaries
  for select using (public.current_role() in ('coach','owner'));
create policy salaries_write_staff on public.salaries
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

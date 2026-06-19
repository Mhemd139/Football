-- M1: profiles + roles + first-owner bootstrap + RLS

create type public.user_role as enum ('coach', 'owner', 'parent');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'coach',
  full_name   text,
  phone       text,
  locale      text not null default 'ar' check (locale in ('ar','he')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ponytail: only ONE owner can ever exist. Partial unique index makes the DB the
-- referee, so the first-owner bootstrap can never race two owners in.
create unique index profiles_one_owner on public.profiles (role) where role = 'owner';

-- First-owner bootstrap: first profile ever -> owner, everyone after -> coach.
create or replace function public.set_first_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where role = 'owner') then
    new.role := 'owner';
  end if;
  return new;
end;
$$;

create trigger trg_set_first_owner
  before insert on public.profiles
  for each row execute function public.set_first_owner();

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- RLS: a user sees/edits only their own row; owner reads all.
alter table public.profiles enable row level security;

create policy profiles_select_self_or_owner on public.profiles
  for select using (
    id = (select auth.uid())
    or exists (select 1 from public.profiles p
               where p.id = (select auth.uid()) and p.role = 'owner')
  );

create policy profiles_insert_self on public.profiles
  for insert with check (id = (select auth.uid()));

create policy profiles_update_self on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

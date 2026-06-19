-- Fix: profiles RLS self-reference caused infinite recursion when other tables'
-- policies sub-query profiles. Standard Supabase fix: a SECURITY DEFINER helper
-- that reads the caller's role bypassing RLS. Reused by all role-gated policies.

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- anon may EXECUTE it: with no session it returns NULL, which fails every
-- role check -> access denied, safely. (Revoking instead throws inside policies.)
revoke execute on function public.current_role() from public;
grant execute on function public.current_role() to authenticated, anon;

-- profiles: replace the self-referencing owner check with the helper.
drop policy if exists profiles_select_self_or_owner on public.profiles;
create policy profiles_select_self_or_owner on public.profiles
  for select using (
    id = (select auth.uid()) or public.current_role() = 'owner'
  );

-- players: use the helper instead of sub-querying profiles.
drop policy if exists players_select_staff on public.players;
drop policy if exists players_write_staff on public.players;

create policy players_select_staff on public.players
  for select using (public.current_role() in ('coach','owner'));

create policy players_write_staff on public.players
  for all using (public.current_role() in ('coach','owner'))
  with check (public.current_role() in ('coach','owner'));

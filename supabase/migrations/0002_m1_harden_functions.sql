-- Harden M1 functions per security advisor

-- 1. pin search_path on the touch fn (same as set_first_owner already has)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;

-- 2. trigger fns must not be callable as REST RPC. Triggers still fire (they run as
-- table owner), this only blocks direct /rpc/ calls by anon + authenticated.
revoke execute on function public.set_first_owner() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- SECURITY FIX (Marker OP-1, finding M-001): privilege escalation via self-profile write.
--
-- The breach: profiles_update_self allows UPDATE with check `id = auth.uid()`. That
-- constrains WHICH ROW you may edit (your own), never WHICH COLUMN or what value — so
-- a non-owner could write their OWN `role`. The single-owner unique index blocks a
-- second owner (parent->owner raised 23505), but NOTHING blocked parent->coach: a
-- read-only M7 parent could self-promote to coach and gain full staff RLS (read AND
-- write on players/dues/attendance/...). Proven live (self-rolled-back):
--   parent -> coach SUCCEEDED, then players+dues visible (0 -> 4) and createPlayer SUCCEEDED.
--
-- Why a trigger, not a tighter WITH CHECK: a row-level WITH CHECK sees only NEW, it
-- cannot compare OLD.role vs NEW.role, so it can't say "role is unchanged OR caller is
-- owner". A BEFORE UPDATE trigger can. This pins the `role` column to owner-only writes
-- while leaving self-edits of full_name/locale/phone untouched.
--
-- Fail-closed + matches the codebase convention (security definer, search_path pinned,
-- RPC execute revoked — same as set_first_owner / current_role).

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- role unchanged -> always fine (self-edits of name/locale/phone pass through).
  if new.role is not distinct from old.role then
    return new;
  end if;
  -- role IS changing -> only an owner may do it. current_role() reads the CALLER's
  -- row (auth.uid()), bypassing RLS; anon/no-session -> NULL -> denied. Fail-closed.
  if public.current_role() = 'owner' then
    return new;
  end if;
  raise exception 'profiles: role may only be changed by an owner (attempted % -> %)',
    old.role, new.role
    using errcode = '42501';  -- insufficient_privilege
end;
$$;

create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Trigger fns must not be callable as REST RPC (same hardening as the others).
revoke execute on function public.guard_profile_role() from public, anon, authenticated;

-- SECURITY negative test (Marker OP-1 / finding M-001): a non-owner CANNOT change
-- their own role. Guards against privilege escalation via self-profile write — a
-- read-only parent self-promoting to coach/owner to gain staff RLS.
--
-- PASS = escalation BLOCKED + legit paths still work. A Marker negative test: it
-- passes when the ATTACK FAILS. Requires migration 0011 (trg_guard_profile_role).
-- Run the whole file as ONE transaction; the trailing rollback leaves nothing behind.
-- (Role-switching uses top-level SET LOCAL between blocks — reliable, unlike
-- set_config('role',...) inside a single do-block.)
begin;

-- seed a throwaway attacker as 'parent'. The guard is briefly disabled ONLY to set
-- up the fixture (in production a role is owner-assigned); the attack below runs
-- with the guard fully enabled.
insert into auth.users (id, instance_id, aud, role)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  on conflict (id) do nothing;
alter table public.profiles disable trigger trg_guard_profile_role;
update public.profiles set role = 'parent' where id = '00000000-0000-0000-0000-0000000000a1';
alter table public.profiles enable trigger trg_guard_profile_role;

-- ── ATTACK: become the parent, self-promote to coach → MUST be blocked ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$
declare escalated boolean := false; self_edit_ok boolean := false;
begin
  begin
    update public.profiles set role = 'coach' where id = '00000000-0000-0000-0000-0000000000a1';
    escalated := true;
  exception when others then escalated := false; end;
  assert not escalated, 'FAIL: parent self-escalated to coach — M-001 OPEN';

  -- regression: a self-edit that does NOT touch role must still pass
  begin
    update public.profiles set locale = 'he' where id = '00000000-0000-0000-0000-0000000000a1';
    self_edit_ok := true;
  exception when others then self_edit_ok := false; end;
  assert self_edit_ok, 'FAIL: a non-role self-edit was blocked — guard over-broad';
end $$;
reset role;

-- ── legit: an OWNER changing a role must still work (guard not over-broad) ──
do $$
declare ownr uuid; owner_change_ok boolean := false;
begin
  select id into ownr from public.profiles where role = 'owner' limit 1;
  assert ownr is not null, 'precondition: an owner must exist';
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', ownr::text, 'role', 'authenticated')::text, true);
  begin
    update public.profiles set role = 'coach' where id = '00000000-0000-0000-0000-0000000000a1';
    owner_change_ok := true;
  exception when others then owner_change_ok := false; end;
  perform set_config('role', 'postgres', true);
  assert owner_change_ok, 'FAIL: an owner could not change a role — guard over-blocks';
  raise notice 'PASS: parent self-escalation blocked; self-edit ok; owner role-change ok';
end $$;

rollback;

-- RLS: an AUTHENTICATED parent (not anon) is blocked from events AND attendance —
-- read and write. Anon-only tests pass for a degenerate reason (no JWT →
-- current_role() is NULL → denied), so they'd miss a policy loosened to
-- `current_role() is not null`. This proves coach/owner-only for the exact
-- principal it must exclude. PASS = no error. Self-rolls-back.
do $$
declare
  parent_uid uuid := gen_random_uuid();
  the_team   uuid;
  the_event  uuid;
  the_player uuid;
  visible_events int;
  visible_attendance int;
  event_write_blocked boolean := false;
  attendance_write_blocked boolean := false;
begin
  -- seed staff-visible rows (as the table owner, bypassing RLS)
  insert into public.teams (category, name) values ('league', 'RLS Probe Team')
    returning id into the_team;
  insert into public.events (team_id, title, type, starts_at)
    values (the_team, 'RLS Probe Session', 'training', now()) returning id into the_event;
  insert into public.players (team_id, full_name) values (the_team, 'RLS Probe Kid')
    returning id into the_player;
  insert into public.attendance (event_id, player_id, status, client_id)
    values (the_event, the_player, 'present', gen_random_uuid());

  -- a real authenticated parent: the auth.users insert fires the M1 auto-create
  -- trigger (role 'coach', since an owner exists), so we update to 'parent'.
  insert into auth.users (id, instance_id, aud, role, email)
    values (parent_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'rls-probe-parent-m3@test.local');
  update public.profiles set role = 'parent' where id = parent_uid;

  -- become that authenticated parent
  perform set_config('request.jwt.claims',
    json_build_object('sub', parent_uid::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- (a) parent reads nothing
  select count(*) into visible_events from public.events;
  select count(*) into visible_attendance from public.attendance;

  -- (b) parent writes are denied (insufficient_privilege = 42501)
  begin
    insert into public.events (team_id, title, type, starts_at)
      values (the_team, 'hacked', 'match', now());
  exception when insufficient_privilege then event_write_blocked := true;
  end;
  begin
    insert into public.attendance (event_id, player_id, status, client_id)
      values (the_event, the_player, 'absent', gen_random_uuid());
  exception when insufficient_privilege then attendance_write_blocked := true;
  end;

  reset role;
  perform set_config('request.jwt.claims', NULL, true);

  assert visible_events = 0, format('FAIL: parent saw %s events', visible_events);
  assert visible_attendance = 0, format('FAIL: parent saw %s attendance', visible_attendance);
  assert event_write_blocked, 'FAIL: parent could insert an event';
  assert attendance_write_blocked, 'FAIL: parent could insert attendance';
  raise notice 'PASS: authenticated parent blocked from events + attendance (read + write)';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

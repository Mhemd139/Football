-- RLS: an AUTHENTICATED parent (not anon) is blocked from teams AND players —
-- read and write. The anon-only tests pass for a degenerate reason (no JWT →
-- current_role() is NULL → denied), so they'd miss a policy loosened to
-- `current_role() is not null`. This proves the coach/owner-only invariant for
-- the exact principal it must exclude. PASS = no error. Self-rolls-back.
do $$
declare
  parent_uid uuid := gen_random_uuid();
  visible_teams int;
  visible_players int;
  team_write_blocked boolean := false;
  player_write_blocked boolean := false;
  some_team uuid;
begin
  -- seed a staff-visible team + player (as the table owner, bypassing RLS)
  insert into public.teams (category, name) values ('league', 'RLS Probe Team')
    returning id into some_team;
  insert into public.players (team_id, full_name) values (some_team, 'RLS Probe Kid');

  -- a real authenticated parent: the auth.users insert fires the M1 auto-create
  -- trigger which makes the profiles row (role 'coach', since an owner exists),
  -- so we update it to 'parent' rather than insert (insert would hit profiles_pkey).
  insert into auth.users (id, instance_id, aud, role, email)
    values (parent_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'rls-probe-parent@test.local');
  update public.profiles set role = 'parent' where id = parent_uid;

  -- become that authenticated parent
  perform set_config('request.jwt.claims',
    json_build_object('sub', parent_uid::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- (a) parent reads nothing
  select count(*) into visible_teams from public.teams;
  select count(*) into visible_players from public.players;

  -- (b) parent writes are denied (insufficient_privilege = 42501)
  begin
    insert into public.teams (category, name) values ('league', 'hacked');
  exception when insufficient_privilege then team_write_blocked := true;
  end;
  begin
    insert into public.players (team_id, full_name) values (some_team, 'hacked');
  exception when insufficient_privilege then player_write_blocked := true;
  end;

  reset role;
  perform set_config('request.jwt.claims', NULL, true);

  assert visible_teams = 0, format('FAIL: parent saw %s teams', visible_teams);
  assert visible_players = 0, format('FAIL: parent saw %s players', visible_players);
  assert team_write_blocked, 'FAIL: parent could insert a team';
  assert player_write_blocked, 'FAIL: parent could insert a player';
  raise notice 'PASS: authenticated parent blocked from teams + players (read + write)';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

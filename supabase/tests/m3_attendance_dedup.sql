-- M3 offline correctness: a roster marked offline then synced TWICE (the classic
-- flaky-network replay) must land exactly one row per client_id, with the second
-- sync UPDATING the row (coach corrected present->late offline), not duplicating.
-- This is the North Star's data guarantee. PASS = no error. Self-rolls-back.
do $$
declare
  the_team  uuid;
  the_event uuid;
  p1 uuid; p2 uuid;
  cid1 uuid := gen_random_uuid();
  cid2 uuid := gen_random_uuid();
  total_rows int;
  p1_status public.attendance_status;
  p1_synced_1 timestamptz;
  p1_synced_2 timestamptz;
begin
  -- seed a team, event, and two players (as table owner, bypassing RLS)
  insert into public.teams (category, name) values ('league', 'Dedup Probe')
    returning id into the_team;
  insert into public.events (team_id, title, type, starts_at)
    values (the_team, 'Probe Session', 'training', now()) returning id into the_event;
  insert into public.players (team_id, full_name) values (the_team, 'Dedup Kid 1')
    returning id into p1;
  insert into public.players (team_id, full_name) values (the_team, 'Dedup Kid 2')
    returning id into p2;

  -- FIRST sync: both present (the offline batch as originally recorded). The app
  -- (mapRows) stamps synced_at on every upsert row; we mirror that here with an
  -- explicit value so the refresh assertion below is deterministic.
  insert into public.attendance (event_id, player_id, status, client_id, synced_at) values
    (the_event, p1, 'present', cid1, '2020-01-01T00:00:00Z'),
    (the_event, p2, 'present', cid2, '2020-01-01T00:00:00Z')
  on conflict (client_id) do update set
    status = excluded.status, reason_minutes = excluded.reason_minutes,
    reason_cause = excluded.reason_cause, synced_at = excluded.synced_at;
  select synced_at into p1_synced_1 from public.attendance where client_id = cid1;

  -- SECOND sync: same client_ids, but p1 was corrected to 'late' offline before
  -- the replay, and re-synced later. A correct upsert updates p1 in place, adds
  -- none, AND refreshes synced_at (the DB default fires only on INSERT — the app
  -- must send synced_at on every upsert or it would keep the first-sync time).
  insert into public.attendance (event_id, player_id, status, reason_minutes, client_id, synced_at) values
    (the_event, p1, 'late', 10, cid1, '2024-06-01T00:00:00Z'),
    (the_event, p2, 'present', null, cid2, '2024-06-01T00:00:00Z')
  on conflict (client_id) do update set
    status = excluded.status, reason_minutes = excluded.reason_minutes,
    reason_cause = excluded.reason_cause, synced_at = excluded.synced_at;

  select count(*) into total_rows from public.attendance where event_id = the_event;
  select status into p1_status from public.attendance where client_id = cid1;
  select synced_at into p1_synced_2 from public.attendance where client_id = cid1;

  assert total_rows = 2, format('DEDUP FAIL: expected 2 rows, got %s', total_rows);
  assert p1_status = 'late', format('UPSERT FAIL: p1 stayed %s, expected late', p1_status);
  assert p1_synced_2 > p1_synced_1,
    format('SYNCED_AT FAIL: re-sync left synced_at at %s (expected after %s)', p1_synced_2, p1_synced_1);
  raise notice 'PASS: double-sync yields one row per client_id; second sync updates status + refreshes synced_at';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

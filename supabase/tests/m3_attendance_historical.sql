-- M3 history integrity: an attendance mark is a point-in-time fact. A player
-- marked for a session, then DEACTIVATED later, must keep their mark — and the
-- mark must still be queryable by event_id so a past event's breakdown
-- reconciles against what was actually saved (Atlas ruling).
--
-- getEventRoster derives the live-vs-historical split in TS (active players ∪
-- players with a mark); that union can't run in SQL. This asserts the DB half
-- the union stands on: deactivating a player neither deletes nor hides their
-- attendance row. PASS = no error. Self-rolls-back.
do $$
declare
  the_team uuid; the_event uuid; gone_kid uuid;
  cid uuid := gen_random_uuid();
  marks_for_event int;
  still_present boolean;
begin
  select id into the_team from public.teams where category = 'league' limit 1;
  insert into public.players (team_id, full_name) values (the_team, 'Historical Probe Kid')
    returning id into gone_kid;
  insert into public.events (team_id, title, type, starts_at)
    values (the_team, 'Historical Probe Session', 'training', '2026-07-01T17:00:00Z')
    returning id into the_event;

  -- The kid was present at that session.
  insert into public.attendance (event_id, player_id, status, client_id)
    values (the_event, gone_kid, 'present', cid);

  -- ...and is deactivated afterwards (left the club).
  update public.players set active = false where id = gone_kid;

  -- The mark must survive the deactivation, still tied to the event + player.
  select count(*) into marks_for_event
    from public.attendance where event_id = the_event and player_id = gone_kid;
  assert marks_for_event = 1,
    format('HISTORY FAIL: expected the deactivated player''s mark to persist, got %s rows', marks_for_event);

  -- ...with its original status intact (the past is not rewritten).
  select (status = 'present') into still_present
    from public.attendance where event_id = the_event and player_id = gone_kid;
  assert still_present,
    'HISTORY FAIL: the persisted mark lost its original status';

  -- And the player row is still resolvable by id (the TS union fetches these by
  -- id, NOT filtered by active) — so the historical roster can name them.
  perform 1 from public.players where id = gone_kid; -- exists regardless of active
  assert found, 'HISTORY FAIL: the deactivated player row is not resolvable by id';

  raise notice 'PASS: deactivated player keeps their mark (1 row, status intact, row resolvable by id)';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

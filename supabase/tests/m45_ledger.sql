-- M4.5 transaction ledger: listPayments is a coach/owner read over the payment
-- → due → player join. The TS layer shapes/filters via PostgREST embeds (the
-- `due.period` / `due.player_id` embedded-column filters, same pattern as
-- generateDues' `teams.category` filter) and coerces money via money() — that
-- path is TS-only. This asserts the DB half the ledger stands on: the two-hop
-- join resolves, returns one row per payment with the player's name + the due's
-- period, and is selectable by player and by period. PASS = no error. Self-rolls-back.
do $$
declare
  the_team uuid; kid_a uuid; kid_b uuid; due_a uuid; due_b uuid;
  cid uuid := gen_random_uuid();
  cid2 uuid := gen_random_uuid();
  cid3 uuid := gen_random_uuid();
  total_rows int; rows_for_a int; rows_for_period int;
  a_name text; a_period text; a_amount numeric;
begin
  select id into the_team from public.teams where category = 'league' limit 1;
  insert into public.players (team_id, full_name, jersey_number) values (the_team, 'Ledger Kid A', 7)
    returning id into kid_a;
  insert into public.players (team_id, full_name, jersey_number) values (the_team, 'Ledger Kid B', 9)
    returning id into kid_b;

  insert into public.dues (player_id, period, amount_due, due_date)
    values (kid_a, '2026-07-01', 150, '2026-07-10') returning id into due_a;
  insert into public.dues (player_id, period, amount_due, due_date)
    values (kid_b, '2026-08-01', 150, '2026-08-10') returning id into due_b;

  -- Two payments on A's July due, one on B's August due.
  insert into public.payments (due_id, amount, method, client_id, paid_at)
    values (due_a, 100, 'cash', cid, '2026-07-05T10:00:00Z');
  insert into public.payments (due_id, amount, method, client_id, paid_at)
    values (due_a, 50, 'transfer', cid2, '2026-07-06T10:00:00Z');
  insert into public.payments (due_id, amount, method, client_id, paid_at)
    values (due_b, 150, 'cash', cid3, '2026-08-05T10:00:00Z');

  -- The full ledger (the join the TS read runs, unfiltered) sees all three.
  select count(*) into total_rows
    from public.payments p
    join public.dues d on d.id = p.due_id
    join public.players pl on pl.id = d.player_id
    where d.player_id in (kid_a, kid_b);
  assert total_rows = 3, format('LEDGER FAIL: expected 3 payments across the two kids, got %s', total_rows);

  -- Filter by player (the `due.player_id` embedded filter) → only A's two rows.
  select count(*) into rows_for_a
    from public.payments p
    join public.dues d on d.id = p.due_id
    where d.player_id = kid_a;
  assert rows_for_a = 2, format('LEDGER FAIL: expected 2 payments for kid A, got %s', rows_for_a);

  -- Filter by period (the `due.period` embedded filter) → only the August row.
  select count(*) into rows_for_period
    from public.payments p
    join public.dues d on d.id = p.due_id
    where d.player_id in (kid_a, kid_b) and d.period = '2026-08-01';
  assert rows_for_period = 1, format('LEDGER FAIL: expected 1 payment in 2026-08, got %s', rows_for_period);

  -- A ledger row carries the embedded player name + the due's period, not a UUID.
  select pl.full_name, d.period, p.amount
    into a_name, a_period, a_amount
    from public.payments p
    join public.dues d on d.id = p.due_id
    join public.players pl on pl.id = d.player_id
    where p.client_id = cid;
  assert a_name = 'Ledger Kid A', format('LEDGER FAIL: expected player name on the row, got %L', a_name);
  assert a_period = '2026-07-01', format('LEDGER FAIL: expected the due period on the row, got %L', a_period);
  assert a_amount = 100.00, format('LEDGER FAIL: expected amount 100.00 on the row, got %s', a_amount);

  raise notice 'PASS: ledger join resolves (3 rows), filters by player (2) + period (1), carries name + period';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

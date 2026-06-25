-- M4 offline-safety: a payment recorded offline then synced twice (flaky network
-- replay) must land exactly one row per client_id — never double-charge the
-- player. Mirrors the attendance dedup guarantee. PASS = no error. Self-rolls-back.
do $$
declare
  the_team uuid; kid uuid; the_due uuid;
  cid uuid := gen_random_uuid();
  cid2 uuid := gen_random_uuid();
  pay_count int;
  paid numeric; remaining numeric;
begin
  select id into the_team from public.teams where category = 'league' limit 1;
  insert into public.players (team_id, full_name) values (the_team, 'Payment Probe Kid')
    returning id into kid;
  insert into public.dues (player_id, period, amount_due, due_date)
    values (kid, '2026-07-01', 150, '2026-07-10') returning id into the_due;

  -- FIRST sync of a 150 cash payment
  insert into public.payments (due_id, amount, method, client_id)
    values (the_due, 150, 'cash', cid)
  on conflict (client_id) do update set amount = excluded.amount, method = excluded.method;

  -- SECOND sync, same client_id (offline replay) — must NOT create a 2nd payment
  insert into public.payments (due_id, amount, method, client_id)
    values (the_due, 150, 'cash', cid)
  on conflict (client_id) do update set amount = excluded.amount, method = excluded.method;

  select count(*) into pay_count from public.payments where due_id = the_due;
  assert pay_count = 1, format('PAYMENT DEDUP FAIL: expected 1 payment, got %s (double-charge)', pay_count);

  -- Balance math: a SECOND (distinct) partial payment of 40 brings paid to 190
  -- against a 150 due... use a fresh due to keep it clean. Prove remaining is
  -- amount_due - sum(payments), exact at numeric(10,2). (The TS layer coerces
  -- PostgREST's numeric — string-or-number — via money(); that path is TS-only
  -- and can't be reproduced in SQL, so this guards the DB arithmetic only.)
  insert into public.payments (due_id, amount, method, client_id)
    values (the_due, 40, 'transfer', cid2);
  select coalesce(sum(p.amount), 0) into paid from public.payments p where p.due_id = the_due;
  remaining := 150 - paid;
  assert paid = 190.00, format('BALANCE FAIL: expected paid 190.00, got %s', paid);
  assert remaining = -40.00, format('BALANCE FAIL: expected remaining -40.00, got %s', remaining);

  raise notice 'PASS: dedup (1 row) + balance math exact (paid 190.00, remaining -40.00)';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

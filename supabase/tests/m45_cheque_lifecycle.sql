-- M4.5 cheque lifecycle: the load-bearing money correctness. A cheque is logged
-- 'pending' (doesn't count yet), can 'bounce' (un-pays — the due reopens), and is
-- traced back to its player by its number alone. The balance math is the read-time
-- "cleared-only" sum (TS sumPayments); these asserts prove the DB facts that sum
-- stands on. PASS = no error. Self-rolls-back.
do $$
declare
  the_team uuid; kid uuid; the_due uuid;
  cid uuid := gen_random_uuid();
  cleared_sum numeric;   -- the TS money() layer sums WHERE status='cleared'
  bad_ok boolean;
  resolved_name text; resolved_status public.payment_status;
begin
  select id into the_team from public.teams where category = 'league' limit 1;
  insert into public.players (team_id, full_name) values (the_team, 'Cheque Probe Kid')
    returning id into kid;
  insert into public.dues (player_id, period, amount_due, due_date)
    values (kid, '2026-07-01', 150, '2026-07-10') returning id into the_due;

  -- (A) CHECK: a cheque with NO number is rejected by the DB.
  begin
    insert into public.payments (due_id, amount, method, client_id)
      values (the_due, 150, 'cheque', gen_random_uuid());
    bad_ok := true;
  exception when check_violation then bad_ok := false;
  end;
  assert bad_ok = false, 'CHECK FAIL: a numberless cheque was allowed';

  -- (B) CHECK: a cash payment WITH a cheque number is rejected.
  begin
    insert into public.payments (due_id, amount, method, client_id, cheque_number)
      values (the_due, 150, 'cash', gen_random_uuid(), '9001');
    bad_ok := true;
  exception when check_violation then bad_ok := false;
  end;
  assert bad_ok = false, 'CHECK FAIL: a cash row with a cheque number was allowed';

  -- Log a real cheque for the full 150, number 9001, status pending (as recordPayment does).
  insert into public.payments (due_id, amount, method, status, cheque_number, client_id)
    values (the_due, 150, 'cheque', 'pending', '9001', cid);

  -- (C) PENDING does not count toward paid → the due is NOT yet covered.
  select coalesce(sum(amount), 0) into cleared_sum
    from public.payments where due_id = the_due and status = 'cleared';
  assert cleared_sum = 0, format('PENDING FAIL: a pending cheque counted as paid (cleared sum %s)', cleared_sum);

  -- (D) Resolve the cheque by its number ALONE back to the player who gave it
  -- (findPaymentByChequeNumber's job — the bank returns only the number).
  select pl.full_name, p.status
    into resolved_name, resolved_status
    from public.payments p
    join public.dues d on d.id = p.due_id
    join public.players pl on pl.id = d.player_id
    where p.cheque_number = '9001';
  assert resolved_name = 'Cheque Probe Kid',
    format('RESOLVE FAIL: cheque 9001 did not resolve to the right player, got %L', resolved_name);

  -- The cheque CLEARS → now it counts, the due is covered.
  update public.payments set status = 'cleared' where client_id = cid;
  select coalesce(sum(amount), 0) into cleared_sum
    from public.payments where due_id = the_due and status = 'cleared';
  assert cleared_sum = 150.00, format('CLEAR FAIL: cleared cheque should count 150, got %s', cleared_sum);

  -- (E) The cheque BOUNCES → it stops counting (the due REOPENS) but the row STAYS
  -- visible (markChequeBounced: status=bounced, never a delete).
  update public.payments set status = 'bounced' where client_id = cid;
  select coalesce(sum(amount), 0) into cleared_sum
    from public.payments where due_id = the_due and status = 'cleared';
  assert cleared_sum = 0, format('BOUNCE FAIL: a bounced cheque still counted as paid (cleared sum %s)', cleared_sum);
  perform 1 from public.payments where client_id = cid and status = 'bounced';
  assert found, 'BOUNCE FAIL: the bounced cheque row vanished — it must stay visible to chase';

  raise notice 'PASS: CHECK guards both ways; pending=0, cleared=150, bounced reopens to 0 (row stays); number resolves to player';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

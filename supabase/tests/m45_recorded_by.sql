-- M4.5 cash accountability (Atlas/owner ruling 2026-06-28): the ledger must show
-- WHO logged each transaction. recorded_by is set server-side from auth.uid() in
-- recordPayment (never trusted from the client) and shown via a recorded_by →
-- profiles(full_name) embed. The auth.uid() stamp is TS/session-only (can't run in
-- a raw SQL block), so this asserts the DB facts the feature stands on: the embed
-- resolves to the logger's name, and a bounce PRESERVES the original logger (who
-- the owner chases) rather than overwriting it. PASS = no error. Self-rolls-back.
do $$
declare
  the_team uuid; kid uuid; the_due uuid; staff uuid; staff_name text;
  cid uuid := gen_random_uuid();
  joined_name text; rb_after uuid;
begin
  select id, full_name into staff, staff_name from public.profiles limit 1;
  if staff is null then
    raise notice 'SKIP: no profiles exist to attribute a payment to';
    raise exception 'rollback_marker';
  end if;

  select id into the_team from public.teams where category = 'league' limit 1;
  insert into public.players (team_id, full_name) values (the_team, 'Actor Probe Kid')
    returning id into kid;
  insert into public.dues (player_id, period, amount_due, due_date)
    values (kid, '2026-07-01', 150, '2026-07-10') returning id into the_due;

  -- A cheque logged BY that staff member (recordPayment stamps recorded_by).
  insert into public.payments (due_id, amount, method, status, cheque_number, client_id, recorded_by)
    values (the_due, 150, 'cheque', 'pending', '7777', cid, staff);

  -- The recorded_by -> profiles embed resolves to the logger's name.
  select pr.full_name into joined_name
    from public.payments p join public.profiles pr on pr.id = p.recorded_by
    where p.client_id = cid;
  assert joined_name is not distinct from staff_name,
    format('ACTOR FAIL: logger name did not resolve, expected %L got %L', staff_name, joined_name);

  -- Bounce — recorded_by MUST survive (original logger is who the owner chases),
  -- never overwritten by the bouncer.
  update public.payments set status = 'bounced' where client_id = cid;
  select recorded_by into rb_after from public.payments where client_id = cid;
  assert rb_after = staff,
    format('ACTOR FAIL: bounce changed recorded_by, expected %L got %L', staff, rb_after);

  raise notice 'PASS: recorded_by resolves to the logger via the profiles embed, and survives a bounce';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

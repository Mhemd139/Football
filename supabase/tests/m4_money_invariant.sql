-- M4 INVARIANT TEST: the highest-consequence correctness property in the app.
-- A Bogrim must be REJECTED from dues; a kid must be REJECTED from salaries —
-- enforced by BEFORE INSERT/UPDATE triggers resolving player -> team -> category
-- (a CHECK can't cross tables). Also proves the legit paths succeed.
-- PASS = no error. Self-rolls-back.
do $$
declare
  kid_team uuid; bog_team uuid;
  kid uuid; bog uuid;
  dues_rejected boolean := false;
  salary_rejected boolean := false;
  kid_dues_ok boolean := false;
  bog_salary_ok boolean := false;
begin
  select id into kid_team from public.teams where category = 'beet_sefer' limit 1;
  select id into bog_team from public.teams where category = 'bogrim' limit 1;
  insert into public.players (team_id, full_name) values (kid_team, 'Invariant Kid')
    returning id into kid;
  insert into public.players (team_id, full_name, monthly_salary) values (bog_team, 'Invariant Bogrim', 4000)
    returning id into bog;

  -- (a) Bogrim into dues -> MUST be rejected
  begin
    insert into public.dues (player_id, period, amount_due, due_date)
      values (bog, '2026-07-01', 150, '2026-07-10');
  exception when others then dues_rejected := true;
  end;

  -- (b) kid into salaries -> MUST be rejected
  begin
    insert into public.salaries (player_id, period, amount)
      values (kid, '2026-07-01', 150);
  exception when others then salary_rejected := true;
  end;

  -- (c) the legit paths MUST succeed
  begin
    insert into public.dues (player_id, period, amount_due, due_date)
      values (kid, '2026-07-01', 150, '2026-07-10');
    kid_dues_ok := true;
  exception when others then kid_dues_ok := false;
  end;
  begin
    insert into public.salaries (player_id, period, amount)
      values (bog, '2026-07-01', 4000);
    bog_salary_ok := true;
  exception when others then bog_salary_ok := false;
  end;

  assert dues_rejected, 'INVARIANT FAIL: a Bogrim was allowed into dues';
  assert salary_rejected, 'INVARIANT FAIL: a kid was allowed into salaries';
  assert kid_dues_ok, 'FAIL: a legit kid was rejected from dues';
  assert bog_salary_ok, 'FAIL: a legit Bogrim was rejected from salaries';
  raise notice 'PASS: Bogrim->dues REJECTED, kid->salaries REJECTED, legit paths OK';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

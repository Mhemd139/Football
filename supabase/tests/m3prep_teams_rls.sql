-- M3-prep RLS: anon cannot read teams. PASS = no error. Self-rolls-back.
do $$
declare anon_count int;
begin
  insert into public.teams (category, name) values ('league', 'Test Team');
  set local role anon;
  select count(*) into anon_count from public.teams;
  reset role;
  assert anon_count = 0, format('RLS FAIL: anon saw %s teams', anon_count);
  raise notice 'PASS: anon blocked from teams';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

-- M2 RLS: anon cannot read players. PASS = no error. Self-rolls-back.
do $$
declare anon_count int;
begin
  insert into public.players (category, full_name) values ('beet_sefer', 'Test Kid');
  set local role anon;
  select count(*) into anon_count from public.players;
  reset role;
  assert anon_count = 0, format('RLS FAIL: anon saw %s rows', anon_count);
  raise notice 'PASS: anon blocked from players';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back';
  else raise; end if;
end $$;

-- M1 invariant: first profile -> owner, rest -> coach, never two owners.
-- Rolls itself back (touches nothing). Run via Supabase MCP execute_sql or psql.
-- PASS = no error raised. Any assert failure throws.
do $$
declare u1 uuid; u2 uuid; r1 text; r2 text;
begin
  insert into auth.users (id, instance_id, aud, role)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
    returning id into u1;
  insert into auth.users (id, instance_id, aud, role)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
    returning id into u2;

  select role into r1 from public.profiles where id = u1;
  select role into r2 from public.profiles where id = u2;

  assert r1 = 'owner', format('first user must be owner, got %s', r1);
  assert r2 = 'coach', format('second user must be coach, got %s', r2);

  begin
    update public.profiles set role = 'owner' where id = u2;
    raise exception 'FAIL: a second owner was allowed';
  exception when unique_violation then
    null; -- expected: partial unique index blocks it
  end;

  raise notice 'PASS: first=owner, second=coach, second-owner blocked';
  raise exception 'rollback_marker';
exception when others then
  if sqlerrm = 'rollback_marker' then raise notice 'rolled back, no data left';
  else raise; end if;
end $$;

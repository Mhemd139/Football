-- Auto-create a profile when a new auth.users row appears.
-- Client never inserts into profiles -> no race, profile always exists post-OTP.
-- The before-insert set_first_owner trigger still decides owner vs coach.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Client no longer inserts profiles; drop the self-insert policy (the trigger owns creation).
drop policy if exists profiles_insert_self on public.profiles;

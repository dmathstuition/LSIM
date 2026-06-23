-- migration_setup.sql  ·  run in Supabase SQL editor AFTER schema + migration_arms

-- 1. Auto-create a profiles row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, fullname, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'fullname', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Backfill: you already signed up BEFORE the trigger existed, so make
--    your profile now (otherwise classes can't reference your teacher id).
insert into public.profiles (id, fullname, email)
select id, coalesce(raw_user_meta_data->>'fullname', email), email
from auth.users
on conflict (id) do nothing;

-- 3. Seed a subject so the score-entry dropdown isn't empty.
insert into subjects (subject_name) values ('Mathematics')
on conflict (subject_name) do nothing;

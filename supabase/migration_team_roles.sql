-- migration_team_roles.sql  ·  run AFTER migration_laims.sql
-- ============================================================
-- Lets an ADMIN manage other users' roles from the app (Settings → Team & roles),
-- instead of running SQL each time. Admins can read every profile and change the
-- `role` column (teacher / supervisor / admin). Everyone else is unaffected — the
-- existing "own profile" policy still governs normal users.
--
-- Bootstrap the first admin once by hand (they then manage the rest in-app):
--   update profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================

create or replace function public.is_admin() returns boolean
  language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- Admins can see every profile (to list the team) ...
create policy "admin read profiles" on profiles
  for select using (public.is_admin());

-- ... and update them (in practice, just the role).
create policy "admin manage roles" on profiles
  for update using (public.is_admin()) with check (public.is_admin());

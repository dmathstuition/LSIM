-- migration_laims.sql  ·  run AFTER schema.sql + migration_arms.sql + migration_setup.sql
-- ============================================================
-- Turns the single-teacher tracker into a LAIMS by adding a
-- read-only SUPERVISOR / ADMIN oversight role on top of the
-- existing teacher-owns-everything RLS spine.
--
-- RLS policies are PERMISSIVE by default, so the "supervisor read"
-- SELECT policies below simply OR with the existing teacher
-- policies: a teacher still sees only their own rows; a supervisor
-- additionally sees everyone's (read-only — no write policy added).
--
-- Promote a user to supervisor after they have signed up:
--   update profiles set role = 'supervisor' where email = 'head@school.org';
-- (allowed roles: 'teacher' | 'supervisor' | 'admin')
-- ============================================================

-- Caller's role check. security definer so it can read profiles
-- regardless of the caller's own row-level visibility.
create or replace function public.is_supervisor()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('supervisor', 'admin')
  );
$$;

-- Read-across-teachers policies. Idempotent: drop-then-create.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'classes','learners','scores','attendance','assignments',
    'submissions','weekly_tracker','interventions','evidence','profiles'
  ]
  loop
    execute format('drop policy if exists "supervisor read" on %I;', tbl);
    execute format(
      'create policy "supervisor read" on %I for select using (public.is_supervisor());',
      tbl
    );
  end loop;
end $$;

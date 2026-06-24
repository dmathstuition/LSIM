-- migration_subjects.sql  ·  run AFTER schema.sql
-- ============================================================
-- schema.sql ships only SELECT + INSERT policies on `subjects`, so renaming or
-- deleting a subject is blocked by RLS. Add update + delete for any signed-in
-- user (subjects are a shared lookup). Deleting a subject that still has scores
-- is additionally blocked by the FK (`scores.subject_id` is ON DELETE RESTRICT),
-- which the UI surfaces as a friendly message.
-- ============================================================

drop policy if exists "subjects update" on subjects;
drop policy if exists "subjects delete" on subjects;

create policy "subjects update" on subjects for update
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "subjects delete" on subjects for delete
  using (auth.uid() is not null);

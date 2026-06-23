-- migration_evidence_storage.sql
-- Run AFTER creating a PRIVATE Storage bucket named 'evidence'
-- (Supabase dashboard → Storage → New bucket → uncheck "Public").
--
-- Locks every file to the teacher who uploaded it via the path convention
--   evidence/<auth.uid()>/<weekly_tracker_id>/<filename>
-- so the first path segment must equal the caller's uid. These are the two
-- policies left commented at the bottom of schema.sql, made runnable + idempotent.

drop policy if exists "own files read"   on storage.objects;
drop policy if exists "own files write"  on storage.objects;
drop policy if exists "own files delete" on storage.objects;

create policy "own files read" on storage.objects for select
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own files write" on storage.objects for insert
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own files delete" on storage.objects for delete
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

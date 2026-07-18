-- migration_learner_groups.sql  ·  run any time after schema.sql
-- ============================================================
-- Adds learner attributes so the dashboard can compare cohorts:
--   SEND (special educational needs) vs not, International vs Local,
--   Boarding vs Day. Gender already exists on learners.
-- All nullable/defaulted, so existing learners are unaffected (they simply show
-- as "Unspecified" in a group breakdown until set).
-- ============================================================

alter table learners add column if not exists sen       boolean not null default false;
alter table learners add column if not exists residency text;   -- 'Day' | 'Boarding'
alter table learners add column if not exists origin    text;   -- 'International' | 'Local'

comment on column learners.sen       is 'Special Educational Needs & Disabilities flag.';
comment on column learners.residency is 'Day | Boarding.';
comment on column learners.origin    is 'International | Local.';

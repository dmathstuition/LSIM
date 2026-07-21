-- migration_school_band.sql — the SCHOOL's own HPA/LPA designation.
-- The dashboard already derives an LPA/HPA tier from each learner's average
-- (no storage). This adds the school's *manual* judgement as a stored attribute
-- so the two can be compared (agreement/mismatch) and the determined vs
-- not-determined cohorts tracked. NULL = the school hasn't categorised them.
alter table learners add column if not exists school_band text
  check (school_band in ('HPA', 'LPA'));

comment on column learners.school_band is
  'School-assigned achiever band: HPA (high performing achiever), LPA (low performing achiever), or NULL when not determined.';

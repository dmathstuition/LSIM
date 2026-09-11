-- migration_reset_data.sql — WIPE ALL OPERATIONAL DATA, KEEP LOGINS.
--
-- Run this ONCE in the Supabase SQL editor to clear the sample/demo data and
-- start fresh. It empties every operational table (subjects/courses, classes,
-- learners, scores, attendance, assignments, submissions, weekly tracker,
-- evidence rows, interventions) but LEAVES `profiles` and the Supabase `auth`
-- users untouched — so you stay logged in and keep your team/roles.
--
-- ⚠️  This is irreversible. Export anything you want to keep first
--     (the dashboard's Export CSV and the /reports broadsheet CSV).
--
-- TRUNCATE ... CASCADE clears the listed tables and anything referencing them;
-- because nothing here references `profiles`, your accounts are safe.

truncate table
  interventions,
  weekly_tracker,
  evidence,
  submissions,
  assignments,
  attendance,
  scores,
  learners,
  classes,
  subjects
restart identity cascade;

-- Note: uploaded evidence FILES in the private `evidence` Storage bucket are not
-- removed by this (SQL can't delete storage objects). Delete them from
-- Supabase → Storage → evidence if you want a totally clean bucket too.

-- migration_enrollment.sql  ·  run AFTER schema.sql + migration_trend.sql
-- ============================================================
-- Fair handling of learners who join mid-session (Term 2 or 3).
--
-- Adds learners.enrolled_on: the date a learner started in the class. Where it
-- is set, the early-warning view only counts attendance and assignments on/after
-- that date, so a late joiner is never blamed for the period before they arrived
-- (missed registers, assignments due before they enrolled). NULL means "present
-- from the start of the data" — existing learners are unaffected.
--
-- Score averages already only span the terms a learner actually has marks for,
-- so no score change is needed.
--
-- Views are DROPPED and recreated (column list is unchanged, but we redefine the
-- attendance/assignment CTEs). Drop the dependent level view first.
-- ============================================================

alter table learners add column if not exists enrolled_on date;
comment on column learners.enrolled_on is
  'Date the learner joined the class; NULL = present from the start. Scopes attendance & assignment expectations in learner_risk.';

drop view if exists learner_risk_level;
drop view if exists learner_risk;

create view learner_risk with (security_invoker = true) as
with score_stats as (
  select learner_id, avg(total) as avg_total from scores group by learner_id),
-- attendance only counts on/after the learner's enrolment date.
att_stats as (
  select a.learner_id,
         count(*) filter (where a.status='Present')::numeric
           / nullif(count(*),0) * 100 as attendance_pct
  from attendance a
  join learners l on l.id = a.learner_id
  where l.enrolled_on is null or a.date >= l.enrolled_on
  group by a.learner_id),
-- missing-assignment count ignores assignments due before the learner enrolled.
asg_stats as (
  select s.learner_id,
         count(*) filter (where s.status='Not Submitted') as missing_count
  from submissions s
  join assignments a on a.id = s.assignment_id
  join learners   l on l.id = s.learner_id
  where l.enrolled_on is null or a.due_date is null or a.due_date >= l.enrolled_on
  group by s.learner_id),
-- term-over-term trend: rank each learner's term averages newest-first, then
-- subtract the previous term's average from the latest.
term_avgs as (
  select learner_id, session, term, avg(total) as t_avg
  from scores group by learner_id, session, term),
ranked as (
  select *, row_number() over (
    partition by learner_id order by session desc, term desc) as rn
  from term_avgs),
trend as (
  select latest.learner_id, latest.t_avg - prev.t_avg as delta
  from ranked latest
  join ranked prev on prev.learner_id = latest.learner_id and prev.rn = 2
  where latest.rn = 1)
select
  l.id as learner_id, l.fullname, l.class_id,
  ss.avg_total,
  ats.attendance_pct,
  coalesce(asg.missing_count, 0) as missing_assignments,
  ( (case when ss.avg_total < 40 then 3 when ss.avg_total < 50 then 2 else 0 end)
  + (case when ats.attendance_pct < 60 then 2 when ats.attendance_pct < 75 then 1 else 0 end)
  + (case when coalesce(asg.missing_count,0) >= 3 then 2
          when coalesce(asg.missing_count,0) >= 1 then 1 else 0 end)
  + (case when tr.delta <= -10 then 2 when tr.delta <= -5 then 1 else 0 end)
  ) as risk_score,
  coalesce(tr.delta, 0) as score_delta
from learners l
left join score_stats ss  on ss.learner_id  = l.id
left join att_stats  ats  on ats.learner_id = l.id
left join asg_stats  asg  on asg.learner_id = l.id
left join trend      tr   on tr.learner_id  = l.id;

create view learner_risk_level with (security_invoker = true) as
select *,
  case when risk_score >= 6 then 'Critical'
       when risk_score >= 4 then 'High'
       when risk_score >= 2 then 'Medium'
       else 'Low' end as risk_level
from learner_risk;

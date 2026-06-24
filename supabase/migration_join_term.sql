-- migration_join_term.sql  ·  run AFTER migration_enrollment.sql
-- ============================================================
-- Switch the mid-term joiner model from an exact date to a TERM.
--
-- Replaces learners.enrolled_on (a date) with joined_session + joined_term.
-- NULL = present from the start (Term 1). The app compares (joined_session,
-- joined_term) lexically against the score's (session, term) — the same ordering
-- the trend view already relies on — to keep a learner who joined in Term 2 out
-- of the Term-1 score grid, so they are never entered as a 0 and never ranked
-- last in a term they were not around for.
--
-- Attendance and assignments need no scoping: a late joiner simply has no
-- attendance or submission rows before they arrived. The early-warning views are
-- therefore reverted to their migration_trend.sql definitions (they previously
-- referenced enrolled_on, which is dropped here).
-- ============================================================

alter table learners drop column if exists enrolled_on;
alter table learners add column if not exists joined_session text;
alter table learners add column if not exists joined_term    text;
comment on column learners.joined_term is
  'Term the learner joined (e.g. "Term 2"); NULL = present from Term 1. Hides them from earlier-term score entry/ranking.';
comment on column learners.joined_session is
  'Session matching joined_term (e.g. "2024/2025"); set from the arm''s academic_year.';

drop view if exists learner_risk_level;
drop view if exists learner_risk;

create view learner_risk with (security_invoker = true) as
with score_stats as (
  select learner_id, avg(total) as avg_total from scores group by learner_id),
att_stats as (
  select learner_id,
         count(*) filter (where status='Present')::numeric
           / nullif(count(*),0) * 100 as attendance_pct
  from attendance group by learner_id),
asg_stats as (
  select learner_id,
         count(*) filter (where status='Not Submitted') as missing_count
  from submissions group by learner_id),
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

-- migration_trend.sql  ·  run AFTER schema.sql (+ later migrations)
-- ============================================================
-- Adds the 4th early-warning signal the schema TODO called for: a
-- term-over-term DECLINING TREND. Compares each learner's latest term
-- average to their previous term average; a drop adds to risk_score.
--
-- Views must be DROPPED and recreated (not `create or replace`) because we
-- add a trailing `score_delta` column, which shifts column order in the
-- dependent learner_risk_level view. Drop the dependent view first.
-- ============================================================

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
-- term-over-term trend: rank each learner's term averages newest-first, then
-- subtract the previous term's average from the latest. Lexical ordering on
-- session ('2024/2025' < '2025/2026') and term ('Term 1' < 'Term 2') is correct.
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
  -- risk_score: four signals, max 9 (was 7 before the trend signal).
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

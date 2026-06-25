-- migration_join_term_analysis.sql  ·  run AFTER migration_join_term.sql
-- ============================================================
-- Exempt a learner's results for any term BEFORE they joined from ALL analysis.
--
-- migration_join_term.sql hides a Term-2 joiner from the Term-1 score-entry grid,
-- but the analysis views read straight from `scores` and so would still analyse /
-- rank a stray Term-1 row (entered before the join term was set, or imported).
-- This adds a join-term guard to the views every surface reads through, so a
-- 2nd-term joiner is never analysed or ranked in the first term — no app change.
--
-- Guard: a score row counts only when the learner has no join term, or joined on
-- or before that row's period.  (joined_session, joined_term) <= (s.session,
-- s.term) is a lexical Postgres row comparison, matching getEntryRows / the trend
-- ordering ('2024/2025' < '2025/2026', 'Term 1' < 'Term 2'). NULL-safe: learners
-- with no join term set are unaffected.
-- ============================================================

create or replace view score_report with (security_invoker = true) as
select
  s.id, s.learner_id, l.fullname, l.class_id, s.subject_id,
  s.first_ca, s.second_ca, s.exam, s.total, s.term, s.session, s.remarks,
  grade_for(s.total)            as grade,
  performance_category(s.total) as category,
  round(s.total, 2)             as percentage,
  -- filter runs before this window, so position only ranks learners present that term
  rank() over (
    partition by l.class_id, s.subject_id, s.term, s.session
    order by s.total desc
  ) as position
from scores s
join learners l on l.id = s.learner_id
where l.joined_session is null or l.joined_term is null
   or (l.joined_session, l.joined_term) <= (s.session, s.term);

drop view if exists learner_risk_level;
drop view if exists learner_risk;

create view learner_risk with (security_invoker = true) as
with score_stats as (
  select s.learner_id, avg(s.total) as avg_total
  from scores s join learners l on l.id = s.learner_id
  where l.joined_session is null or l.joined_term is null
     or (l.joined_session, l.joined_term) <= (s.session, s.term)
  group by s.learner_id),
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
  select s.learner_id, s.session, s.term, avg(s.total) as t_avg
  from scores s join learners l on l.id = s.learner_id
  where l.joined_session is null or l.joined_term is null
     or (l.joined_session, l.joined_term) <= (s.session, s.term)
  group by s.learner_id, s.session, s.term),
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

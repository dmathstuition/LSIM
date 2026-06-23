-- ============================================================
-- dmaths — Learner Tracking, v1 core schema  (Postgres / Supabase)
-- ------------------------------------------------------------
-- Scope: SINGLE-TEACHER core for your IJA classes.
-- Included: classes, learners, subjects, scores, attendance,
--           assignments + submissions, weekly accountability
--           tracker + evidence, interventions, early-warning.
-- Deliberately OMITTED from v1 (add later behind this same RLS spine):
--   - supervisor / admin roles + their dashboards
--   - audit logs / activity tracking
--   - any LLM "AI engine" (the examples in the spec are arithmetic)
-- ============================================================

-- ---------- Enums ----------
create type progress_status   as enum ('Not Started','Ongoing','Improved','Needs Further Support');
create type attendance_status as enum ('Present','Absent','Late');
create type submission_status as enum ('Submitted','Not Submitted','Late');
create type gender_type       as enum ('Male','Female','Other');

-- ---------- Profiles (one row per auth user) ----------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  fullname   text not null,
  email      text not null,
  department text,
  role       text not null default 'teacher',   -- 'teacher' now; supervisor/admin later
  created_at timestamptz not null default now()
);

-- ---------- Subjects (shared lookup) ----------
create table subjects (
  id           uuid primary key default gen_random_uuid(),
  subject_name text not null unique
);

-- ---------- Classes ----------
create table classes (
  id            uuid primary key default gen_random_uuid(),
  class_name    text not null,
  academic_year text not null,
  term          text not null,
  teacher_id    uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- ---------- Learners ----------
create table learners (
  id               uuid primary key default gen_random_uuid(),
  admission_number text not null,
  fullname         text not null,
  gender           gender_type,
  date_of_birth    date,
  class_id         uuid not null references classes(id) on delete cascade,
  guardian_name    text,
  guardian_phone   text,
  created_at       timestamptz not null default now(),
  unique (class_id, admission_number)
);

-- ---------- Scores ----------
-- Stores ONLY raw inputs + total. grade / percentage / position /
-- category are DERIVED in views below so they can never go stale
-- when another learner's score changes. (Assumes components sum to 100.)
create table scores (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  first_ca   numeric(5,2) not null default 0 check (first_ca  >= 0),
  second_ca  numeric(5,2) not null default 0 check (second_ca >= 0),
  exam       numeric(5,2) not null default 0 check (exam      >= 0),
  total      numeric(6,2) generated always as (first_ca + second_ca + exam) stored,
  remarks    text,
  term       text not null,
  session    text not null,
  created_at timestamptz not null default now(),
  unique (learner_id, subject_id, term, session)
);

-- ---------- Attendance ----------
create table attendance (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  date       date not null,
  status     attendance_status not null,
  created_at timestamptz not null default now(),
  unique (learner_id, date)
);

-- ---------- Assignments + Submissions ----------
create table assignments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  due_date    date,
  class_id    uuid not null references classes(id) on delete cascade,
  subject_id  uuid references subjects(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  learner_id    uuid not null references learners(id) on delete cascade,
  status        submission_status not null default 'Not Submitted',
  submitted_at  timestamptz,
  unique (assignment_id, learner_id)
);

-- ---------- Weekly accountability tracker + evidence ----------
create table weekly_tracker (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes(id) on delete cascade,
  subject_id     uuid references subjects(id) on delete set null,
  week_number    int  not null,
  topic          text,
  objectives     text,
  class_activity text,
  homework       text,
  participation  text,
  reflection     text,
  term           text,
  session        text,
  created_at     timestamptz not null default now()
);

create table evidence (
  id                uuid primary key default gen_random_uuid(),
  weekly_tracker_id uuid not null references weekly_tracker(id) on delete cascade,
  storage_path      text not null,     -- path inside the private 'evidence' Storage bucket
  file_type         text,
  uploaded_at       timestamptz not null default now()
);

-- ---------- Interventions ----------
create table interventions (
  id               uuid primary key default gen_random_uuid(),
  learner_id       uuid not null references learners(id) on delete cascade,
  issue            text not null,
  date_identified  date not null default current_date,
  strategy         text,
  expected_outcome text,
  actual_outcome   text,
  follow_up_date   date,
  status           progress_status not null default 'Not Started',
  created_at       timestamptz not null default now()
);

-- ============================================================
-- DERIVED LOGIC (computed on read — never stored, never stale)
-- ============================================================

create or replace function grade_for(t numeric)
returns text language sql immutable as $$
  select case
    when t >= 80 then 'A' when t >= 70 then 'B' when t >= 60 then 'C'
    when t >= 50 then 'D' when t >= 40 then 'E' else 'F' end;
$$;

create or replace function performance_category(t numeric)
returns text language sql immutable as $$
  select case
    when t >= 80 then 'Outstanding'        -- 80-100
    when t >= 70 then 'Very Good'          -- 70-79
    when t >= 60 then 'Good'               -- 60-69
    when t >= 50 then 'Fair'               -- 50-59
    when t >= 40 then 'Needs Improvement'  -- 40-49
    else 'At Risk' end;                    -- below 40
$$;

-- security_invoker = true => the querying user's RLS applies to this view.
create view score_report with (security_invoker = true) as
select
  s.id, s.learner_id, l.fullname, l.class_id, s.subject_id,
  s.first_ca, s.second_ca, s.exam, s.total, s.term, s.session, s.remarks,
  grade_for(s.total)            as grade,
  performance_category(s.total) as category,
  round(s.total, 2)             as percentage,   -- assumes max = 100
  rank() over (
    partition by l.class_id, s.subject_id, s.term, s.session
    order by s.total desc
  ) as position
from scores s
join learners l on l.id = s.learner_id;

-- ---------- Early-warning: rules, not "AI" ----------
-- Three signals weighted into a risk_score (max 7), then bucketed.
-- NOTE: "declining trend" is intentionally NOT in here yet — it needs
-- a term-over-term comparison. Add it once you have >1 term of data:
--   compare avg(total) of latest term vs previous term per learner.
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
  from submissions group by learner_id)
select
  l.id as learner_id, l.fullname, l.class_id,
  ss.avg_total,
  ats.attendance_pct,
  coalesce(asg.missing_count, 0) as missing_assignments,
  ( (case when ss.avg_total < 40 then 3 when ss.avg_total < 50 then 2 else 0 end)
  + (case when ats.attendance_pct < 60 then 2 when ats.attendance_pct < 75 then 1 else 0 end)
  + (case when coalesce(asg.missing_count,0) >= 3 then 2
          when coalesce(asg.missing_count,0) >= 1 then 1 else 0 end)
  ) as risk_score
from learners l
left join score_stats ss  on ss.learner_id  = l.id
left join att_stats  ats  on ats.learner_id = l.id
left join asg_stats  asg  on asg.learner_id = l.id;

create view learner_risk_level with (security_invoker = true) as
select *,
  case when risk_score >= 6 then 'Critical'
       when risk_score >= 4 then 'High'
       when risk_score >= 2 then 'Medium'
       else 'Low' end as risk_level
from learner_risk;

-- ============================================================
-- INDEXES
-- ============================================================
create index on classes(teacher_id);
create index on learners(class_id);
create index on scores(learner_id);
create index on scores(subject_id, term, session);
create index on attendance(learner_id, date);
create index on submissions(learner_id);
create index on submissions(assignment_id);
create index on assignments(class_id);
create index on weekly_tracker(class_id);
create index on evidence(weekly_tracker_id);
create index on interventions(learner_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Ownership chain: teacher -> classes -> learners -> {scores,
-- attendance, submissions, interventions}; classes -> {assignments,
-- weekly_tracker}; weekly_tracker -> evidence.
-- ============================================================
alter table profiles       enable row level security;
alter table subjects       enable row level security;
alter table classes        enable row level security;
alter table learners       enable row level security;
alter table scores         enable row level security;
alter table attendance     enable row level security;
alter table assignments    enable row level security;
alter table submissions    enable row level security;
alter table weekly_tracker enable row level security;
alter table evidence       enable row level security;
alter table interventions  enable row level security;

create policy "own profile" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "subjects read"  on subjects for select using (auth.uid() is not null);
create policy "subjects write" on subjects for insert with check (auth.uid() is not null);

create policy "own classes" on classes
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "own learners" on learners
  for all using (exists (select 1 from classes c
                         where c.id = learners.class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from classes c
                      where c.id = learners.class_id and c.teacher_id = auth.uid()));

create policy "own scores" on scores
  for all using (exists (select 1 from learners l join classes c on c.id = l.class_id
                         where l.id = scores.learner_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from learners l join classes c on c.id = l.class_id
                      where l.id = scores.learner_id and c.teacher_id = auth.uid()));

create policy "own attendance" on attendance
  for all using (exists (select 1 from learners l join classes c on c.id = l.class_id
                         where l.id = attendance.learner_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from learners l join classes c on c.id = l.class_id
                      where l.id = attendance.learner_id and c.teacher_id = auth.uid()));

create policy "own interventions" on interventions
  for all using (exists (select 1 from learners l join classes c on c.id = l.class_id
                         where l.id = interventions.learner_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from learners l join classes c on c.id = l.class_id
                      where l.id = interventions.learner_id and c.teacher_id = auth.uid()));

create policy "own assignments" on assignments
  for all using (exists (select 1 from classes c
                         where c.id = assignments.class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from classes c
                      where c.id = assignments.class_id and c.teacher_id = auth.uid()));

create policy "own submissions" on submissions
  for all using (exists (select 1 from assignments a join classes c on c.id = a.class_id
                         where a.id = submissions.assignment_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from assignments a join classes c on c.id = a.class_id
                      where a.id = submissions.assignment_id and c.teacher_id = auth.uid()));

create policy "own weekly" on weekly_tracker
  for all using (exists (select 1 from classes c
                         where c.id = weekly_tracker.class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from classes c
                      where c.id = weekly_tracker.class_id and c.teacher_id = auth.uid()));

create policy "own evidence" on evidence
  for all using (exists (select 1 from weekly_tracker w join classes c on c.id = w.class_id
                         where w.id = evidence.weekly_tracker_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from weekly_tracker w join classes c on c.id = w.class_id
                      where w.id = evidence.weekly_tracker_id and c.teacher_id = auth.uid()));

-- ============================================================
-- STORAGE (run after creating a PRIVATE bucket named 'evidence')
-- Lock files to the owning teacher via the path convention:
--   evidence/<auth.uid()>/<weekly_tracker_id>/<filename>
-- ------------------------------------------------------------
-- create policy "own files read" on storage.objects for select
--   using (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "own files write" on storage.objects for insert
--   with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);

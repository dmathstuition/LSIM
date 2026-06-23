-- migration_arms.sql
-- A teacher teaches a subject across several ARMS of one or more grade levels.
-- A "class" row now = one arm the teacher teaches (e.g. Year 7 / A).
-- Term/session live on the assessment (scores), never on the class.

alter table classes add column if not exists grade_level text;  -- 'Year 7', 'Year 12'
alter table classes add column if not exists arm         text;  -- 'A', 'B', 'Gold'

-- term described the class before; it belongs on scores, so drop it here.
alter table classes drop column if exists term;

-- one arm per teacher per year (rename of class_name still allowed as a label)
create unique index if not exists classes_teacher_grade_arm_year
  on classes (teacher_id, grade_level, arm, academic_year);

-- If you already ran v1 with data, backfill before enforcing NOT NULL:
--   update classes set grade_level = split_part(class_name,' ',1)||' '||split_part(class_name,' ',2),
--                      arm = right(class_name,1)  -- adjust to your naming
--   where grade_level is null;
-- alter table classes alter column grade_level set not null;
-- alter table classes alter column arm         set not null;

-- Read-only diagnostics for the reported Grade Tracker semester mismatch.
-- Run these in Supabase SQL Editor after migrations have been applied.

-- Grade rows whose subject is missing, belongs to another user, or has a
-- different semester. The same-user join deliberately exposes orphaned or
-- cross-owner grade references as unmatched subjects.
select g.id as grade_id,
       g.user_id as grade_user_id,
       g.subject_id,
       g.semester_id as grade_semester_id,
       s.user_id as subject_user_id,
       s.semester_id as subject_semester_id,
       (s.id is null) as subject_missing_or_not_owned,
       (s.id is not null and g.semester_id is distinct from s.semester_id) as semester_mismatch
from public.grades g
left join public.subjects s
  on s.id = g.subject_id
 and s.user_id = g.user_id
where s.id is null
   or g.semester_id is distinct from s.semester_id
order by g.user_id, g.subject_id;

-- Duplicate grade parents for a single owned subject should not exist.
select user_id, subject_id, count(*) as grade_count, array_agg(id order by id) as grade_ids
from public.grades
group by user_id, subject_id
having count(*) > 1
order by user_id, subject_id;

-- Components and assessments whose parent chain has inconsistent ownership.
select gc.id as component_id,
       gc.grade_id,
       g.user_id as grade_user_id,
       ga.id as assessment_id,
       ga.component_id as assessment_component_id
from public.grade_components gc
left join public.grades g on g.id = gc.grade_id
left join public.grade_assessments ga on ga.component_id = gc.id
where g.id is null or (ga.id is not null and ga.component_id is distinct from gc.id)
order by gc.grade_id, gc.id, ga.id;

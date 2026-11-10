-- 0023_deactivate_placeholder_semester.sql

update public.semesters
set is_active = false
where client_id is null
  and is_active = true;

-- Read-only preflight for Supabase SQL Editor. Run this before migration 0034.
-- It shows the actual FK definitions and the active trigger/function bodies.

select c.conrelid::regclass as table_name,
       c.conname,
       pg_get_constraintdef(c.oid, true) as definition,
       c.convalidated as validated
from pg_constraint c
where c.contype = 'f'
  and c.conrelid in (
      'public.subjects'::regclass,
      'public.tasks'::regclass,
      'public.calendar_events'::regclass,
      'public.attendance'::regclass,
      'public.grades'::regclass,
      'public.notes'::regclass,
      'public.gwa_calculator'::regclass
  )
  and c.confrelid = 'public.semesters'::regclass
order by table_name, c.conname;

select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as trigger_definition,
       p.proname as function_name,
       pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('subjects', 'tasks')
order by c.relname, t.tgname;

-- Replace the UUID below with the semester_id sent by the failing request.
-- The authenticated student id is the user_id from that request. SQL Editor
-- runs as its dashboard role, so auth.uid() may be NULL there.
select s.id, s.user_id, s.is_university_wide, s.status, s.start_date, s.end_date,
       (ss.active_semester_id = s.id) as is_global_active
from public.semesters s
left join public.system_settings ss on ss.id = true
where s.id = 'b06700ea-4d9f-41fe-973a-af6f88d28382'::uuid;

-- Compare this returned value with user_id from the failing request.
select auth.uid() as sql_editor_auth_uid;

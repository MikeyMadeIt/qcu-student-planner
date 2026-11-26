-- Fix the task ownership trigger installed by earlier security migrations.
-- `tasks` has no syllabus_week_id column in QCU Student Planner, so referencing
-- NEW.syllabus_week_id raises a runtime record-field error on every task write.
-- Keep the ownership and semester checks that apply to the actual task schema.

begin;

create or replace function public.tasks_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;

-- The old migration optionally attached a generic academic-period trigger to
-- a syllabus table that this application does not use. Remove that active
-- attachment without dropping or rewriting any historical database objects.
do $$
begin
    if to_regclass('public.syllabus_courses') is not null then
        execute 'drop trigger if exists trg_syllabus_courses_active_semester on public.syllabus_courses';
    end if;
end;
$$;

commit;

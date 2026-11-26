-- Protect semester/parent consistency for new academic records and when a
-- record's parent or semester is changed. Existing historical rows are not
-- rewritten, and unrelated edits to an old inconsistent row remain possible.

begin;

-- Keep legacy NULL associations readable/editable, but never let a newly
-- inserted row omit its semester or clear a semester already assigned.
create or replace function public.guard_active_semester_assignment()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
    v_active uuid;
    v_is_university_wide boolean;
    v_start_date date;
begin
    if new.semester_id is null then
        if tg_op = 'INSERT' or old.semester_id is not null then
            raise exception 'Academic records must keep a semester association' using errcode = '23514';
        end if;
        return new;
    end if;

    select active_semester_id into v_active
      from public.system_settings where id = true;
    select is_university_wide, start_date
      into v_is_university_wide, v_start_date
      from public.semesters where id = new.semester_id;

    if not found then
        raise exception 'Academic period not found' using errcode = '23503';
    end if;
    if v_is_university_wide
       and new.semester_id is distinct from v_active
       and v_start_date > (now() at time zone 'Asia/Manila')::date then
        raise exception 'Future academic periods cannot receive planner records' using errcode = '23514';
    end if;
    return new;
end;
$$;

create or replace function public.tasks_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_parent_semester uuid;
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    if new.subject_id is not null then
        select semester_id into v_parent_semester
          from public.subjects where id = new.subject_id and user_id = new.user_id;
        if v_parent_semester is distinct from new.semester_id then
            raise exception 'Task and subject must belong to the same semester' using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists trg_tasks_guard_fk on public.tasks;
create trigger trg_tasks_guard_fk
before insert or update of subject_id, semester_id on public.tasks
for each row execute function public.tasks_guard_fk();

create or replace function public.notes_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
    v_parent_semester uuid;
    v_parent_found boolean;
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('tasks', new.task_id, new.user_id, 'task_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');

    if new.subject_id is not null then
        select semester_id into v_parent_semester
          from public.subjects where id = new.subject_id and user_id = new.user_id;
        if v_parent_semester is distinct from new.semester_id then
            raise exception 'Note and subject must belong to the same semester' using errcode = '23514';
        end if;
    end if;
    if new.task_id is not null then
        select semester_id into v_parent_semester
          from public.tasks where id = new.task_id and user_id = new.user_id;
        if v_parent_semester is distinct from new.semester_id then
            raise exception 'Note and task must belong to the same semester' using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists trg_notes_guard_fk on public.notes;
create trigger trg_notes_guard_fk
before insert or update of subject_id, task_id, semester_id on public.notes
for each row execute function public.notes_guard_fk();

create or replace function public.attendance_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_parent_semester uuid;
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    if new.subject_id is not null then
        select semester_id into v_parent_semester
          from public.subjects where id = new.subject_id and user_id = new.user_id;
        if v_parent_semester is distinct from new.semester_id then
            raise exception 'Attendance and subject must belong to the same semester' using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists trg_attendance_guard_fk on public.attendance;
create trigger trg_attendance_guard_fk
before insert or update of subject_id, semester_id on public.attendance
for each row execute function public.attendance_guard_fk();

create or replace function public.grades_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_parent_semester uuid;
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    if new.subject_id is not null then
        select semester_id into v_parent_semester
          from public.subjects where id = new.subject_id and user_id = new.user_id;
        if v_parent_semester is distinct from new.semester_id then
            raise exception 'Grade and subject must belong to the same semester' using errcode = '23514';
        end if;
    end if;
    return new;
end;
$$;
drop trigger if exists trg_grades_guard_fk on public.grades;
create trigger trg_grades_guard_fk
before insert or update of subject_id, semester_id on public.grades
for each row execute function public.grades_guard_fk();

commit;

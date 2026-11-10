-- 0016_security_audit_data_isolation.sql

-- 1. Force RLS on. (ENABLE is a no-op if already on; included for
alter table public.profiles                  enable row level security;
alter table public.user_settings              enable row level security;
alter table public.semesters                   enable row level security;
alter table public.subjects                     enable row level security;
alter table public.tasks                          enable row level security;
alter table public.task_checklist_items             enable row level security;
alter table public.notes                               enable row level security;
alter table public.calendar_events                      enable row level security;
alter table public.pomodoro_stats                         enable row level security;
alter table public.attendance                               enable row level security;
alter table public.grades                                     enable row level security;
alter table public.grade_components                             enable row level security;
alter table public.grade_assessments                              enable row level security;
alter table public.gwa_calculator                                   enable row level security;
alter table public.syllabus_courses                                   enable row level security;
alter table public.syllabus_weeks                                       enable row level security;
alter table public.syllabus_topics                                        enable row level security;
alter table public.university_events                                        enable row level security;
alter table public.curriculum_courses                                         enable row level security;
alter table public.university_directory                                         enable row level security;
alter table public.student_services                                               enable row level security;
alter table public.university_resources                                             enable row level security;
alter table public.push_subscriptions                                                 enable row level security;
alter table public.admin_audit_log                                                      enable row level security;
alter table public.admin_messages                                                         enable row level security;
alter table public.admin_message_recipients                                                 enable row level security;
alter table public.support_tickets                                                            enable row level security;
alter table public.support_ticket_notes                                                         enable row level security;

-- 2. Foreign-key ownership guard.
create or replace function public.assert_owned_fk(ref_table text, ref_id uuid, owner uuid, label text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    found_owner uuid;
begin
    if ref_id is null then
        return;
    end if;
    execute format('select user_id from public.%I where id = $1', ref_table) into found_owner using ref_id;
    if found_owner is null or found_owner is distinct from owner then
        raise exception 'security: % (%) does not belong to this user', label, ref_id
            using errcode = '42501';
    end if;
end;
$$;

create or replace function public.tasks_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('syllabus_weeks', new.syllabus_week_id, new.user_id, 'syllabus_week_id');
    return new;
end;
$$;
drop trigger if exists trg_tasks_guard_fk on public.tasks;
create trigger trg_tasks_guard_fk before insert or update on public.tasks
    for each row execute function public.tasks_guard_fk();

create or replace function public.notes_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('tasks', new.task_id, new.user_id, 'task_id');
    return new;
end;
$$;
drop trigger if exists trg_notes_guard_fk on public.notes;
create trigger trg_notes_guard_fk before insert or update on public.notes
    for each row execute function public.notes_guard_fk();

create or replace function public.attendance_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_attendance_guard_fk on public.attendance;
create trigger trg_attendance_guard_fk before insert or update on public.attendance
    for each row execute function public.attendance_guard_fk();

create or replace function public.calendar_events_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_calendar_events_guard_fk on public.calendar_events;
create trigger trg_calendar_events_guard_fk before insert or update on public.calendar_events
    for each row execute function public.calendar_events_guard_fk();

create or replace function public.subjects_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_subjects_guard_fk on public.subjects;
create trigger trg_subjects_guard_fk before insert or update on public.subjects
    for each row execute function public.subjects_guard_fk();

create or replace function public.grades_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_grades_guard_fk on public.grades;
create trigger trg_grades_guard_fk before insert or update on public.grades
    for each row execute function public.grades_guard_fk();

create or replace function public.gwa_calculator_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_gwa_calculator_guard_fk on public.gwa_calculator;
create trigger trg_gwa_calculator_guard_fk before insert or update on public.gwa_calculator
    for each row execute function public.gwa_calculator_guard_fk();

create or replace function public.syllabus_courses_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;
drop trigger if exists trg_syllabus_courses_guard_fk on public.syllabus_courses;
create trigger trg_syllabus_courses_guard_fk before insert or update on public.syllabus_courses
    for each row execute function public.syllabus_courses_guard_fk();


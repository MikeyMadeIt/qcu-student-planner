-- ============================================================
-- 0016_security_audit_data_isolation.sql
--
-- Security audit of the student-data tables introduced/used by the
-- Subjects/Schedule/Calendar/Tasks and Grades-GWA/Attendance/Syllabus/
-- Notes migrations. Scope: data isolation only (RLS + ownership).
--
-- Findings & fixes in this migration:
--
-- 1. RLS-enabled guarantee. This project's tables were created outside
--    of the migrations in this repo (no CREATE TABLE here), so there is
--    no in-repo record proving RLS is actually ON for every table, only
--    that policies exist for most of them (a table can have policies
--    defined and RLS still be OFF, in which case the policies are never
--    evaluated and the table is fully open to any authenticated role).
--    This migration force-enables RLS on every private/student-owned
--    table and every admin-managed reference table, idempotently, as a
--    guarantee rather than an assumption.
--
-- 2. Foreign-key ownership spoofing. The existing *_own RLS policies
--    (e.g. `tasks_own`, `notes_own`, `attendance_own`, `grades_own`,
--    `syllabus_courses_own`) correctly require `user_id = auth.uid()`
--    on the row being written, but none of them verify that the
--    *related* row a foreign key points at (subject_id, task_id,
--    semester_id, component_id, ...) actually belongs to that same
--    user. A student's own `user_id` is honest by construction (RLS
--    forces it), but nothing stopped them from, say, inserting a task
--    with their own user_id and *another student's* subject_id as
--    subject_id (discoverable by guessing/enumerating UUIDs) -- not a
--    way to read someone else's data through this path, but a real
--    cross-tenant write ("my task secretly files under your subject")
--    and exactly the kind of bypass requirement #4/#5 call out. Fixed
--    with BEFORE INSERT OR UPDATE triggers (public.assert_owned_fk)
--    that re-check each foreign key against the row's own user_id.
--
-- 3. profiles privileged-column guard: already fixed in
--    0013_lock_profiles_privileged_columns.sql (re-verified during this
--    audit, no further action).
--
-- Idempotent: safe to run multiple times / after itself.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Force RLS on. (ENABLE is a no-op if already on; included for
--    every table that has *_own / admin_write / read policies today,
--    including ones predating this project's planner migrations.)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2. Foreign-key ownership guard.
--    assert_owned_fk(ref_table, ref_id, owner): raises if ref_id is
--    non-null and the row it points to in ref_table either doesn't
--    exist or belongs to a different user_id than `owner`. No-op for
--    null ref_id (optional/unset relations stay allowed).
-- ------------------------------------------------------------
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
            using errcode = '42501'; -- insufficient_privilege
    end if;
end;
$$;

create or replace function public.tasks_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    -- syllabus_week_id: the client (cloud-sync.js) always writes this as null today --
    -- syllabus weeks live inside syllabus_courses.data (jsonb), not as real
    -- syllabus_weeks rows (see migration 0015) -- but this guard stays in place
    -- in case that column is ever populated directly (API/devtools) or the
    -- feature is normalized onto real rows later.
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

-- grade_components / grade_assessments / task_checklist_items have no user_id
-- column of their own -- their *_own RLS policies already join up to the
-- owning grades/tasks row's user_id on every USING and WITH CHECK, which is
-- the correct and sufficient ownership check for them (re-verified, no gap
-- found; no additional trigger needed).

-- ============================================================
-- 0015_syllabus_jsonb_and_grade_touch.sql
--
-- Supports moving Grades & GWA, Attendance, Syllabus and Notes off
-- of localStorage and onto the existing Supabase tables.
--
-- Grades/GWA/Attendance/Notes already have every column the client
-- needs (see docs/security-audit for the table list), so this
-- migration only touches Syllabus:
--
-- The in-app Syllabus feature's local record is a single course with
-- nested weeks -> topics -> subtopics, plus free-form lists (learning
-- outcomes, activities, resources, assessments per week; course
-- outcomes, grading components, requirements, policies, references
-- per course). `syllabus_weeks` / `syllabus_topics` only have columns
-- for a fraction of that (week_no, learning_type, learning_outcomes,
-- completed / title, subtopics, position), so normalizing the whole
-- feature into those tables is a larger follow-up. For now the full
-- course record (including its weeks/topics) is stored as-is in a new
-- `data` jsonb column on `syllabus_courses`, with the columns that do
-- exist kept in sync alongside it so the record is still queryable by
-- course code/title/instructor without unpacking the JSON.
-- ============================================================

alter table public.syllabus_courses
    add column if not exists data jsonb not null default '{}'::jsonb;

-- Same updated_at touch trigger used for subjects/tasks/calendar_events
-- (see 0014_planner_cloud_migration_columns.sql), extended to the
-- tables this migration adds client writes for.
drop trigger if exists trg_notes_touch_updated_at on public.notes;
create trigger trg_notes_touch_updated_at
    before update on public.notes
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_attendance_touch_updated_at on public.attendance;
create trigger trg_attendance_touch_updated_at
    before update on public.attendance
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_grades_touch_updated_at on public.grades;
create trigger trg_grades_touch_updated_at
    before update on public.grades
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_grade_components_touch_updated_at on public.grade_components;
create trigger trg_grade_components_touch_updated_at
    before update on public.grade_components
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_grade_assessments_touch_updated_at on public.grade_assessments;
create trigger trg_grade_assessments_touch_updated_at
    before update on public.grade_assessments
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_gwa_calculator_touch_updated_at on public.gwa_calculator;
create trigger trg_gwa_calculator_touch_updated_at
    before update on public.gwa_calculator
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_syllabus_courses_touch_updated_at on public.syllabus_courses;
create trigger trg_syllabus_courses_touch_updated_at
    before update on public.syllabus_courses
    for each row execute function public.touch_updated_at();

-- Helpful indexes for the per-user queries cloud-sync.js issues.
create index if not exists idx_notes_user_id on public.notes (user_id);
create index if not exists idx_attendance_user_id on public.attendance (user_id);
create index if not exists idx_grades_user_id on public.grades (user_id);
create index if not exists idx_gwa_calculator_user_id on public.gwa_calculator (user_id);
create index if not exists idx_syllabus_courses_user_id on public.syllabus_courses (user_id);
create index if not exists idx_grade_components_grade_id on public.grade_components (grade_id);
create index if not exists idx_grade_assessments_component_id on public.grade_assessments (component_id);

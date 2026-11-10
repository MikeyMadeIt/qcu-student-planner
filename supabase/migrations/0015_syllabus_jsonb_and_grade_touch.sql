-- 0015_syllabus_jsonb_and_grade_touch.sql

alter table public.syllabus_courses
    add column if not exists data jsonb not null default '{}'::jsonb;

-- Same updated_at touch trigger used for subjects/tasks/calendar_events
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

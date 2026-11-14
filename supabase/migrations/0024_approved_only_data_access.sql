-- 0024_approved_only_data_access.sql
--
-- Closes a gap documented in SECURITY_VALIDATION.md item 5: every per-user
-- table's RLS policy filters on `user_id = auth.uid()`, but none of them
-- also check `profiles.account_status`. That means a still-valid (not yet
-- expired) session for an account that has since been rejected or
-- suspended keeps full read/write access to that user's own planner data
-- via the Supabase client directly — the app's own pages now guard against
-- this (see assets/js/core/app-guard.js), but the database itself did not.
--
-- This migration re-points every direct-owner and child planner table at a
-- single `for all` policy that requires BOTH ownership and
-- `public.is_approved()` (already defined in 0006_account_permanent_deletion.sql).
-- A pending account is also blocked by this — by design, since pending
-- accounts have no legitimate reason to read/write cloud planner data yet.
--
-- Existing policies are dropped programmatically (by querying pg_policies)
-- rather than by guessing their exact names, since several of these tables'
-- policies were never captured as a migration in this repo (created
-- directly via the Supabase dashboard) and this repo has no reliable record
-- of their current names.

do $$
declare
    tbl text;
    pol record;
begin
    foreach tbl in array array[
        'subjects', 'tasks', 'task_checklist_items', 'notes', 'calendar_events',
        'pomodoro_stats', 'attendance', 'grades', 'grade_components',
        'grade_assessments', 'gwa_calculator', 'syllabus_courses',
        'syllabus_weeks', 'syllabus_topics', 'semesters', 'user_settings',
        'push_subscriptions'
    ]
    loop
        for pol in
            select policyname from pg_policies
            where schemaname = 'public' and tablename = tbl
        loop
            execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
        end loop;
    end loop;
end;
$$;

-- Direct-owner tables: a plain `user_id = auth.uid()` + is_approved() check.
create policy "subjects_approved_own" on public.subjects
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "tasks_approved_own" on public.tasks
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "notes_approved_own" on public.notes
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "calendar_events_approved_own" on public.calendar_events
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "pomodoro_stats_approved_own" on public.pomodoro_stats
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "attendance_approved_own" on public.attendance
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "grades_approved_own" on public.grades
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "gwa_calculator_approved_own" on public.gwa_calculator
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "syllabus_courses_approved_own" on public.syllabus_courses
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "semesters_approved_own" on public.semesters
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "user_settings_approved_own" on public.user_settings
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

create policy "push_subscriptions_approved_own" on public.push_subscriptions
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

-- Child tables: ownership is inherited through the parent row, so the check
-- walks up to that parent's user_id instead of using a local column.
create policy "task_checklist_items_approved_own" on public.task_checklist_items
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and t.user_id = (select auth.uid()))
    )
    with check (
        (select public.is_approved())
        and exists (select 1 from public.tasks t where t.id = task_checklist_items.task_id and t.user_id = (select auth.uid()))
    );

create policy "grade_components_approved_own" on public.grade_components
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (select 1 from public.grades g where g.id = grade_components.grade_id and g.user_id = (select auth.uid()))
    )
    with check (
        (select public.is_approved())
        and exists (select 1 from public.grades g where g.id = grade_components.grade_id and g.user_id = (select auth.uid()))
    );

create policy "grade_assessments_approved_own" on public.grade_assessments
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (
            select 1 from public.grade_components gc
            join public.grades g on g.id = gc.grade_id
            where gc.id = grade_assessments.component_id and g.user_id = (select auth.uid())
        )
    )
    with check (
        (select public.is_approved())
        and exists (
            select 1 from public.grade_components gc
            join public.grades g on g.id = gc.grade_id
            where gc.id = grade_assessments.component_id and g.user_id = (select auth.uid())
        )
    );

create policy "syllabus_weeks_approved_own" on public.syllabus_weeks
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (select 1 from public.syllabus_courses c where c.id = syllabus_weeks.course_id and c.user_id = (select auth.uid()))
    )
    with check (
        (select public.is_approved())
        and exists (select 1 from public.syllabus_courses c where c.id = syllabus_weeks.course_id and c.user_id = (select auth.uid()))
    );

create policy "syllabus_topics_approved_own" on public.syllabus_topics
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (
            select 1 from public.syllabus_weeks w
            join public.syllabus_courses c on c.id = w.course_id
            where w.id = syllabus_topics.week_id and c.user_id = (select auth.uid())
        )
    )
    with check (
        (select public.is_approved())
        and exists (
            select 1 from public.syllabus_weeks w
            join public.syllabus_courses c on c.id = w.course_id
            where w.id = syllabus_topics.week_id and c.user_id = (select auth.uid())
        )
    );

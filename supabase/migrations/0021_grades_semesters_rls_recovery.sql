-- 0021_grades_semesters_rls_recovery.sql

-- semesters (own user_id column)
alter table public.semesters enable row level security;

drop policy if exists "semesters_own" on public.semesters;
create policy "semesters_own" on public.semesters
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- grades (own user_id column)
alter table public.grades enable row level security;

drop policy if exists "grades_own" on public.grades;
create policy "grades_own" on public.grades
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- grade_components (no user_id column owned via grades.grade_id)
alter table public.grade_components enable row level security;

drop policy if exists "grade_components_own" on public.grade_components;
create policy "grade_components_own" on public.grade_components
    for all
    using (exists (
        select 1 from public.grades g
        where g.id = grade_components.grade_id and g.user_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.grades g
        where g.id = grade_components.grade_id and g.user_id = auth.uid()
    ));

-- grade_assessments (no user_id column owned via grade_components -> grades)
alter table public.grade_assessments enable row level security;

drop policy if exists "grade_assessments_own" on public.grade_assessments;
create policy "grade_assessments_own" on public.grade_assessments
    for all
    using (exists (
        select 1 from public.grade_components c
        join public.grades g on g.id = c.grade_id
        where c.id = grade_assessments.component_id and g.user_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.grade_components c
        join public.grades g on g.id = c.grade_id
        where c.id = grade_assessments.component_id and g.user_id = auth.uid()
    ));

-- Grant table privileges to the authenticated role RLS policies only take
grant select, insert, update, delete on public.semesters to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant select, insert, update, delete on public.grade_components to authenticated;
grant select, insert, update, delete on public.grade_assessments to authenticated;

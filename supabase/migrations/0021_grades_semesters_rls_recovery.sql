-- ============================================================
-- 0021_grades_semesters_rls_recovery.sql
--
-- Root cause of "grades breakdown / semester disappears after logout-login":
--
-- 0016_security_audit_data_isolation.sql force-enabled Row Level Security on
-- public.grades, public.grade_components, public.grade_assessments and
-- public.semesters, but it did NOT create the owner-only policies for them --
-- its own comment says so explicitly:
--
--   "grade_components / grade_assessments / task_checklist_items have no
--    user_id column of their own -- their *_own RLS policies already join
--    up to the owning grades/tasks row's user_id ... (re-verified, no gap
--    found; no additional trigger needed)"
--
-- That assumes grades_own / grade_components_own / grade_assessments_own
-- policies already existed in the live project from before this migrations
-- folder started (same as semesters_own before 0020 added it explicitly).
-- There is no way to verify that from the repo alone (no live DB
-- connection), and in practice they did not exist on at least one project.
--
-- Net effect once RLS was forced on with no matching policy: every insert/
-- update to grades, grade_components or grade_assessments was silently
-- rejected by Postgres (RLS default-denies with no policy) -- this is
-- exactly the "Couldn't save that grade to the server" toast. The grade
-- still saved fine to localStorage (so the student saw it immediately),
-- but logging out wipes that local cache by design, and the next login
-- pulled from the server where nothing had ever actually landed --
-- looking exactly like the data had disappeared.
--
-- This migration (re-)creates the four owner-only policies explicitly, so
-- the table is never relying on a policy this repo can't confirm exists.
-- Idempotent (drop-if-exists + create): safe to run even if the policies
-- already existed correctly.
-- ============================================================

-- ---- semesters (own user_id column) ----
alter table public.semesters enable row level security;

drop policy if exists "semesters_own" on public.semesters;
create policy "semesters_own" on public.semesters
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- ---- grades (own user_id column) ----
alter table public.grades enable row level security;

drop policy if exists "grades_own" on public.grades;
create policy "grades_own" on public.grades
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

-- ---- grade_components (no user_id column -- owned via grades.grade_id) ----
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

-- ---- grade_assessments (no user_id column -- owned via grade_components -> grades) ----
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

-- Grant table privileges to the authenticated role -- RLS policies only take
-- effect once a GRANT already allows the operation; a missing GRANT fails
-- the same silent way a missing policy does. Mirrors 0017's approach for
-- the rest of the schema.
grant select, insert, update, delete on public.semesters to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant select, insert, update, delete on public.grade_components to authenticated;
grant select, insert, update, delete on public.grade_assessments to authenticated;

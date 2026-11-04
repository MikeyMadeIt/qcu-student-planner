-- ============================================================
-- 0014_planner_cloud_migration_columns.sql
--
-- Supports moving Subjects, Schedule, Calendar and Tasks off of
-- localStorage and onto these existing Supabase tables. The
-- tables, their columns, and their RLS policies already cover
-- almost everything the UI needs (see docs/security-audit for
-- the full table/policy list) -- this migration only adds the
-- handful of columns the client actually writes that did not
-- already exist, plus a couple of indexes for the query patterns
-- the new cloud-sync layer uses (one row per user per table).
--
-- Safe to run multiple times (IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- `subjects.online` -- whether a class meets online vs in a room.
-- Used by the Schedule feature's "online class" toggle, which
-- previously only existed in the localStorage record.
alter table public.subjects
    add column if not exists online boolean not null default false;

-- `tasks.time_estimate_min` -- optional estimated time-to-complete
-- (minutes) set on a task in the Tasks feature. Previously only
-- existed in the localStorage record.
alter table public.tasks
    add column if not exists time_estimate_min integer;

alter table public.tasks
    add constraint tasks_time_estimate_min_nonneg
    check (time_estimate_min is null or time_estimate_min >= 0)
    not valid;

alter table public.tasks
    validate constraint tasks_time_estimate_min_nonneg;

-- Helpful indexes for the per-user list queries cloud-sync.js issues
-- on every Subjects / Schedule / Calendar / Tasks page load.
create index if not exists idx_subjects_user_id on public.subjects (user_id);
create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_calendar_events_user_id on public.calendar_events (user_id);
create index if not exists idx_task_checklist_items_task_id on public.task_checklist_items (task_id);

-- `updated_at` auto-touch trigger for tasks, subjects and calendar_events,
-- so edits made directly through Supabase (not just through the app)
-- keep an accurate updated_at the same way other tables in this project do.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_subjects_touch_updated_at on public.subjects;
create trigger trg_subjects_touch_updated_at
    before update on public.subjects
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_tasks_touch_updated_at on public.tasks;
create trigger trg_tasks_touch_updated_at
    before update on public.tasks
    for each row execute function public.touch_updated_at();

drop trigger if exists trg_calendar_events_touch_updated_at on public.calendar_events;
create trigger trg_calendar_events_touch_updated_at
    before update on public.calendar_events
    for each row execute function public.touch_updated_at();

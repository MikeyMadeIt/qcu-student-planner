-- 0014_planner_cloud_migration_columns.sql

-- `subjects.online` whether a class meets online vs in a room.
alter table public.subjects
    add column if not exists online boolean not null default false;

-- `tasks.time_estimate_min` optional estimated time-to-complete
alter table public.tasks
    add column if not exists time_estimate_min integer;

alter table public.tasks
    add constraint tasks_time_estimate_min_nonneg
    check (time_estimate_min is null or time_estimate_min >= 0)
    not valid;

alter table public.tasks
    validate constraint tasks_time_estimate_min_nonneg;

-- Helpful indexes for the per-user list queries cloud-sync.js issues
create index if not exists idx_subjects_user_id on public.subjects (user_id);
create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_calendar_events_user_id on public.calendar_events (user_id);
create index if not exists idx_task_checklist_items_task_id on public.task_checklist_items (task_id);

-- `updated_at` auto-touch trigger for tasks, subjects and calendar_events,
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

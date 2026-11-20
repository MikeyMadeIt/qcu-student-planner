-- Preserve curriculum origin and setup progress on the existing subject row.
-- Nullable columns keep older databases and manually-created subjects compatible.
alter table public.subjects
    add column if not exists source text,
    add column if not exists setup_status text,
    add column if not exists curriculum_key text;

alter table public.subjects
    drop constraint if exists subjects_source_check,
    drop constraint if exists subjects_setup_status_check;

alter table public.subjects
    add constraint subjects_source_check
        check (source is null or source in ('manual', 'curriculum')) not valid,
    add constraint subjects_setup_status_check
        check (setup_status is null or setup_status in ('needs_setup', 'completed')) not valid;

create index if not exists idx_subjects_curriculum_setup
    on public.subjects (user_id, source, setup_status);

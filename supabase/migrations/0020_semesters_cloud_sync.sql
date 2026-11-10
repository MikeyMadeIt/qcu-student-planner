-- Makes the real, per-student semester list (Settings > Academic Semester

alter table public.semesters
    add column if not exists client_id text,
    add column if not exists start_date date,
    add column if not exists end_date date,
    add column if not exists finals_date date;

-- One row per (user, client_id): upserts from the frontend target this pair
create unique index if not exists semesters_user_client_uidx
    on public.semesters (user_id, client_id)
    where client_id is not null;

-- Idempotent owner-only RLS policies. A base policy set may already exist
alter table public.semesters enable row level security;

drop policy if exists "semesters_select_own" on public.semesters;
create policy "semesters_select_own" on public.semesters
    for select using (user_id = auth.uid());

drop policy if exists "semesters_insert_own" on public.semesters;
create policy "semesters_insert_own" on public.semesters
    for insert with check (user_id = auth.uid());

drop policy if exists "semesters_update_own" on public.semesters;
create policy "semesters_update_own" on public.semesters
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "semesters_delete_own" on public.semesters;
create policy "semesters_delete_own" on public.semesters
    for delete using (user_id = auth.uid());

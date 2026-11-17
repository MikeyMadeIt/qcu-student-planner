-- Settings page: persists DB.getSettings()/saveSettings() (theme, accent,
-- compact/reduce-motion, and notification preferences incl. reminder
-- timing) to the server, the same way semesters/tasks/etc. already are.
-- One JSONB blob per user rather than one column per setting: the shape
-- of "settings" is a frontend concern that changes often (e.g. adding a
-- new notification toggle), and a blob avoids a migration every time it
-- does, while still letting us query/index into it later if we need to.

create table if not exists public.user_preferences (
    user_id uuid primary key references auth.users (id) on delete cascade,
    prefs jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own" on public.user_preferences
    for select using (user_id = auth.uid());

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences
    for insert with check (user_id = auth.uid());

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences
    for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own" on public.user_preferences
    for delete using (user_id = auth.uid());

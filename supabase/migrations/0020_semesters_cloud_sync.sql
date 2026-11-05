-- Makes the real, per-student semester list (Settings > Academic Semester
-- Management) survive logout/login and device changes.
--
-- Background: `public.semesters` already existed in the live project (base
-- schema, predates this migrations folder -- see FINAL_AUDIT_REPORT.md §3)
-- and was, until now, used ONLY to create one throwaway "placeholder" row
-- per user (see getServerSemesterId() in cloud-sync.js) purely to satisfy
-- the NOT NULL semester_id FK on grades/syllabus_courses. The actual
-- semester objects the student creates in Settings -- school year, name,
-- start/end/finals dates, total weeks -- were never written to this table
-- at all; they lived only in this device's localStorage (`sp_semesters`),
-- which AuthService.signOut() deliberately wipes on logout for privacy.
-- Net effect: any semester a student added disappeared the next time they
-- signed back in (or on a different device). This migration adds what's
-- needed to sync the real list; assets/js/data/cloud-sync.js MAJ-11 is the
-- matching frontend change.
--
-- `client_id` holds the local deterministic id (e.g. "2026-2027-1", see
-- makeSemesterId() in storage.js) so a pushed/pulled row can be matched back
-- up without a separate id-mapping table. It is left NULL on the legacy
-- placeholder row (and only that row), so `where client_id is not null`
-- cleanly selects just the real, student-visible semesters.
--
-- Forward-only; does not touch any other column or table.

alter table public.semesters
    add column if not exists client_id text,
    add column if not exists start_date date,
    add column if not exists end_date date,
    add column if not exists finals_date date;

-- One row per (user, client_id): upserts from the frontend target this pair
-- via onConflict, and it stops a double-save (e.g. a retried push) from
-- creating duplicate rows for the same local semester. Partial index so it
-- never applies to the placeholder row (client_id is null there).
create unique index if not exists semesters_user_client_uidx
    on public.semesters (user_id, client_id)
    where client_id is not null;

-- Idempotent owner-only RLS policies. A base policy set may already exist
-- from before this migrations folder (unverifiable here -- no live DB
-- connection, see FINAL_AUDIT_REPORT.md §3) in which case these replace it
-- under the same names rather than risk a second, conflicting policy.
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

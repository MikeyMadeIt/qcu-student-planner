-- ============================================================
-- 0022_semesters_conflict_target_fix.sql
--
-- Root cause of "there is no unique or exclusion constraint matching the ON
-- CONFLICT specification" when saving a semester:
--
-- 0020_semesters_cloud_sync.sql created `semesters_user_client_uidx` as a
-- PARTIAL unique index: `unique (user_id, client_id) where client_id is not
-- null`. cloud-sync.js's doPushSemesters() upserts with
-- `{ onConflict: 'user_id,client_id' }`, which PostgREST translates to a
-- plain `ON CONFLICT (user_id, client_id)`. Postgres can only infer a
-- partial unique index from an ON CONFLICT clause that repeats its exact
-- WHERE condition -- which PostgREST's upsert has no way to express -- so
-- the conflict target never matched the partial index at all, and every
-- semester save failed outright with this error.
--
-- Fix: replace it with a full (non-partial) unique index on the same two
-- columns. This still behaves correctly for the one placeholder row that
-- has client_id = null (see getServerSemesterId() in cloud-sync.js) --
-- standard SQL treats every NULL as distinct from every other NULL, so a
-- non-partial unique index never blocks multiple null-client_id rows for
-- the same user; it only (correctly) rejects a real duplicate client_id.
--
-- Idempotent: safe to run multiple times.
-- ============================================================

drop index if exists public.semesters_user_client_uidx;

-- Defensive cleanup: the broken conflict target above meant every semester
-- "upsert" since 0020 actually attempted a fresh insert, so a student who
-- edited the same semester more than once (or whose push retried) may have
-- several rows sharing one (user_id, client_id) by now. Keep only the
-- oldest row per pair before the new index below would otherwise fail to
-- create against that duplicate data.
delete from public.semesters a
    using public.semesters b
    where a.client_id is not null
      and a.user_id = b.user_id
      and a.client_id = b.client_id
      and a.created_at > b.created_at;

create unique index if not exists semesters_user_client_uidx2
    on public.semesters (user_id, client_id);

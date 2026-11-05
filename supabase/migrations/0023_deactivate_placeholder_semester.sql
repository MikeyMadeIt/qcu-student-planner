-- ============================================================
-- 0023_deactivate_placeholder_semester.sql
--
-- Root cause of "duplicate key value violates unique constraint
-- semesters_one_active_per_user_idx" when adding/switching a semester:
--
-- getServerSemesterId() in cloud-sync.js created the one placeholder
-- semester row (used only to satisfy the grades/syllabus_courses NOT NULL
-- semester_id FK, client_id is null, never shown in the UI) with
-- is_active = true. That permanently occupied each student's "one active
-- semester" slot, so the very next attempt to upsert a REAL semester
-- (client_id not null) with is_active = true always collided with it.
-- Fixed on the client (placeholder now inserted with is_active = false,
-- and doPushSemesters() deactivates every other row before activating the
-- target one) -- this migration cleans up placeholder rows that were
-- already created active before that fix shipped.
--
-- Idempotent: only touches rows that are both a placeholder (client_id is
-- null) and currently (wrongly) active.
-- ============================================================

update public.semesters
set is_active = false
where client_id is null
  and is_active = true;

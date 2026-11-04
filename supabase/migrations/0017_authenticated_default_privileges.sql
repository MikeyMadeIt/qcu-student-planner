-- FOLLOW-UP: close the recurring "missing base GRANT for `authenticated`"
-- bug class at its root, instead of patching it table-by-table forever.
--
-- Audit finding: this exact bug has now been hit and manually patched THREE
-- separate times in this project's history:
--   - 0009_grant_messaging_tickets_privileges.sql (admin_messages,
--     admin_message_recipients, support_tickets, support_ticket_notes)
--   - 0012_grant_audit_log_privileges.sql (admin_audit_log)
--   - (service_role had the equivalent problem, fixed in
--     0007_grant_service_role_privileges.sql)
-- Each time, RLS and policies were written correctly in the same migration
-- that created the table, but the underlying table-level GRANT to
-- `authenticated` was never issued -- a plain Postgres privilege check that
-- runs *before* RLS is ever consulted, so the table was unreachable with a
-- 42501 error regardless of how correct its RLS policies were.
--
-- 0007 already fixed this permanently for `service_role` by adding an
-- `alter default privileges ... grant ... to service_role` clause so every
-- *future* table automatically gets the grant. It never did the same for
-- `authenticated` -- which is exactly why 0009 and 0012 both had to exist.
-- This migration closes that gap the same way, for the same role that kept
-- needing the manual follow-up.
--
-- This does NOT weaken or change RLS in any way, and does not grant any new
-- access on its own: `authenticated` already receives a base GRANT on every
-- table created by this project's own migrations (directly, as part of
-- creating each table) -- this only prevents a *future* migration from
-- repeating the 0009/0012 mistake by omission. As with 0009's note: granting
-- INSERT/UPDATE/DELETE at the table level is safe even for tables meant to
-- be read/written only through SECURITY DEFINER functions, because without
-- an explicit RLS policy for that operation, RLS denies it for every row
-- regardless of the table-level grant -- the grant only unblocks what RLS
-- policies already allow.
--
-- Safe to re-run. Run this once in the Supabase SQL editor (or via
-- `supabase db push`), after 0016.

alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
    grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema public
    grant execute on functions to authenticated;

-- Note: this only affects objects created AFTER this migration runs.
-- Existing tables created before today (including the core planner schema,
-- which predates this repository's migration history entirely -- see
-- DATABASE_MIGRATION_REPORT.md) are unaffected by `alter default privileges`
-- and were already confirmed reachable (the app works today), so no
-- retroactive grant is needed or issued here.

-- PHASE 3 FOLLOW-UP: restore service_role's table privileges.
--
-- Diagnosed from a live 42501 error returned by Postgres itself:
--   "permission denied for table profiles"
--   hint: "Grant the required privileges to the current role with:
--          GRANT SELECT ON public.profiles TO service_role;"
--
-- This is NOT a Row Level Security issue and NOT about the new Supabase API
-- key system's per-key "Bypass RLS" permission -- those only matter once a
-- role already has a base table-level GRANT. On this project, `service_role`
-- never had one at all (normally auto-configured by Supabase; something
-- about how this project's schema was set up skipped that). Nothing else in
-- this project was affected because `anon`/`authenticated` already had their
-- own correct grants -- only `service_role`, which nothing used until the
-- Phase 3 Edge Function, was missing them.
--
-- Safe to re-run. Run this once in the Supabase SQL editor (or via
-- `supabase db push`), then retry account approval/rejection/deletion.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- So any table/sequence/function created by future migrations also gets
-- these grants automatically, instead of silently repeating this problem.
alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
    grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
    grant execute on functions to service_role;

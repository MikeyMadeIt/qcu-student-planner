-- ============================================================
-- SUPERSEDED -- DO NOT EDIT OR RE-ENABLE THIS FILE
-- ============================================================
-- Original intent: create submit_profile_details() so a pending
-- (not-yet-approved) user could fill in their own profile.
--
-- Why this file is a no-op:
--   The original CREATE FUNCTION body referenced a `student_number`
--   column that was never added to public.profiles.  Postgres
--   validates column references inside a plpgsql body at CREATE
--   FUNCTION time, so the statement failed and the function was
--   never actually created.
--
-- Resolution:
--   • 0005_fix_submit_profile_details.sql  — corrected 5-arg version
--   • 0019_remove_profile_section.sql      — final 4-arg version
--     (drops the unused `section` parameter added in 0005)
--
-- This file is intentionally a no-op so that `supabase db push`
-- on a fresh project does not fail here and abort the rest of the
-- migration run.  The Supabase CLI records every file in
-- supabase_migrations.schema_migrations by name; renaming or
-- deleting this file would cause a checksum/state mismatch on
-- projects that already ran the original broken version.
-- ============================================================

do $$
begin
    raise notice
        'Migration 0001_submit_profile_details: no-op. '
        'submit_profile_details() is created by 0005 and finalised by 0019.';
end
$$;

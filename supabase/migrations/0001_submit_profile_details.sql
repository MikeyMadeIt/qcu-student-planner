-- Lets a pending (not yet reviewed) user fill in their own profile details
-- (full name, student number, course, year level, section, school) through a
-- narrow SECURITY DEFINER function, since the existing `profiles_update_own`
-- RLS policy requires is_approved() and a brand-new account is always pending.
-- Only touches the caller's own row, and only while still pending, so it
-- cannot be used to edit role/account_status or anyone else's profile.
--
-- STATUS: SUPERSEDED by 0005_fix_submit_profile_details.sql.
-- This version references a `student_number` column that was never added to
-- `public.profiles`. Postgres validates column names in a plpgsql body at
-- CREATE FUNCTION time, so this statement actually FAILED when run -- the
-- function was never created, which is why Google sign-up's "finish your
-- profile" step errors with "a required database function" is missing.
-- Do not run this file; run 0005 instead.

create or replace function public.submit_profile_details(
    p_full_name text,
    p_student_number text,
    p_course text,
    p_year_level text,
    p_section text,
    p_school text
) returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
    update public.profiles
    set full_name = nullif(trim(p_full_name), ''),
        student_number = nullif(trim(p_student_number), ''),
        course = nullif(trim(p_course), ''),
        year_level = nullif(trim(p_year_level), ''),
        section = nullif(trim(p_section), ''),
        school = nullif(trim(p_school), '')
    where id = (select auth.uid())
      and account_status = 'pending';
end;
$$;

grant execute on function public.submit_profile_details(text, text, text, text, text, text) to authenticated;

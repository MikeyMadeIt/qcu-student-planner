-- Removes the student "section" field (e.g. "BSIT 2A") from public.profiles.
--
-- Product decision: registration/finish-profile now only collect the three
-- academic fields Program (course), Year Level and Campus (school). Section
-- was never used by any other feature -- it was only ever written by
-- handle_new_user() / submit_profile_details() (both fed exclusively by the
-- registration and finish-profile forms, which no longer send it) and only
-- ever read by the admin account-detail view. No RLS policy, index, or other
-- function references this column, so dropping it is safe and self-contained.
-- (Verified: `section` on calendar/schedule subjects is an unrelated,
-- unrelated planner feature -- a class/section like "BSCS-1A" on a subject
-- row -- and is untouched by this migration.)
--
-- This migration is forward-only and does not touch any other column.
-- Existing student accounts, their account_status, role, and all other
-- profile data are preserved.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

-- 1. handle_new_user(): stop writing profiles.section at signup time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
    insert into public.profiles (
        id,
        email,
        full_name,
        course,
        year_level,
        school,
        role,
        account_status,
        signup_provider,
        created_at,
        updated_at
    )
    values (
        new.id,
        new.email,
        nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''),
        nullif(trim(new.raw_user_meta_data ->> 'course'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'year_level'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'school'), ''),
        'student',
        'pending',
        coalesce(new.raw_app_meta_data ->> 'provider', 'password'),
        now(),
        now()
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

-- 2. submit_profile_details(): drop the 5-arg version (0005) that takes
--    p_section and replace it with a 4-arg version that doesn't.
drop function if exists public.submit_profile_details(text, text, text, text, text);

create or replace function public.submit_profile_details(
    p_full_name text,
    p_course text,
    p_year_level text,
    p_school text
) returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
    update public.profiles
    set full_name = nullif(trim(p_full_name), ''),
        course = nullif(trim(p_course), ''),
        year_level = nullif(trim(p_year_level), ''),
        school = nullif(trim(p_school), '')
    where id = (select auth.uid())
      and account_status = 'pending';
end;
$$;

grant execute on function public.submit_profile_details(text, text, text, text) to authenticated;

-- 3. Drop the now-unused column. Safe: nothing else reads or writes it
--    (frontend queries and admin screens have been updated to stop
--    selecting/displaying it before this migration is applied).
alter table public.profiles
    drop column if exists section;

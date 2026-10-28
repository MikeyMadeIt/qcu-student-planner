-- Creates the pending `profiles` row at the moment a new Supabase Auth user is
-- created, reading full_name/course/year_level/section/school straight off the
-- signup metadata (auth.users.raw_user_meta_data) instead of a follow-up RPC call.
--
-- This matters because a follow-up RPC call only works if the browser already
-- has an authenticated session, and Supabase does NOT issue a session at signUp()
-- time when "Confirm email" is enabled -- it only issues one after the user
-- clicks the confirmation link and logs in. Reading from signup metadata avoids
-- that race entirely: the row (with all submitted details) is created atomically
-- with the auth user, regardless of the project's email-confirmation setting.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
    insert into public.profiles (
        id,
        full_name,
        course,
        year_level,
        section,
        school,
        role,
        account_status,
        created_at,
        updated_at
    )
    values (
        new.id,
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'course'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'year_level'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'section'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'school'), ''),
        'student',
        'pending',
        now(),
        now()
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Removes the student "section" field (e.g. "BSIT 2A") from public.profiles.

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
alter table public.profiles
    drop column if exists section;

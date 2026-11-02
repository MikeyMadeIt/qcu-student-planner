-- Supports Google OAuth sign-in and the manual "does this Gmail match our
-- lastname.firstname.middlename@gmail.com format" review step.
--
-- `profiles` never stored the user's email before -- it only lived on the
-- protected `auth.users` table, which the admin screens cannot (and should
-- not) query directly. Admins therefore had no way to see the email they're
-- supposed to check the format of. This migration denormalizes email onto
-- `profiles` (readable under the existing admin RLS policy) and keeps it in
-- sync automatically, for both password and Google sign-ups.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).

alter table public.profiles
    add column if not exists email text;

-- Backfill existing rows (password sign-ups that predate this column).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is distinct from u.email;

-- handle_new_user() now also stores the email at account-creation time.
-- Google OAuth sign-ins only ever populate full_name/avatar/email on
-- raw_user_meta_data (never course/year_level/section/school -- those are
-- only collected by our own registration form), so this function also marks
-- how the account signed up via `signup_provider`, which the "finish your
-- profile" step uses to know whether academic details still need collecting.
alter table public.profiles
    add column if not exists signup_provider text not null default 'password';

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
        section,
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
        nullif(trim(new.raw_user_meta_data ->> 'section'), ''),
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

-- Keep profiles.email in sync if the underlying auth email ever changes
-- (e.g. a user re-links a different Google account's email is not possible,
-- but Supabase lets a user change their email directly).
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
    if new.email is distinct from old.email then
        update public.profiles set email = new.email, updated_at = now() where id = new.id;
    end if;
    return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
    after update of email on auth.users
    for each row execute function public.handle_user_email_update();

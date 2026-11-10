-- Creates the pending `profiles` row at the moment a new Supabase Auth user is

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

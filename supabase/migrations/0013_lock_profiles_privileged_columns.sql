-- Closes a column-level gap in `profiles_update_own`.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
    if (new.role is distinct from old.role
        or new.account_status is distinct from old.account_status)
       and not public.is_admin() then
        new.role := old.role;
        new.account_status := old.account_status;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_profiles_guard_privileged_columns on public.profiles;

create trigger trg_profiles_guard_privileged_columns
    before update on public.profiles
    for each row
    execute function public.profiles_guard_privileged_columns();

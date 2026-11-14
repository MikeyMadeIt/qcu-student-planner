-- 0026_privileged_profile_columns_and_rls_safety_net.sql
--
-- Two fixes from the authorization/RLS audit:
--
-- 1. 0013_lock_profiles_privileged_columns.sql only reverts `role` and
--    `account_status` on a self-update. `reviewed_by`, `reviewed_at`, and
--    `rejection_reason` are reviewer-facing fields a student has no
--    legitimate reason to touch on their own row, and nothing currently
--    stops them from setting those directly via supabase.from('profiles')
--    .update(...). Widen the same trigger to cover them too.
--
-- 2. A safety net, not a fix for anything currently broken: every table
--    here already has RLS enabled, but 0017_authenticated_default_privileges
--    grants select/insert/update/delete on every FUTURE table to
--    `authenticated` by default. That means forgetting to enable RLS on a
--    table added later leaves it fully open with no policy required. This
--    re-asserts RLS on every table that exists today (a harmless no-op
--    where it's already on) and should be re-run (or scripted) after adding
--    any new table.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
    if (new.role is distinct from old.role
        or new.account_status is distinct from old.account_status
        or new.reviewed_by is distinct from old.reviewed_by
        or new.reviewed_at is distinct from old.reviewed_at
        or new.rejection_reason is distinct from old.rejection_reason)
       and not public.is_admin() then
        new.role := old.role;
        new.account_status := old.account_status;
        new.reviewed_by := old.reviewed_by;
        new.reviewed_at := old.reviewed_at;
        new.rejection_reason := old.rejection_reason;
    end if;
    return new;
end;
$$;
-- Trigger itself is unchanged (still trg_profiles_guard_privileged_columns,
-- still before update on profiles) — only the function body grew, so no
-- drop/recreate of the trigger is needed here.

-- Safety net: re-assert RLS is on for every table that exists today.
-- Re-run this block (or keep it handy) whenever a new table is added.
do $$
declare
    tbl record;
begin
    for tbl in
        select tablename from pg_tables
        where schemaname = 'public'
    loop
        execute format('alter table public.%I enable row level security', tbl.tablename);
    end loop;
end;
$$;

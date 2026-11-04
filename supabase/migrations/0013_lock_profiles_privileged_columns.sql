-- Closes a column-level gap in `profiles_update_own`.
--
-- PostgreSQL RLS policies evaluate a single boolean expression against the
-- whole NEW row; there is no built-in way to say "this column may change,
-- that one may not" inside USING/WITH CHECK alone. The live
-- `profiles_update_own` policy (USING/WITH CHECK: id = auth.uid() AND
-- is_approved()) lets an approved student run an ordinary
-- `supabase.from('profiles').update({ role: 'admin' })` (or
-- `account_status: 'approved'`) against their OWN row and have it pass RLS,
-- because nothing in that expression inspects which columns changed.
--
-- No frontend code in this project ever sends `role`/`account_status` in a
-- student-facing `.update()` call (verified: only admin-service.js writes
-- them, via SECURITY DEFINER RPCs), so the UI never exercises this path --
-- but RLS, not the absence of a UI button, is supposed to be the actual
-- security boundary here, and a hand-crafted request (curl/devtools) with the
-- anon key + a student's JWT currently is NOT blocked by anything in the
-- database itself.
--
-- Fix: a BEFORE UPDATE trigger on public.profiles that re-asserts
-- role/account_status unless the acting session is_admin(). This sits
-- alongside RLS (defense in depth) and does not touch the legitimate admin
-- path: admin UI/RPCs run as an is_admin() session, so the trigger is a
-- no-op for them. set_account_status() and submit_profile_details() are
-- SECURITY DEFINER but still run as the *invoking* role for RLS/trigger
-- purposes in Postgres (security definer only changes privilege checks on
-- objects, not auth.uid()/current RLS context), so both continue to work:
-- set_account_status() calls are_admin()-gated before touching the row, and
-- submit_profile_details() never touches role/account_status.
--
-- Idempotent: safe to run multiple times / on top of itself.

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

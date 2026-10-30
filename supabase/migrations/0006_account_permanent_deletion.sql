-- PHASE 3: Secure permanent deletion of rejected accounts.
--
-- This migration is additive and idempotent. It does not touch the existing
-- approval / rejection / suspension flow (set_account_status(), already live
-- since Phase 2) -- it only adds what's needed to safely delete a REJECTED
-- account's data and to let a trusted Edge Function finish the job by
-- removing the Supabase Auth user with the service_role key, which must
-- never be reachable from the browser.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- deploying the `admin-delete-account` Edge Function in supabase/functions/.

-- ---------------------------------------------------------------------------
-- 0. Defensive re-declaration of is_admin()/is_approved().
--    These already exist in the live project (referenced by every RLS policy
--    and by set_account_status() since Phase 2) but were applied directly
--    through the SQL editor and never committed to this repo. They are
--    redeclared here, CREATE OR REPLACE, with the exact semantics every
--    existing policy already depends on, purely so a fresh environment (or a
--    disaster-recovery restore) can rebuild the schema from the migrations
--    folder alone. If they already exist with this behaviour, this is a
--    no-op. Do NOT change this logic without auditing every policy above.
-- ---------------------------------------------------------------------------

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
    select exists (
        select 1 from public.profiles
        where id = (select auth.uid())
          and account_status = 'approved'
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
    select exists (
        select 1 from public.profiles
        where id = (select auth.uid())
          and role = 'admin'
          and account_status = 'approved'
    );
$$;

grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. admin_audit_log needs to be able to outlive the account it describes.
--    A deletion audit entry must stay readable forever (retention), even
--    after the target profile row is gone -- so we snapshot the identifying
--    details at write time and relax the FK so deleting the profile can
--    never be blocked by, or silently corrupt, its own audit trail.
-- ---------------------------------------------------------------------------

alter table public.admin_audit_log
    add column if not exists target_email text,
    add column if not exists target_full_name text;

alter table public.admin_audit_log
    drop constraint if exists admin_audit_log_target_user_id_fkey;

alter table public.admin_audit_log
    add constraint admin_audit_log_target_user_id_fkey
    foreign key (target_user_id) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. The actual cleanup + authorization function.
--
--    Responsibilities (everything the database itself can and must enforce):
--      - Caller must be an approved admin (is_admin()).
--      - An admin cannot delete themselves through this path.
--      - Target account must currently be 'rejected' -- never pending,
--        approved or suspended. This is re-checked here even though the
--        admin UI only ever shows this action on the Rejected Accounts page,
--        because the UI is not the security boundary.
--      - Deletes the account's planner data across every table that has a
--        direct or indirect user_id/FK chain back to this account, in
--        dependency order, inside a single transaction (function body),
--        so it either fully succeeds or fully rolls back -- never partial.
--      - Writes exactly one audit_log row recording the action, BEFORE the
--        profile row disappears, with a permanent snapshot of who it was.
--      - Deletes the profile row itself.
--      - Does NOT touch auth.users -- Postgres functions (even
--        SECURITY DEFINER ones) deleting directly from auth.users bypass
--        Supabase's own auth-internal bookkeeping (sessions, refresh
--        tokens, identities, MFA factors). The Edge Function is the only
--        thing that may remove the Auth user, via supabase-js's
--        auth.admin.deleteUser(), using the service_role key -- which lives
--        only in the Edge Function's server-side environment and is never
--        shipped to the browser.
--
--    This function is SAFE TO RE-RUN against the same target_user_id: if the
--    profile row is already gone (e.g. the Edge Function's Auth deletion
--    step failed after this function already ran once), it raises P0002,
--    which the Edge Function treats as "database side already clean" and
--    simply retries the Auth deletion step rather than erroring out.
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_rejected_account(
    target_user_id uuid,
    reason text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_status text;
    v_email text;
    v_full_name text;
    v_grade_ids uuid[];
    v_component_ids uuid[];
    v_course_ids uuid[];
    v_week_ids uuid[];
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can permanently delete an account'
            using errcode = '42501';
    end if;

    if target_user_id = (select auth.uid()) then
        raise exception 'Admins cannot delete their own account through this function'
            using errcode = '42501';
    end if;

    select account_status, email, full_name
      into v_status, v_email, v_full_name
      from public.profiles
     where id = target_user_id
     for update;

    if not found then
        raise exception 'Account not found (it may already have been deleted)'
            using errcode = 'P0002';
    end if;

    if v_status <> 'rejected' then
        raise exception 'Only rejected accounts can be permanently deleted (current status: %)', v_status
            using errcode = '42501';
    end if;

    -- Dependency order: children before parents. Every table below is scoped
    -- to this one user_id (or to rows owned, transitively, by this user_id),
    -- so no other student's records are ever touched.

    delete from public.task_checklist_items
     where task_id in (select id from public.tasks where user_id = target_user_id);

    delete from public.tasks where user_id = target_user_id;

    select array_agg(id) into v_grade_ids from public.grades where user_id = target_user_id;
    if v_grade_ids is not null then
        select array_agg(gc.id) into v_component_ids
          from public.grade_components gc
         where gc.grade_id = any(v_grade_ids);
        if v_component_ids is not null then
            delete from public.grade_assessments where component_id = any(v_component_ids);
        end if;
        delete from public.grade_components where grade_id = any(v_grade_ids);
    end if;
    delete from public.grades where user_id = target_user_id;

    select array_agg(id) into v_course_ids from public.syllabus_courses where user_id = target_user_id;
    if v_course_ids is not null then
        select array_agg(w.id) into v_week_ids
          from public.syllabus_weeks w
         where w.course_id = any(v_course_ids);
        if v_week_ids is not null then
            delete from public.syllabus_topics where week_id = any(v_week_ids);
        end if;
        delete from public.syllabus_weeks where course_id = any(v_course_ids);
    end if;
    delete from public.syllabus_courses where user_id = target_user_id;

    delete from public.notes where user_id = target_user_id;
    delete from public.calendar_events where user_id = target_user_id;
    delete from public.pomodoro_stats where user_id = target_user_id;
    delete from public.attendance where user_id = target_user_id;
    delete from public.gwa_calculator where user_id = target_user_id;
    delete from public.subjects where user_id = target_user_id;
    delete from public.user_settings where user_id = target_user_id;
    delete from public.push_subscriptions where user_id = target_user_id;
    delete from public.semesters where user_id = target_user_id;

    -- Audit entry is written while the profile row still exists so the FK
    -- captures target_user_id at least transiently; the ON DELETE SET NULL
    -- added above means it is safely nulled out the instant the profile row
    -- goes away below, while target_email/target_full_name stay intact
    -- forever as the permanent record of who this was.
    insert into public.admin_audit_log (
        actor_id, action, target_user_id, previous_status, new_status, reason, target_email, target_full_name
    ) values (
        (select auth.uid()), 'account_permanently_deleted', target_user_id, v_status, 'deleted', reason, v_email, v_full_name
    );

    delete from public.profiles where id = target_user_id;
end;
$$;

-- Deliberately NOT granted to anon -- only a signed-in authenticated user,
-- and the function itself still requires is_admin() on top of that.
grant execute on function public.admin_delete_rejected_account(uuid, text) to authenticated;

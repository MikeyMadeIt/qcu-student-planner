-- Replace the rejected-account cleanup RPC after the removed syllabus,
-- user_settings, and push_subscriptions tables left the application schema.
-- The old function still referenced those relations and failed at runtime.
-- Keep the existing authorization checks and scoped deletion behavior.
-- Run manually in the Supabase Dashboard SQL Editor after migrations 0031-0034.

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

    -- Delete children before their parent. Every statement remains scoped to
    -- the target profile; shared university semesters are never deleted here.
    delete from public.task_checklist_items
     where task_id in (select id from public.tasks where user_id = target_user_id);
    delete from public.tasks where user_id = target_user_id;

    select array_agg(id) into v_grade_ids
      from public.grades where user_id = target_user_id;
    if v_grade_ids is not null then
        select array_agg(id) into v_component_ids
          from public.grade_components where grade_id = any(v_grade_ids);
        if v_component_ids is not null then
            delete from public.grade_assessments where component_id = any(v_component_ids);
        end if;
        delete from public.grade_components where grade_id = any(v_grade_ids);
    end if;
    delete from public.grades where user_id = target_user_id;

    delete from public.notes where user_id = target_user_id;
    delete from public.calendar_events where user_id = target_user_id;
    delete from public.pomodoro_stats where user_id = target_user_id;
    delete from public.attendance where user_id = target_user_id;
    delete from public.gwa_calculator where user_id = target_user_id;
    delete from public.subjects where user_id = target_user_id;
    delete from public.semesters where user_id = target_user_id;

    insert into public.admin_audit_log (
        actor_id, action, target_user_id, previous_status, new_status,
        reason, target_email, target_full_name
    ) values (
        (select auth.uid()), 'account_permanently_deleted', target_user_id,
        v_status, 'deleted', reason, v_email, v_full_name
    );

    delete from public.profiles where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_rejected_account(uuid, text) from public, anon;
grant execute on function public.admin_delete_rejected_account(uuid, text) to authenticated;

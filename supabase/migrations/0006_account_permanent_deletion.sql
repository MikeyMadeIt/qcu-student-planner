-- PHASE 3: Secure permanent deletion of rejected accounts.

-- 0. Defensive re-declaration of is_admin()/is_approved().

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

-- 1. admin_audit_log needs to be able to outlive the account it describes.

alter table public.admin_audit_log
    add column if not exists target_email text,
    add column if not exists target_full_name text;

alter table public.admin_audit_log
    drop constraint if exists admin_audit_log_target_user_id_fkey;

alter table public.admin_audit_log
    add constraint admin_audit_log_target_user_id_fkey
    foreign key (target_user_id) references public.profiles(id) on delete set null;

-- 2. The actual cleanup + authorization function.

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
    insert into public.admin_audit_log (
        actor_id, action, target_user_id, previous_status, new_status, reason, target_email, target_full_name
    ) values (
        (select auth.uid()), 'account_permanently_deleted', target_user_id, v_status, 'deleted', reason, v_email, v_full_name
    );

    delete from public.profiles where id = target_user_id;
end;
$$;

-- Deliberately NOT granted to anon only a signed-in authenticated user,
grant execute on function public.admin_delete_rejected_account(uuid, text) to authenticated;

-- Use the academic date zone when activation marks a prior period completed.
-- The earlier RPC used PostgreSQL CURRENT_DATE (session/database timezone),
-- which can differ from Asia/Manila around UTC midnight.

create or replace function public.admin_activate_academic_semester(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
    v_sem public.semesters%rowtype;
    v_previous uuid;
    v_today date := (now() at time zone 'Asia/Manila')::date;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can activate a semester' using errcode = '42501';
    end if;

    select active_semester_id into v_previous
      from public.system_settings where id = true for update;
    select * into v_sem
      from public.semesters where id = p_id and is_university_wide for update;
    if not found then
        raise exception 'University semester not found' using errcode = 'P0002';
    end if;
    if v_sem.status in ('archived', 'completed') then
        raise exception 'Archived or completed semesters cannot be activated' using errcode = '22023';
    end if;

    update public.semesters
       set status = case when end_date < v_today then 'completed' else 'planned' end,
           is_active = false,
           updated_at = now()
     where is_university_wide and status = 'active' and id <> p_id;

    update public.semesters
       set status = 'active', is_active = true, updated_at = now()
     where id = p_id;

    update public.academic_years
       set status = case
               when id = v_sem.academic_year_id then 'active'
               when status = 'active' and end_date < v_today then 'completed'
               when status = 'active' then 'planned'
               else status
           end,
           updated_at = now()
     where status <> 'archived'
       and (id = v_sem.academic_year_id or status = 'active');

    update public.system_settings
       set active_semester_id = p_id,
           updated_at = now(),
           updated_by = (select auth.uid())
     where id = true;

    insert into public.admin_audit_log(actor_id, action, reason)
    values (
        (select auth.uid()),
        'university_active_semester_changed',
        format('from %s to %s %s', coalesce(v_previous::text, 'none'), v_sem.school_year, v_sem.name)
    );
end;
$$;

revoke all on function public.admin_activate_academic_semester(uuid) from public, anon;
grant execute on function public.admin_activate_academic_semester(uuid) to authenticated;

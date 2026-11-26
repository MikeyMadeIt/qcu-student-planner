-- Centralized academic calendar for QCU Student Planner.
--
-- Existing public.semesters rows are per-user historical periods and are
-- preserved. The same table is extended with university-wide rows
-- (user_id IS NULL, is_university_wide = true), avoiding a second semester
-- registry. No legacy row is promoted or reassigned automatically.
-- Planner rows with an unambiguous subject/task relationship are backfilled;
-- rows without sufficient evidence remain NULL for safe manual review.

begin;

create table if not exists public.academic_years (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    start_date date not null,
    end_date date not null,
    status text not null default 'planned',
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint academic_years_name_length check (char_length(trim(name)) between 4 and 30),
    constraint academic_years_date_order check (end_date >= start_date),
    constraint academic_years_status_check check (status in ('planned', 'active', 'completed', 'archived'))
);
create unique index if not exists academic_years_name_ci_uidx
    on public.academic_years (lower(name));
create index if not exists academic_years_status_start_idx
    on public.academic_years (status, start_date desc);

alter table public.semesters
    alter column user_id drop not null,
    add column if not exists is_university_wide boolean not null default false,
    add column if not exists academic_year_id uuid,
    add column if not exists status text not null default 'archived';

alter table public.semesters
    add constraint semesters_academic_year_id_fkey
        foreign key (academic_year_id) references public.academic_years(id) on delete restrict,
    add constraint semesters_status_check
        check (status in ('planned', 'active', 'completed', 'archived')),
    add constraint semesters_university_year_required
        check (not is_university_wide or academic_year_id is not null),
    add constraint semesters_period_scope_check
        check ((is_university_wide and user_id is null) or (not is_university_wide and user_id is not null));

create unique index if not exists semesters_university_year_name_uidx
    on public.semesters (academic_year_id, name)
    where is_university_wide;
create unique index if not exists semesters_one_university_active_uidx
    on public.semesters (is_university_wide)
    where is_university_wide and status = 'active';
create unique index if not exists semesters_one_university_is_active_uidx
    on public.semesters (is_university_wide)
    where is_university_wide and is_active;
create index if not exists semesters_academic_year_idx
    on public.semesters (academic_year_id, status, start_date)
    where is_university_wide;

create table if not exists public.system_settings (
    id boolean primary key default true check (id),
    active_semester_id uuid references public.semesters(id) on delete restrict,
    updated_at timestamptz not null default now(),
    updated_by uuid references public.profiles(id) on delete set null
);

insert into public.system_settings (id, active_semester_id)
values (true, null)
on conflict (id) do nothing;

-- Add durable semester links to all semester-dependent planner tables.
alter table public.subjects add column if not exists semester_id uuid;
alter table public.tasks add column if not exists semester_id uuid;
alter table public.notes add column if not exists semester_id uuid;
alter table public.calendar_events add column if not exists semester_id uuid;
alter table public.attendance add column if not exists semester_id uuid;
alter table public.grades add column if not exists semester_id uuid;
alter table public.gwa_calculator add column if not exists semester_id uuid;

create index if not exists subjects_user_semester_idx on public.subjects (user_id, semester_id);
create index if not exists tasks_user_semester_idx on public.tasks (user_id, semester_id);
create index if not exists notes_user_semester_idx on public.notes (user_id, semester_id);
create index if not exists calendar_events_user_semester_idx on public.calendar_events (user_id, semester_id);
create index if not exists attendance_user_semester_idx on public.attendance (user_id, semester_id);
create index if not exists grades_user_semester_idx on public.grades (user_id, semester_id);
create index if not exists gwa_calculator_user_semester_idx on public.gwa_calculator (user_id, semester_id);

do $$
declare
    v_item record;
    v_has_fk boolean;
begin
    for v_item in
        select * from (values
            ('subjects', 'subjects_semester_id_academic_fkey'),
            ('tasks', 'tasks_semester_id_academic_fkey'),
            ('notes', 'notes_semester_id_academic_fkey'),
            ('calendar_events', 'calendar_events_semester_id_academic_fkey'),
            ('attendance', 'attendance_semester_id_academic_fkey'),
            ('grades', 'grades_semester_id_academic_fkey'),
            ('gwa_calculator', 'gwa_calculator_semester_id_academic_fkey')
        ) as x(table_name, constraint_name)
    loop
        select exists (
            select 1 from pg_constraint c
            where c.conrelid = format('public.%I', v_item.table_name)::regclass
              and c.confrelid = 'public.semesters'::regclass
              and c.contype = 'f'
              and exists (
                  select 1 from unnest(c.conkey) k(attnum)
                  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
                  where a.attname = 'semester_id'
              )
        ) into v_has_fk;
        if not v_has_fk then
            execute format(
                'alter table public.%I add constraint %I foreign key (semester_id) references public.semesters(id) on delete restrict not valid',
                v_item.table_name, v_item.constraint_name
            );
        end if;
    end loop;
end;
$$;

-- Safe relationship backfills only. These do not infer a period from the
-- current date or from whichever semester happens to be active today.
update public.tasks t
set semester_id = s.semester_id
from public.subjects s
where t.semester_id is null and t.subject_id = s.id and t.user_id = s.user_id
  and s.semester_id is not null
  and exists (select 1 from public.semesters p where p.id = s.semester_id and (p.user_id = t.user_id or p.is_university_wide));

update public.grades g
set semester_id = s.semester_id
from public.subjects s
where (g.semester_id is null or exists (
        select 1 from public.semesters old_period
        where old_period.id = g.semester_id and old_period.user_id = g.user_id
          and old_period.client_id is null and old_period.name = 'My Planner Data'
      ))
  and g.subject_id = s.id and g.user_id = s.user_id
  and s.semester_id is not null
  and exists (select 1 from public.semesters p where p.id = s.semester_id and (p.user_id = g.user_id or p.is_university_wide));

update public.attendance a
set semester_id = s.semester_id
from public.subjects s
where a.semester_id is null and a.subject_id = s.id and a.user_id = s.user_id
  and s.semester_id is not null
  and exists (select 1 from public.semesters p where p.id = s.semester_id and (p.user_id = a.user_id or p.is_university_wide));

-- Notes may have either or both references. Update only when all present
-- parent references agree on exactly one non-null semester.
update public.notes n
set semester_id = links.semester_id
from (
    select n2.id,
           min(parent.semester_id::text)::uuid as semester_id,
           count(*) as parent_count,
           count(parent.semester_id) as known_count,
           count(distinct parent.semester_id) as semester_count
    from public.notes n2
    cross join lateral (
        select s.semester_id
        from public.subjects s
        where s.id = n2.subject_id and s.user_id = n2.user_id
          and exists (select 1 from public.semesters p where p.id = s.semester_id and (p.user_id = n2.user_id or p.is_university_wide))
        union all
        select t.semester_id
        from public.tasks t
        where t.id = n2.task_id and t.user_id = n2.user_id
          and exists (select 1 from public.semesters p where p.id = t.semester_id and (p.user_id = n2.user_id or p.is_university_wide))
    ) parent
    group by n2.id
) links
where n.semester_id is null and n.id = links.id
  and links.parent_count = links.known_count and links.semester_count = 1;

-- A semester association is always a user's own historic row or a shared
-- university row. Only the database activation RPC can change the latter.
do $$
declare
    v_policy record;
begin
    for v_policy in select policyname from pg_policies where schemaname = 'public' and tablename = 'semesters'
    loop
        execute format('drop policy if exists %I on public.semesters', v_policy.policyname);
    end loop;
end;
$$;
alter table public.semesters enable row level security;
create policy semesters_read_scoped on public.semesters
    for select to authenticated
    using (
        (user_id = (select auth.uid()) and (select public.is_approved()))
        or (is_university_wide and (select public.is_approved()))
        or (select public.is_admin())
    );

alter table public.academic_years enable row level security;
create policy academic_years_read_approved on public.academic_years
    for select to authenticated using ((select public.is_approved()));

alter table public.system_settings enable row level security;
create policy system_settings_read_approved on public.system_settings
    for select to authenticated using ((select public.is_approved()));

revoke all on public.semesters, public.academic_years, public.system_settings from public, anon, authenticated;
grant select on public.semesters, public.academic_years, public.system_settings to authenticated;

-- Extend the existing ownership guard to recognize shared academic periods.
create or replace function public.assert_owned_fk(ref_table text, ref_id uuid, owner uuid, label text)
returns void language plpgsql security definer set search_path to '' as $$
declare
    found_owner uuid;
    found_university_wide boolean := false;
begin
    if ref_id is null then return; end if;
    if ref_table = 'semesters' then
        select s.user_id, s.is_university_wide into found_owner, found_university_wide
        from public.semesters s where s.id = ref_id;
        if found_university_wide and (select public.is_approved()) then return; end if;
    else
        execute format('select user_id from public.%I where id = $1', ref_table) into found_owner using ref_id;
    end if;
    if found_owner is null or found_owner is distinct from owner then
        raise exception 'security: % (%) does not belong to this user', label, ref_id using errcode = '42501';
    end if;
end;
$$;

create or replace function public.tasks_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;

create or replace function public.notes_guard_fk()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    perform public.assert_owned_fk('subjects', new.subject_id, new.user_id, 'subject_id');
    perform public.assert_owned_fk('tasks', new.task_id, new.user_id, 'task_id');
    perform public.assert_owned_fk('semesters', new.semester_id, new.user_id, 'semester_id');
    return new;
end;
$$;

create or replace function public.guard_active_semester_assignment()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
    v_active uuid;
    v_is_university_wide boolean;
begin
    select active_semester_id into v_active from public.system_settings where id = true;
    if new.semester_id is null then return new; end if;
    select is_university_wide into v_is_university_wide from public.semesters where id = new.semester_id;
    if v_is_university_wide and new.semester_id is distinct from v_active
       and (tg_op = 'INSERT' or new.semester_id is distinct from old.semester_id) then
        raise exception 'New academic records must use the current university semester' using errcode = '23514';
    end if;
    return new;
end;
$$;

do $$
declare v_table text;
begin
    foreach v_table in array array['subjects','tasks','notes','calendar_events','attendance','grades','gwa_calculator']
    loop
        execute format('drop trigger if exists trg_%I_active_semester on public.%I', v_table, v_table);
        execute format('create trigger trg_%I_active_semester before insert or update of semester_id on public.%I for each row execute function public.guard_active_semester_assignment()', v_table, v_table);
    end loop;
end;
$$;

create or replace function public.admin_upsert_academic_year(
    p_id uuid, p_name text, p_start_date date, p_end_date date
) returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_name text := trim(coalesce(p_name, ''));
begin
    if not public.is_admin() then raise exception 'Only an approved admin can manage academic years' using errcode = '42501'; end if;
    if char_length(v_name) < 4 or char_length(v_name) > 30 or p_start_date is null or p_end_date is null or p_end_date < p_start_date then
        raise exception 'Academic year name and date range are required and must be valid' using errcode = '22023';
    end if;
    if exists (select 1 from public.academic_years y where y.id <> coalesce(p_id, gen_random_uuid()) and lower(y.name) = lower(v_name)) then
        raise exception 'An academic year with that name already exists' using errcode = '23505';
    end if;
    if p_id is null then
        insert into public.academic_years(name, start_date, end_date, created_by)
        values (v_name, p_start_date, p_end_date, (select auth.uid())) returning id into v_id;
    else
        perform 1 from public.system_settings where id = true for update;
        if not exists (select 1 from public.academic_years where id = p_id) then raise exception 'Academic year not found' using errcode = 'P0002'; end if;
        if exists (select 1 from public.semesters s where s.academic_year_id = p_id and (s.start_date < p_start_date or s.end_date > p_end_date)) then
            raise exception 'Academic year dates must contain all semesters under it' using errcode = '22023';
        end if;
        update public.academic_years set name = v_name, start_date = p_start_date, end_date = p_end_date, updated_at = now()
        where id = p_id returning id into v_id;
        update public.semesters set school_year = v_name where academic_year_id = v_id and is_university_wide;
    end if;
    insert into public.admin_audit_log(actor_id, action, reason)
    values ((select auth.uid()), case when p_id is null then 'academic_year_created' else 'academic_year_updated' end, v_name);
    return v_id;
end;
$$;

create or replace function public.admin_upsert_academic_semester(
    p_id uuid, p_academic_year_id uuid, p_name text, p_start_date date, p_end_date date
) returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid; v_year public.academic_years%rowtype; v_name text := trim(coalesce(p_name, ''));
begin
    if not public.is_admin() then raise exception 'Only an approved admin can manage semesters' using errcode = '42501'; end if;
    if v_name not in ('1st Semester', '2nd Semester', 'Summer') or p_start_date is null or p_end_date is null or p_end_date < p_start_date then
        raise exception 'Semester name and date range are required and must be valid' using errcode = '22023';
    end if;
    perform 1 from public.system_settings where id = true for update;
    select * into v_year from public.academic_years where id = p_academic_year_id for share;
    if not found or v_year.status = 'archived' then raise exception 'Choose an available academic year' using errcode = '22023'; end if;
    if p_start_date < v_year.start_date or p_end_date > v_year.end_date then
        raise exception 'Semester dates must fall within the academic year' using errcode = '22023';
    end if;
    if p_id is null then
        insert into public.semesters(user_id, client_id, name, school_year, start_date, end_date, total_weeks, is_active, is_university_wide, academic_year_id, status)
        values (null, null, v_name, v_year.name, p_start_date, p_end_date, 15, false, true, p_academic_year_id, 'planned')
        returning id into v_id;
    else
        if not exists (select 1 from public.semesters where id = p_id and is_university_wide) then raise exception 'University semester not found' using errcode = 'P0002'; end if;
        update public.semesters set academic_year_id = p_academic_year_id, name = v_name, school_year = v_year.name,
            start_date = p_start_date, end_date = p_end_date, updated_at = now()
        where id = p_id returning id into v_id;
    end if;
    insert into public.admin_audit_log(actor_id, action, reason)
    values ((select auth.uid()), case when p_id is null then 'academic_semester_created' else 'academic_semester_updated' end, format('%s %s', v_year.name, v_name));
    return v_id;
end;
$$;

create or replace function public.admin_activate_academic_semester(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_sem public.semesters%rowtype; v_previous uuid;
begin
    if not public.is_admin() then raise exception 'Only an approved admin can activate a semester' using errcode = '42501'; end if;
    select active_semester_id into v_previous from public.system_settings where id = true for update;
    select * into v_sem from public.semesters where id = p_id and is_university_wide for update;
    if not found then raise exception 'University semester not found' using errcode = 'P0002'; end if;
    if v_sem.status in ('archived', 'completed') then raise exception 'Archived or completed semesters cannot be activated' using errcode = '22023'; end if;
    update public.semesters set status = case when end_date < current_date then 'completed' else 'planned' end,
        is_active = false, updated_at = now()
    where is_university_wide and status = 'active' and id <> p_id;
    update public.semesters set status = 'active', is_active = true, updated_at = now() where id = p_id;
    update public.academic_years set status = case when id = v_sem.academic_year_id then 'active' when status = 'active' and end_date < current_date then 'completed' when status = 'active' then 'planned' else status end, updated_at = now()
    where status <> 'archived' and (id = v_sem.academic_year_id or status = 'active');
    update public.system_settings set active_semester_id = p_id, updated_at = now(), updated_by = (select auth.uid()) where id = true;
    insert into public.admin_audit_log(actor_id, action, reason)
    values ((select auth.uid()), 'university_active_semester_changed', format('from %s to %s %s', coalesce(v_previous::text, 'none'), v_sem.school_year, v_sem.name));
end;
$$;

create or replace function public.admin_archive_academic_semester(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_sem public.semesters%rowtype;
begin
    if not public.is_admin() then raise exception 'Only an approved admin can archive a semester' using errcode = '42501'; end if;
    perform 1 from public.system_settings where id = true for update;
    select * into v_sem from public.semesters where id = p_id and is_university_wide for update;
    if not found then raise exception 'University semester not found' using errcode = 'P0002'; end if;
    if exists (select 1 from public.system_settings where id = true and active_semester_id = p_id) then
        raise exception 'Switch the university active semester before archiving this one' using errcode = '22023';
    end if;
    update public.semesters set status = 'archived', is_active = false, updated_at = now() where id = p_id;
    insert into public.admin_audit_log(actor_id, action, reason)
    values ((select auth.uid()), 'academic_semester_archived', format('%s %s', v_sem.school_year, v_sem.name));
end;
$$;

revoke all on function public.admin_upsert_academic_year(uuid, text, date, date) from public, anon;
revoke all on function public.admin_upsert_academic_semester(uuid, uuid, text, date, date) from public, anon;
revoke all on function public.admin_activate_academic_semester(uuid) from public, anon;
revoke all on function public.admin_archive_academic_semester(uuid) from public, anon;
grant execute on function public.admin_upsert_academic_year(uuid, text, date, date) to authenticated;
grant execute on function public.admin_upsert_academic_semester(uuid, uuid, text, date, date) to authenticated;
grant execute on function public.admin_activate_academic_semester(uuid) to authenticated;
grant execute on function public.admin_archive_academic_semester(uuid) to authenticated;

commit;

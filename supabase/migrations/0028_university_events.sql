-- PHASE 8: Centralized University Events.
--
-- Until now "university events" were a per-browser localStorage list
-- (sp_university_events) that any student could add to from the Calendar
-- page. That meant every student kept their own private copy, nothing
-- was shared, and nothing stopped a student from creating/editing/
-- deleting them. This migration introduces a single, centrally-managed
-- table: only an approved admin may create/update/delete rows, and every
-- approved account (student or admin) can read the ones that are
-- published. Enforcement lives in RLS + security-definer functions, not
-- just the frontend.

create table if not exists public.university_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    event_date date not null,
    start_time time,
    end_time time,
    location text,
    is_published boolean not null default true,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint university_events_title_len check (char_length(trim(title)) between 1 and 150),
    constraint university_events_description_len check (char_length(coalesce(description, '')) <= 4000),
    constraint university_events_location_len check (char_length(coalesce(location, '')) <= 150),
    constraint university_events_time_order check (
        start_time is null or end_time is null or end_time >= start_time
    )
);

create index if not exists university_events_date_idx on public.university_events (event_date);
create index if not exists university_events_published_idx on public.university_events (is_published, event_date);

alter table public.university_events enable row level security;

-- Every approved account can read published events; an admin can also see
-- unpublished (draft) ones so they can finish and publish them later.
drop policy if exists university_events_select on public.university_events;
create policy university_events_select on public.university_events
    for select to authenticated using (
        (is_published and (select public.is_approved()))
        or (select public.is_admin())
    );

-- Intentionally no insert/update/delete policy for any client role — all
-- writes go through the security-definer functions below, which check
-- public.is_admin() themselves and record an audit log entry, mirroring
-- how admin_messages/support_tickets are mutated elsewhere in this schema.

create or replace function public.admin_create_university_event(
    p_title text,
    p_description text,
    p_event_date date,
    p_start_time time,
    p_end_time time,
    p_location text,
    p_is_published boolean default true
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_title text := trim(coalesce(p_title, ''));
    v_description text := nullif(trim(coalesce(p_description, '')), '');
    v_location text := nullif(trim(coalesce(p_location, '')), '');
    v_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can create a university event' using errcode = '42501';
    end if;

    if char_length(v_title) < 1 or char_length(v_title) > 150 then
        raise exception 'Title must be between 1 and 150 characters' using errcode = '22023';
    end if;

    if p_event_date is null then
        raise exception 'Event date is required' using errcode = '22023';
    end if;

    if p_start_time is not null and p_end_time is not null and p_end_time < p_start_time then
        raise exception 'End time cannot be before start time' using errcode = '22023';
    end if;

    insert into public.university_events (
        title, description, event_date, start_time, end_time, location, is_published, created_by
    ) values (
        v_title, v_description, p_event_date, p_start_time, p_end_time, v_location,
        coalesce(p_is_published, true), (select auth.uid())
    )
    returning id into v_id;

    insert into public.admin_audit_log (actor_id, action, reason)
    values ((select auth.uid()), 'university_event_created', format('"%s" on %s', v_title, p_event_date));

    return v_id;
end;
$$;

grant execute on function public.admin_create_university_event(text, text, date, time, time, text, boolean) to authenticated;

create or replace function public.admin_update_university_event(
    p_id uuid,
    p_title text,
    p_description text,
    p_event_date date,
    p_start_time time,
    p_end_time time,
    p_location text,
    p_is_published boolean
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_title text := trim(coalesce(p_title, ''));
    v_description text := nullif(trim(coalesce(p_description, '')), '');
    v_location text := nullif(trim(coalesce(p_location, '')), '');
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can edit a university event' using errcode = '42501';
    end if;

    if char_length(v_title) < 1 or char_length(v_title) > 150 then
        raise exception 'Title must be between 1 and 150 characters' using errcode = '22023';
    end if;

    if p_event_date is null then
        raise exception 'Event date is required' using errcode = '22023';
    end if;

    if p_start_time is not null and p_end_time is not null and p_end_time < p_start_time then
        raise exception 'End time cannot be before start time' using errcode = '22023';
    end if;

    if not exists (select 1 from public.university_events where id = p_id) then
        raise exception 'Event not found' using errcode = 'P0002';
    end if;

    update public.university_events
    set title = v_title,
        description = v_description,
        event_date = p_event_date,
        start_time = p_start_time,
        end_time = p_end_time,
        location = v_location,
        is_published = coalesce(p_is_published, true),
        updated_at = now()
    where id = p_id;

    insert into public.admin_audit_log (actor_id, action, reason)
    values ((select auth.uid()), 'university_event_updated', format('"%s" on %s', v_title, p_event_date));
end;
$$;

grant execute on function public.admin_update_university_event(uuid, text, text, date, time, time, text, boolean) to authenticated;

create or replace function public.admin_delete_university_event(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_title text;
    v_date date;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can delete a university event' using errcode = '42501';
    end if;

    select title, event_date into v_title, v_date from public.university_events where id = p_id;

    if not found then
        raise exception 'Event not found' using errcode = 'P0002';
    end if;

    delete from public.university_events where id = p_id;

    insert into public.admin_audit_log (actor_id, action, reason)
    values ((select auth.uid()), 'university_event_deleted', format('"%s" on %s', v_title, v_date));
end;
$$;

grant execute on function public.admin_delete_university_event(uuid) to authenticated;

-- PHASE 5: Admin Inbox (one-way admin -> student messaging) and the student
-- Report tab's Support Tickets backend.
--
-- Two independent features, two independent schemas:
--   A. admin_messages / admin_message_recipients -- an administrator composes
--      ONE message and sends it to one, several, or all approved students.
--      Students can read it and toggle it read/unread. They can never reply,
--      edit it, or message each other through this table. There is no
--      "incoming" direction for students at all.
--   B. support_tickets / support_ticket_notes -- a student submits a report
--      about an issue. Only an admin can change its status or add an
--      internal note. There is no reply/conversation thread in this phase.
--
-- Every write (send a message, mark read/unread, submit a report, change a
-- ticket's status, add a note) goes through a SECURITY DEFINER function that
-- re-checks is_admin()/auth.uid() itself -- exactly the same pattern already
-- used by set_account_status() and admin_delete_rejected_account() in
-- 0002/0006. No table below grants INSERT/UPDATE/DELETE to the `authenticated`
-- role directly, so the frontend cannot write to them except through these
-- functions, and RLS stays the real boundary (never a frontend-only check).
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`), after
-- 0001-0007. Safe to re-run (create-if-not-exists / create-or-replace throughout).

-- =============================================================================
-- A. ADMIN INBOX
-- =============================================================================

create table if not exists public.admin_messages (
    id uuid primary key default gen_random_uuid(),
    subject text not null,
    body text not null,
    category text not null,
    sender_id uuid not null references public.profiles(id),
    recipient_scope text not null,
    recipient_count integer not null default 0,
    status text not null default 'sent',
    created_at timestamptz not null default now(),
    sent_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint admin_messages_category_check
        check (category in ('announcement', 'update', 'reminder', 'maintenance', 'general')),
    constraint admin_messages_scope_check
        check (recipient_scope in ('all', 'selected', 'single')),
    constraint admin_messages_status_check
        check (status in ('sent', 'archived')),
    constraint admin_messages_subject_len check (char_length(trim(subject)) between 1 and 150),
    constraint admin_messages_body_len check (char_length(trim(body)) between 1 and 4000)
);

create index if not exists admin_messages_sent_at_idx on public.admin_messages (sent_at desc);

create table if not exists public.admin_message_recipients (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.admin_messages(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    unique (message_id, student_id)
);

create index if not exists admin_message_recipients_student_idx
    on public.admin_message_recipients (student_id, created_at desc);
create index if not exists admin_message_recipients_message_idx
    on public.admin_message_recipients (message_id);

alter table public.admin_messages enable row level security;
alter table public.admin_message_recipients enable row level security;

-- Admins see every message; a student sees a message only if they are one of
-- its recipients AND it has not been archived.
drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
    for select to authenticated using (
        (select public.is_admin())
        or (
            deleted_at is null
            and exists (
                select 1 from public.admin_message_recipients r
                where r.message_id = id and r.student_id = (select auth.uid())
            )
        )
    );

-- A student may only ever see their own recipient row; admins see all (needed
-- for the admin message-detail recipient/read-status view).
drop policy if exists admin_message_recipients_select on public.admin_message_recipients;
create policy admin_message_recipients_select on public.admin_message_recipients
    for select to authenticated using (
        student_id = (select auth.uid()) or (select public.is_admin())
    );

-- Intentionally no insert/update/delete policy on either table for any client
-- role -- every write goes through the functions below, which run as the
-- table owner and therefore bypass RLS (identical to admin_audit_log's model).

-- -----------------------------------------------------------------------------
-- admin_send_message(): the only way a message + its recipient rows are ever
-- created. Runs as one transaction (the whole function body), so a message is
-- either fully created with every recipient row or not created at all -- never
-- a message with a partial recipient list.
-- -----------------------------------------------------------------------------
create or replace function public.admin_send_message(
    p_subject text,
    p_body text,
    p_category text,
    p_recipient_scope text,
    p_student_ids uuid[] default null
) returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_subject text := trim(coalesce(p_subject, ''));
    v_body text := trim(coalesce(p_body, ''));
    v_message_id uuid;
    v_recipient_ids uuid[];
    v_recipient_count integer;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can send administrative messages'
            using errcode = '42501';
    end if;

    if char_length(v_subject) < 1 or char_length(v_subject) > 150 then
        raise exception 'Subject must be between 1 and 150 characters' using errcode = '22023';
    end if;

    if char_length(v_body) < 1 or char_length(v_body) > 4000 then
        raise exception 'Message body must be between 1 and 4000 characters' using errcode = '22023';
    end if;

    if p_category not in ('announcement', 'update', 'reminder', 'maintenance', 'general') then
        raise exception 'Invalid message category: %', p_category using errcode = '22023';
    end if;

    if p_recipient_scope not in ('all', 'selected', 'single') then
        raise exception 'Invalid recipient scope: %', p_recipient_scope using errcode = '22023';
    end if;

    -- The recipient audience is always re-derived from `profiles` here, never
    -- trusted from the client beyond *which* student IDs were requested --
    -- so a tampered request can never reach a pending/rejected/suspended
    -- account, and 'all' can never be spoofed into something narrower/wider.
    if p_recipient_scope = 'all' then
        select array_agg(id) into v_recipient_ids
          from public.profiles
         where role = 'student' and account_status = 'approved';
    else
        if p_student_ids is null or array_length(p_student_ids, 1) is null then
            raise exception 'At least one recipient is required' using errcode = '22023';
        end if;
        if p_recipient_scope = 'single' and array_length(p_student_ids, 1) <> 1 then
            raise exception 'A single-recipient message must name exactly one student'
                using errcode = '22023';
        end if;
        select array_agg(distinct id) into v_recipient_ids
          from public.profiles
         where role = 'student'
           and account_status = 'approved'
           and id = any(p_student_ids);
    end if;

    if v_recipient_ids is null or array_length(v_recipient_ids, 1) is null then
        raise exception 'No eligible (approved) recipients were found for this message'
            using errcode = '22023';
    end if;

    insert into public.admin_messages (subject, body, category, sender_id, recipient_scope, status)
    values (v_subject, v_body, p_category, (select auth.uid()), p_recipient_scope, 'sent')
    returning id into v_message_id;

    insert into public.admin_message_recipients (message_id, student_id)
    select v_message_id, sid from unnest(v_recipient_ids) as sid;

    get diagnostics v_recipient_count = row_count;

    update public.admin_messages set recipient_count = v_recipient_count where id = v_message_id;

    insert into public.admin_audit_log (actor_id, action, target_user_id, reason)
    values (
        (select auth.uid()),
        'admin_message_sent',
        case when p_recipient_scope = 'single' then v_recipient_ids[1] else null end,
        format('"%s" sent to %s recipient(s) (%s)', v_subject, v_recipient_count, p_recipient_scope)
    );

    return v_message_id;
end;
$$;

grant execute on function public.admin_send_message(text, text, text, text, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- admin_archive_message(): soft-delete. Recipient rows (and their read state)
-- are preserved for audit purposes and for the admin's own message history;
-- the message is simply hidden from the student-facing select policy above.
-- -----------------------------------------------------------------------------
create or replace function public.admin_archive_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_subject text;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can archive a message' using errcode = '42501';
    end if;

    select subject into v_subject from public.admin_messages where id = p_message_id and deleted_at is null;

    if not found then
        raise exception 'Message not found (it may already be archived)' using errcode = 'P0002';
    end if;

    update public.admin_messages set deleted_at = now() where id = p_message_id;

    insert into public.admin_audit_log (actor_id, action, reason)
    values ((select auth.uid()), 'admin_message_archived', format('"%s"', v_subject));
end;
$$;

grant execute on function public.admin_archive_message(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- set_message_read_status(): the only way a recipient row's read state
-- changes. A student can only ever touch their own row (student_id =
-- auth.uid() in the WHERE clause), and only this one column.
-- -----------------------------------------------------------------------------
create or replace function public.set_message_read_status(p_message_id uuid, p_is_read boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
    if (select auth.uid()) is null then
        raise exception 'Not signed in' using errcode = '42501';
    end if;

    update public.admin_message_recipients
    set read_at = case when p_is_read then coalesce(read_at, now()) else null end
    where message_id = p_message_id
      and student_id = (select auth.uid());

    if not found then
        raise exception 'Message not found in your inbox' using errcode = 'P0002';
    end if;
end;
$$;

grant execute on function public.set_message_read_status(uuid, boolean) to authenticated;

-- =============================================================================
-- B. STUDENT SUPPORT TICKETS (Report tab)
-- =============================================================================

create sequence if not exists public.support_ticket_ref_seq;

create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    ticket_ref text not null unique,
    student_id uuid not null references public.profiles(id) on delete cascade,
    category text not null,
    subject text not null,
    description text not null,
    status text not null default 'open',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    updated_by uuid references public.profiles(id),
    constraint support_tickets_category_check check (category in (
        'account', 'data', 'schedule', 'tasks_grades', 'technical', 'feature_request', 'other'
    )),
    constraint support_tickets_status_check check (status in (
        'open', 'in_progress', 'waiting_user', 'resolved', 'closed'
    )),
    constraint support_tickets_subject_len check (char_length(trim(subject)) between 1 and 150),
    constraint support_tickets_description_len check (char_length(trim(description)) between 1 and 4000)
);

create index if not exists support_tickets_student_idx on public.support_tickets (student_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);

create table if not exists public.support_ticket_notes (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null references public.support_tickets(id) on delete cascade,
    admin_id uuid not null references public.profiles(id),
    note text not null,
    created_at timestamptz not null default now(),
    constraint support_ticket_notes_len check (char_length(trim(note)) between 1 and 2000)
);

create index if not exists support_ticket_notes_ticket_idx
    on public.support_ticket_notes (ticket_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_notes enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
    for select to authenticated using (
        student_id = (select auth.uid()) or (select public.is_admin())
    );

-- Internal notes: admin-only, in both directions -- a student must never be
-- able to read (or write) these, even for their own ticket.
drop policy if exists support_ticket_notes_select on public.support_ticket_notes;
create policy support_ticket_notes_select on public.support_ticket_notes
    for select to authenticated using ((select public.is_admin()));

-- Intentionally no insert/update/delete policy for any client role -- all
-- writes go through the functions below.

-- -----------------------------------------------------------------------------
-- submit_support_report(): the only way a ticket is created. Always writes
-- student_id = auth.uid() server-side, so a student can never file a report
-- under another account's identity no matter what the client sends.
-- -----------------------------------------------------------------------------
create or replace function public.submit_support_report(
    p_category text,
    p_subject text,
    p_description text
) returns table (id uuid, ticket_ref text)
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_subject text := trim(coalesce(p_subject, ''));
    v_description text := trim(coalesce(p_description, ''));
    v_id uuid;
    v_ref text;
begin
    if (select auth.uid()) is null then
        raise exception 'Not signed in' using errcode = '42501';
    end if;

    if not exists (select 1 from public.profiles where id = (select auth.uid())) then
        raise exception 'Your account profile could not be found' using errcode = 'P0002';
    end if;

    if p_category not in ('account', 'data', 'schedule', 'tasks_grades', 'technical', 'feature_request', 'other') then
        raise exception 'Invalid report category: %', p_category using errcode = '22023';
    end if;

    if char_length(v_subject) < 1 or char_length(v_subject) > 150 then
        raise exception 'Subject must be between 1 and 150 characters' using errcode = '22023';
    end if;

    if char_length(v_description) < 1 or char_length(v_description) > 4000 then
        raise exception 'Description must be between 1 and 4000 characters' using errcode = '22023';
    end if;

    v_ref := 'TCK-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.support_ticket_ref_seq')::text, 4, '0');

    insert into public.support_tickets (ticket_ref, student_id, category, subject, description, status)
    values (v_ref, (select auth.uid()), p_category, v_subject, v_description, 'open')
    returning support_tickets.id into v_id;

    return query select v_id, v_ref;
end;
$$;

grant execute on function public.submit_support_report(text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- admin_set_ticket_status(): the only way a ticket's status changes.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_ticket_status(
    p_ticket_id uuid,
    p_new_status text,
    p_note text default null
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_previous text;
    v_student_id uuid;
    v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can change a ticket''s status' using errcode = '42501';
    end if;

    if p_new_status not in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed') then
        raise exception 'Invalid ticket status: %', p_new_status using errcode = '22023';
    end if;

    select status, student_id into v_previous, v_student_id
      from public.support_tickets where id = p_ticket_id for update;

    if not found then
        raise exception 'Ticket not found' using errcode = 'P0002';
    end if;

    update public.support_tickets
    set status = p_new_status, updated_at = now(), updated_by = (select auth.uid())
    where id = p_ticket_id;

    if v_note is not null then
        insert into public.support_ticket_notes (ticket_id, admin_id, note)
        values (p_ticket_id, (select auth.uid()), v_note);
    end if;

    insert into public.admin_audit_log (actor_id, action, target_user_id, previous_status, new_status, reason)
    values ((select auth.uid()), 'ticket_status_change', v_student_id, v_previous, p_new_status, v_note);
end;
$$;

grant execute on function public.admin_set_ticket_status(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- admin_add_ticket_note(): add an internal note without changing status.
-- -----------------------------------------------------------------------------
create or replace function public.admin_add_ticket_note(p_ticket_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can add an internal note' using errcode = '42501';
    end if;

    if v_note is null then
        raise exception 'Note cannot be empty' using errcode = '22023';
    end if;

    if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
        raise exception 'Ticket not found' using errcode = 'P0002';
    end if;

    insert into public.support_ticket_notes (ticket_id, admin_id, note) values (p_ticket_id, (select auth.uid()), v_note);

    update public.support_tickets set updated_at = now(), updated_by = (select auth.uid()) where id = p_ticket_id;
end;
$$;

grant execute on function public.admin_add_ticket_note(uuid, text) to authenticated;

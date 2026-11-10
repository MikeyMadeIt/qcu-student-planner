-- PHASE 5 FIX: two ambiguous-identifier bugs found after 0008/0009 were

-- Fix 1: qualify the outer table's id explicitly instead of leaving it bare.
drop policy if exists admin_messages_select on public.admin_messages;
create policy admin_messages_select on public.admin_messages
    for select to authenticated using (
        (select public.is_admin())
        or (
            deleted_at is null
            and exists (
                select 1 from public.admin_message_recipients r
                where r.message_id = admin_messages.id
                  and r.student_id = (select auth.uid())
            )
        )
    );

-- Fix 2: tell PL/pgSQL to prefer table columns over same-named variables for
create or replace function public.submit_support_report(
    p_category text,
    p_subject text,
    p_description text
) returns table (id uuid, ticket_ref text)
language plpgsql
security definer
set search_path to ''
as $$
#variable_conflict use_column
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

NOTIFY pgrst, 'reload schema';

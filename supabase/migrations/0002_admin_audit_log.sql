-- Adds a trusted, append-only audit log for administrative actions, and extends
-- set_account_status() to write to it in the same transaction as the status
-- change it performs. No client role can INSERT/UPDATE/DELETE this table
-- directly -- only SECURITY DEFINER functions (running as the table owner)
-- can write to it, so the frontend cannot fabricate a log entry.
--
-- STATUS: Already applied manually via the Supabase SQL editor (confirmed by project owner).
-- Kept here so the repository reflects the live schema.

create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid not null references auth.users(id),
    action text not null,
    target_user_id uuid references public.profiles(id),
    previous_status text,
    new_status text,
    reason text,
    created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log
    for select to authenticated using ((select public.is_admin()));

-- Intentionally no insert/update/delete policy for any client role.

create or replace function public.set_account_status(target_user_id uuid, new_status text, reason text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
    v_previous text;
begin
    if not public.is_admin() then
        raise exception 'Only an approved admin can change account status'
            using errcode = '42501';
    end if;

    if new_status not in ('approved', 'rejected', 'suspended', 'pending') then
        raise exception 'Invalid account status: %', new_status
            using errcode = '22023';
    end if;

    if target_user_id = (select auth.uid()) and new_status <> 'approved' then
        raise exception 'Admins cannot change their own status through this function'
            using errcode = '42501';
    end if;

    select account_status into v_previous from public.profiles where id = target_user_id;

    if not found then
        raise exception 'User profile not found'
            using errcode = 'P0002';
    end if;

    update public.profiles
    set account_status = new_status,
        reviewed_by = (select auth.uid()),
        reviewed_at = now(),
        rejection_reason = case
            when new_status = 'rejected' then nullif(trim(reason), '')
            else null
        end
    where id = target_user_id;

    insert into public.admin_audit_log (actor_id, action, target_user_id, previous_status, new_status, reason)
    values ((select auth.uid()), 'account_status_change', target_user_id, v_previous, new_status, reason);
end;
$$;

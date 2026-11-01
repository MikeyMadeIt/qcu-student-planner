-- FIX: Activity Log page fails to load with "You are not authorized to
-- perform this action."
--
-- Same class of bug as 0007 (service_role) and 0009 (messaging/ticket
-- tables): error code 42501 on a plain `select` means the role has no
-- base table-level GRANT yet -- that check runs *before* RLS is ever
-- consulted. A policy rejecting rows never raises 42501, it just returns
-- zero rows.
--
-- 0002 enabled RLS and wrote the admin_audit_log_select policy, but never
-- issued the underlying table-level GRANT to `authenticated`, and this
-- project's schema does not auto-provision that (see 0007's header). This
-- restores it, the same way 0009 did for admin_messages/support_tickets.
--
-- Granting only SELECT is safe: admin_audit_log is append-only by design
-- (see 0002) -- there is still no insert/update/delete policy for
-- `authenticated`, so writes remain possible only through the SECURITY
-- DEFINER functions that log to it. This grant only unblocks what RLS's
-- SELECT policy already allows.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`),
-- after 0011. Safe to re-run.

grant select
    on public.admin_audit_log
    to authenticated;

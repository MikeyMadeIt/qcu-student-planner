-- PHASE 5 FOLLOW-UP: restore `authenticated`'s table-level privileges on the
-- new messaging/ticket tables.
--
-- Diagnosed from the same class of error 0007 already fixed for service_role,
-- this time on `authenticated`: the admin Inbox page failed to load sent
-- messages with "You are not authorized to perform this action", which the
-- frontend maps from Postgres error code 42501 ("permission denied for
-- table ..."). That error code is the tell: a Row Level Security policy
-- rejecting a row does NOT raise 42501 -- a SELECT against a table whose RLS
-- policy excludes every row simply returns zero rows, no error at all. 42501
-- on a plain `select` only happens when the role doesn't have a base
-- table-level GRANT yet, which is a plain Postgres privilege check that runs
-- *before* RLS is ever consulted (see 0007's header comment for the same
-- diagnosis against `service_role`).
--
-- 0008 enabled RLS and wrote policies for admin_messages,
-- admin_message_recipients, support_tickets and support_ticket_notes, but
-- never issued the underlying table-level GRANT to `authenticated` -- and per
-- 0007, this project's schema does not reliably auto-provision that the way
-- a fresh Supabase project normally would. This migration restores it, the
-- same way 0007 restored it for service_role.
--
-- Granting INSERT/UPDATE/DELETE here is safe even though every write to
-- these four tables is meant to go only through the SECURITY DEFINER
-- functions in 0008: there is still no RLS insert/update/delete policy for
-- `authenticated` on any of them, and when RLS is enabled with no policy for
-- an operation, that operation is denied for every row regardless of the
-- table-level grant. The grant only unblocks what RLS's SELECT policies
-- already allow; it adds no new access on its own.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`), after
-- 0008. Safe to re-run.

grant select, insert, update, delete
    on public.admin_messages,
       public.admin_message_recipients,
       public.support_tickets,
       public.support_ticket_notes
    to authenticated;

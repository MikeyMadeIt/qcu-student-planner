-- FIX: Admin Activity Log page fails with a generic "request could not be
-- completed" error on every load.
--
-- AdminService.listAuditLog() asks PostgREST to embed both sides of the log
-- entry: `actor:actor_id(full_name)` and `target:target_user_id(full_name)`,
-- both resolving into public.profiles. target_user_id already has a real FK
-- to public.profiles(id) (added in 0006), so that half works. actor_id,
-- though, was only ever declared against auth.users(id) (0002) -- there is
-- no foreign key from admin_audit_log.actor_id to public.profiles at all, so
-- PostgREST can't auto-detect how to embed `actor:actor_id(full_name)` and
-- returns a "could not find a relationship" error (PGRST200), which is an
-- error code the frontend doesn't recognize and falls through to the generic
-- message.
--
-- Fix: add a second foreign key from actor_id straight to public.profiles(id)
-- (every admin_audit_log.actor_id value is, and always has been, an admin's
-- own id, which is also a profiles.id row -- this does not change or
-- constrain any existing data, it only gives PostgREST a relationship to
-- find). A column can carry FKs to two different tables at once; Postgres
-- just checks both on write, and both already hold for every existing row.
--
-- Run this once, after 0010. Safe to re-run.

alter table public.admin_audit_log
    drop constraint if exists admin_audit_log_actor_id_profiles_fkey;

alter table public.admin_audit_log
    add constraint admin_audit_log_actor_id_profiles_fkey
    foreign key (actor_id) references public.profiles(id);

NOTIFY pgrst, 'reload schema';

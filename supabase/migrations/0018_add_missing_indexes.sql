-- ============================================================
-- 0018_add_missing_indexes.sql
--
-- CORRECTIVE MIGRATION (database audit, 2026-11-02). Forward-only --
-- does not alter any prior migration's schema decisions, only adds
-- indexes. Purely additive and idempotent (IF NOT EXISTS throughout).
--
-- Finding: public.admin_audit_log was created in 0002 with only a
-- primary key index. Nothing in 0002/0006/0011/0012 ever added an
-- index on created_at, actor_id or target_user_id, even though:
--
--   - assets/js/services/admin-service.js's listAuditLog() queries
--     this exact table with `.order('created_at', { ascending: false
--     }).range(from, to)` for every page of the Admin Activity Log --
--     an unindexed ORDER BY + OFFSET/LIMIT forces a full table sort
--     on every page load, which only gets worse as the log grows
--     (and it is append-only, so it never shrinks).
--   - The same query also embeds `actor:actor_id(full_name)` and
--     `target:target_user_id(full_name)` (PostgREST foreign-key
--     embeds added in 0011/0006), which PostgREST resolves as joins
--     against public.profiles keyed on these two columns -- both FK
--     columns, neither indexed.
--
-- This migration adds the three indexes this query pattern needs.
-- It grants no new access and changes no RLS policy, function, or
-- constraint -- it only makes already-permitted reads faster.
-- ============================================================

create index if not exists idx_admin_audit_log_created_at
    on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_log_actor_id
    on public.admin_audit_log (actor_id);

create index if not exists idx_admin_audit_log_target_user_id
    on public.admin_audit_log (target_user_id);

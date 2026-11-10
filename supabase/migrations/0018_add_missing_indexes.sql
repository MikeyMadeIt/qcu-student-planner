-- 0018_add_missing_indexes.sql

create index if not exists idx_admin_audit_log_created_at
    on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_log_actor_id
    on public.admin_audit_log (actor_id);

create index if not exists idx_admin_audit_log_target_user_id
    on public.admin_audit_log (target_user_id);

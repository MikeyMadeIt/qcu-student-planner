-- FIX: Admin Activity Log page fails with a generic "request could not be

alter table public.admin_audit_log
    drop constraint if exists admin_audit_log_actor_id_profiles_fkey;

alter table public.admin_audit_log
    add constraint admin_audit_log_actor_id_profiles_fkey
    foreign key (actor_id) references public.profiles(id);

NOTIFY pgrst, 'reload schema';

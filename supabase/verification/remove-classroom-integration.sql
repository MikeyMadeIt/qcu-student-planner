-- MANUAL CLEANUP ONLY. This script was prepared from the repository migrations
-- and has NOT been executed. Confirm the target Supabase project is
-- pjafmgabajqqozdxhzvz and obtain explicit approval before running it.
--
-- Dependency ordering:
--   1. Remove the Classroom-only trigger.
--   2. Remove its trigger function and Classroom-only RPC functions.
--   3. Remove only Vault rows whose names use the migration-owned prefix.
--   4. Drop the Classroom-owned tables. RESTRICT (the default) intentionally
--      aborts if any unexpected database object depends on a target.
--
-- No CASCADE is used. This leaves public.profiles, Supabase Auth, Vault,
-- supabase_vault, the private schema, unrelated grants, and unrelated data
-- untouched. Stop and review any dependency error before making adjustments.

begin;

do $$
begin
    if to_regclass('public.classroom_connections') is not null then
        execute 'drop trigger if exists classroom_connection_delete_secret on public.classroom_connections';
    end if;
end;
$$;

drop function if exists private.delete_classroom_refresh_secret();

drop function if exists public.classroom_create_oauth_transaction(
    text, uuid, text, text, text, text[], timestamptz
);
drop function if exists public.classroom_consume_oauth_transaction(text);
drop function if exists public.classroom_create_oauth_transaction_v2(
    text, uuid, text, text, text, text[], timestamptz, text
);
drop function if exists public.classroom_consume_oauth_transaction_v2(text);
drop function if exists public.classroom_save_connection(
    uuid, text, text, text, timestamptz, text[]
);
drop function if exists public.classroom_get_refresh_token(uuid, uuid);
drop function if exists public.classroom_disconnect_connection(uuid, uuid);
drop function if exists public.classroom_mark_reauthorization_required(uuid, uuid);
drop function if exists public.classroom_record_token_refresh(
    uuid, uuid, timestamptz, text
);

-- These names are created only by the Classroom migrations. Do not broaden
-- this predicate or delete Vault objects by description or table ownership.
do $$
begin
    if to_regclass('vault.secrets') is not null then
        execute $cleanup$
            delete from vault.secrets
            where name like 'qcu-classroom-refresh-%'
        $cleanup$;
    end if;
end;
$$;

drop table if exists public.classroom_connections;
drop table if exists private.classroom_oauth_transactions;

commit;

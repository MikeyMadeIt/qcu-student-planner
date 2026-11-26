-- Read-only catalog inspection for the live Supabase project.
-- Run in the Supabase SQL Editor. This does not set auth.uid() and does not
-- impersonate an application user; it verifies schema objects, not behavior
-- under student/admin JWTs. Do not treat a NULL auth.uid() here as a failure.

-- 1. Every public table and its RLS mode.
select n.nspname as schema_name,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname;

-- 2. Every policy and its effective predicate.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Every foreign key, including its delete/update action and validation state.
select conrelid::regclass as table_name,
       conname as constraint_name,
       confrelid::regclass as referenced_table,
       pg_get_constraintdef(oid, true) as definition,
       convalidated as validated
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;

-- 4. Unique, primary-key, and check constraints.
select conrelid::regclass as table_name,
       conname as constraint_name,
       case contype when 'p' then 'primary key'
                    when 'u' then 'unique'
                    when 'c' then 'check' end as constraint_type,
       pg_get_constraintdef(oid, true) as definition,
       convalidated as validated
from pg_constraint
where contype in ('p', 'u', 'c')
  and connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;

-- 5. Index definitions and validity.
select schemaname, tablename, indexname, indexdef,
       i.indisvalid as valid, i.indisready as ready
from pg_indexes p
join pg_class idx on idx.relname = p.indexname
join pg_namespace n on n.oid = idx.relnamespace and n.nspname = p.schemaname
join pg_index i on i.indexrelid = idx.oid
where schemaname = 'public'
order by tablename, indexname;

-- 6. User-defined triggers, including the actual attached relation/function.
select t.tgrelid::regclass as table_name,
       t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as definition,
       p.oid::regprocedure as function_name,
       pg_get_functiondef(p.oid) as function_definition
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
order by t.tgrelid::regclass::text, t.tgname;

-- 7. Privileged functions, search_path settings, and grants.
select p.oid::regprocedure as function_name,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       p.proacl as privileges,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
order by p.oid::regprocedure::text;

-- 8. Table grants to API roles.
select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 9. Supabase Storage bucket visibility and object policies (if Storage is
-- enabled in this project). This lists policy predicates without reading files.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;

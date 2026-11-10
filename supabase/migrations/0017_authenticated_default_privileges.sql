-- 0007_grant_service_role_privileges.sql)

alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
    grant usage, select on sequences to authenticated;
alter default privileges for role postgres in schema public
    grant execute on functions to authenticated;


-- 0022_semesters_conflict_target_fix.sql

drop index if exists public.semesters_user_client_uidx;

-- Defensive cleanup: the broken conflict target above meant every semester
delete from public.semesters a
    using public.semesters b
    where a.client_id is not null
      and a.user_id = b.user_id
      and a.client_id = b.client_id
      and a.created_at > b.created_at;

create unique index if not exists semesters_user_client_uidx2
    on public.semesters (user_id, client_id);

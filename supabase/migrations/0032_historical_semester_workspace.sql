-- Allow students to continue working in their own historical semester
-- workspace. The active university period remains admin controlled, and a
-- future university period cannot receive planner records before activation.
-- This deliberately does not rewrite or delete any existing planner rows.

begin;

-- AI study artifacts are semester scoped too. Existing unassigned artifacts
-- are preserved for review; they are not guessed into a semester.
do $$
declare v_table text;
begin
    foreach v_table in array array['ai_quizzes','ai_quiz_attempts','ai_flashcard_decks'] loop
        if to_regclass(format('public.%I', v_table)) is not null then
            execute format('alter table public.%I add column if not exists semester_id uuid', v_table);
            execute format('create index if not exists %I on public.%I (user_id, semester_id)', v_table || '_user_semester_idx', v_table);
            if not exists (
                select 1 from pg_constraint c
                where c.conrelid = format('public.%I', v_table)::regclass
                  and c.confrelid = 'public.semesters'::regclass
                  and c.contype = 'f'
                  and exists (
                      select 1 from unnest(c.conkey) k(attnum)
                      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
                      where a.attname = 'semester_id'
                  )
            ) then
                execute format('alter table public.%I add constraint %I foreign key (semester_id) references public.semesters(id) on delete restrict not valid', v_table, v_table || '_semester_id_fkey');
            end if;
        end if;
    end loop;
end;
$$;

do $$
begin
    if to_regclass('public.ai_quizzes') is not null or to_regclass('public.ai_flashcard_decks') is not null then
        execute $fn$
            create or replace function public.guard_ai_semester_owner()
            returns trigger language plpgsql security definer set search_path to '' as $body$
            declare v_owner uuid; v_shared boolean; v_start date; v_active uuid;
            begin
                if new.semester_id is null then return new; end if;
                select user_id, is_university_wide, start_date
                  into v_owner, v_shared, v_start
                  from public.semesters where id = new.semester_id;
                if not found or (not v_shared and v_owner is distinct from new.user_id) then
                    raise exception 'Semester does not belong to this student' using errcode = '42501';
                end if;
                if v_shared then
                    select active_semester_id into v_active from public.system_settings where id = true;
                    if new.semester_id is distinct from v_active and v_start > (now() at time zone 'Asia/Manila')::date then
                        raise exception 'Future academic periods cannot receive study records' using errcode = '23514';
                    end if;
                end if;
                return new;
            end;
            $body$
        $fn$;
    end if;
    if to_regclass('public.ai_quizzes') is not null then
        execute 'drop trigger if exists trg_ai_quizzes_semester_owner on public.ai_quizzes';
        execute 'create trigger trg_ai_quizzes_semester_owner before insert or update of semester_id on public.ai_quizzes for each row execute function public.guard_ai_semester_owner()';
    end if;
    if to_regclass('public.ai_flashcard_decks') is not null then
        execute 'drop trigger if exists trg_ai_flashcard_decks_semester_owner on public.ai_flashcard_decks';
        execute 'create trigger trg_ai_flashcard_decks_semester_owner before insert or update of semester_id on public.ai_flashcard_decks for each row execute function public.guard_ai_semester_owner()';
    end if;
    if to_regclass('public.ai_quiz_attempts') is not null then
        execute $fn$
            create or replace function public.guard_ai_quiz_attempt_semester()
            returns trigger language plpgsql security definer set search_path to '' as $body$
            declare v_quiz_semester uuid;
            begin
                if new.semester_id is null then
                    raise exception 'Quiz attempts must have a semester' using errcode = '23514';
                end if;
                select semester_id into v_quiz_semester from public.ai_quizzes
                where id = new.quiz_id and user_id = new.user_id;
                if v_quiz_semester is distinct from new.semester_id then
                    raise exception 'Quiz and attempt must belong to the same semester' using errcode = '23514';
                end if;
                return new;
            end;
            $body$
        $fn$;
        execute 'drop trigger if exists trg_ai_quiz_attempt_semester on public.ai_quiz_attempts';
        execute 'create trigger trg_ai_quiz_attempt_semester before insert or update of quiz_id, semester_id on public.ai_quiz_attempts for each row execute function public.guard_ai_quiz_attempt_semester()';
    end if;
end;
$$;

create or replace function public.guard_active_semester_assignment()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
    v_active uuid;
    v_is_university_wide boolean;
    v_start_date date;
begin
    if new.semester_id is null then
        if tg_op = 'INSERT' then
            raise exception 'New academic records must have a semester' using errcode = '23514';
        end if;
        return new;
    end if;

    select active_semester_id into v_active
    from public.system_settings where id = true;
    select is_university_wide, start_date
      into v_is_university_wide, v_start_date
      from public.semesters where id = new.semester_id;

    if not found then
        raise exception 'Academic period not found' using errcode = '23503';
    end if;

    if v_is_university_wide
       and new.semester_id is distinct from v_active
       and v_start_date > (now() at time zone 'Asia/Manila')::date then
        raise exception 'Future academic periods cannot receive planner records' using errcode = '23514';
    end if;
    return new;
end;
$$;

commit;

-- Shared university semesters are not owned by individual students.
-- Replace composite student/semester foreign keys, if present, with a normal
-- FK to semesters(id). Student ownership remains enforced by RLS and the
-- existing *_guard_fk triggers (including semester membership validation).
-- Existing rows are preserved; NOT VALID avoids blocking this migration on
-- unrelated historical rows while enforcing the FK for all new writes.

begin;

do $$
declare
    v_table text;
    v_constraint record;
    v_has_single_semester_fk boolean;
    v_constraint_name text;
begin
    foreach v_table in array array[
        'subjects', 'tasks', 'notes', 'calendar_events', 'attendance',
        'grades', 'gwa_calculator', 'ai_quizzes', 'ai_quiz_attempts',
        'ai_flashcard_decks'
    ] loop
        if to_regclass(format('public.%I', v_table)) is null then
            continue;
        end if;

        -- Remove only composite FKs to semesters that couple the record's
        -- user_id to semesters.user_id. Such a relationship rejects shared
        -- semester rows where semesters.user_id is intentionally NULL.
        for v_constraint in
            select c.conname,
                   array_agg(a.attname order by k.ord) as local_columns,
                   array_agg(ra.attname order by rk.ord) as referenced_columns
            from pg_constraint c
            cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
            join lateral unnest(c.confkey) with ordinality as rk(attnum, ord) on rk.ord = k.ord
            join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = rk.attnum
            where c.conrelid = format('public.%I', v_table)::regclass
              and c.confrelid = 'public.semesters'::regclass
              and c.contype = 'f'
            group by c.conname
        loop
            if array_length(v_constraint.local_columns, 1) > 1
               and 'semester_id' = any(v_constraint.local_columns)
               and 'user_id' = any(v_constraint.local_columns)
               and 'user_id' = any(v_constraint.referenced_columns) then
                execute format('alter table public.%I drop constraint %I', v_table, v_constraint.conname);
            end if;
        end loop;

        select exists (
            select 1
            from pg_constraint c
            join unnest(c.conkey) with ordinality as k(attnum, ord) on true
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
            join unnest(c.confkey) with ordinality as rk(attnum, ord) on rk.ord = k.ord
            join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = rk.attnum
            where c.conrelid = format('public.%I', v_table)::regclass
              and c.confrelid = 'public.semesters'::regclass
              and c.contype = 'f'
              and cardinality(c.conkey) = 1
              and a.attname = 'semester_id'
              and ra.attname = 'id'
        ) into v_has_single_semester_fk;

        if not v_has_single_semester_fk then
            v_constraint_name := v_table || '_semester_id_academic_fkey';
            if exists (
                select 1 from pg_constraint c
                where c.conrelid = format('public.%I', v_table)::regclass
                  and c.conname = v_constraint_name
            ) then
                v_constraint_name := v_table || '_semester_id_shared_fkey';
            end if;
            execute format(
                'alter table public.%I add constraint %I foreign key (semester_id) references public.semesters(id) on delete restrict not valid',
                v_table, v_constraint_name
            );
        end if;
    end loop;
end;
$$;

commit;

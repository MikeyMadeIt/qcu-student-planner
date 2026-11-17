-- Settings -> Data & Storage -> "Reset all data".
--
-- A single, atomic, user-scoped deletion of every planner record the
-- signed-in user owns. Runs with the CALLER's own privileges (no
-- "security definer", no service-role key): every statement below is
-- still subject to the normal RLS policies on each table, and every
-- WHERE clause is anchored to auth.uid() rather than an argument, so a
-- caller can never pass someone else's id. That means this function
-- needs nothing beyond what the authenticated role already has, and
-- is safe to grant to every authenticated user to run against their
-- own id only.
--
-- It intentionally does NOT touch: auth.users, public.profiles (name,
-- course, year level, school, role, account_status and everything
-- else that controls sign-in and approval), or institutional records
-- such as support_tickets / admin_messages / university_events that
-- are not "this user's planner data" so much as a record of
-- correspondence with the school.
--
-- Deletion order is children-before-parents so it works whether or not
-- a given foreign key happens to cascade.
create or replace function public.reset_my_planner_data()
returns void
language plpgsql
set search_path to ''
as $$
declare
    v_uid uuid := auth.uid();
    v_grade_ids uuid[];
    v_component_ids uuid[];
begin
    if v_uid is null then
        raise exception 'Not signed in' using errcode = '28000';
    end if;

    -- AI study tools
    delete from public.ai_quiz_questions where user_id = v_uid;
    delete from public.ai_quiz_attempts where user_id = v_uid;
    delete from public.ai_quizzes where user_id = v_uid;
    delete from public.ai_flashcards where user_id = v_uid;
    delete from public.ai_flashcard_decks where user_id = v_uid;
    delete from public.ai_chat_messages where user_id = v_uid;
    delete from public.ai_chat_conversations where user_id = v_uid;

    -- Tasks
    delete from public.task_checklist_items
     where task_id in (select id from public.tasks where user_id = v_uid);
    delete from public.tasks where user_id = v_uid;

    -- Grades
    select array_agg(id) into v_grade_ids from public.grades where user_id = v_uid;
    if v_grade_ids is not null then
        select array_agg(gc.id) into v_component_ids
          from public.grade_components gc
         where gc.grade_id = any(v_grade_ids);
        if v_component_ids is not null then
            delete from public.grade_assessments where component_id = any(v_component_ids);
        end if;
        delete from public.grade_components where grade_id = any(v_grade_ids);
    end if;
    delete from public.grades where user_id = v_uid;

    -- Everything else keyed straight to the user
    delete from public.notes where user_id = v_uid;
    delete from public.calendar_events where user_id = v_uid;
    delete from public.attendance where user_id = v_uid;
    delete from public.gwa_calculator where user_id = v_uid;
    delete from public.cancelled_occurrences where user_id = v_uid;
    delete from public.cancelled_class_occurrences where user_id = v_uid;
    delete from public.subjects where user_id = v_uid;
    delete from public.user_preferences where user_id = v_uid;

    -- Semesters last: nothing above references them anymore once the
    -- rows that used to point at one are gone.
    delete from public.semesters where user_id = v_uid;
end;
$$;

-- Deliberately NOT granted to anon: only a signed-in user can reset
-- their own data, and only their own (see v_uid := auth.uid() above).
grant execute on function public.reset_my_planner_data() to authenticated;

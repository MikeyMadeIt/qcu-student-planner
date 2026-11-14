-- 0025_approved_only_data_access_remaining.sql
--
-- Follow-up to the approved-only RLS pass: some tables (syllabus_*,
-- user_settings, push_subscriptions) have since been dropped from the
-- project, and the policies that did get the is_approved() check use
-- different names than originally planned. This migration is written
-- directly against the CURRENT schema dump, and only touches the
-- policies that are still missing the check:
--   grades, grade_components, grade_assessments, semesters (all 5),
--   cancelled_occurrences, cancelled_class_occurrences, and every
--   ai_quizzes / ai_quiz_questions / ai_quiz_attempts / ai_flashcard_decks /
--   ai_flashcards / ai_chat_conversations / ai_chat_messages policy.
--
-- Everything else (notes, calendar_events, gwa_calculator, subjects, tasks,
-- task_checklist_items, attendance, profiles, student_services,
-- university_events) already has is_approved() and is left untouched.

-- grades / grade_components / grade_assessments -----------------------------

drop policy if exists "grades_own" on public.grades;
create policy "grades_own" on public.grades
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

drop policy if exists "grade_components_own" on public.grade_components;
create policy "grade_components_own" on public.grade_components
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (select 1 from public.grades g where g.id = grade_components.grade_id and g.user_id = (select auth.uid()))
    )
    with check (
        (select public.is_approved())
        and exists (select 1 from public.grades g where g.id = grade_components.grade_id and g.user_id = (select auth.uid()))
    );

drop policy if exists "grade_assessments_own" on public.grade_assessments;
create policy "grade_assessments_own" on public.grade_assessments
    for all to authenticated
    using (
        (select public.is_approved())
        and exists (
            select 1 from public.grade_components gc
            join public.grades g on g.id = gc.grade_id
            where gc.id = grade_assessments.component_id and g.user_id = (select auth.uid())
        )
    )
    with check (
        (select public.is_approved())
        and exists (
            select 1 from public.grade_components gc
            join public.grades g on g.id = gc.grade_id
            where gc.id = grade_assessments.component_id and g.user_id = (select auth.uid())
        )
    );

-- semesters: 5 separate policies today (select/insert/update/delete + a
-- redundant "own" catch-all) — collapse into the same single-policy shape
-- the other tables use, with is_approved() added.

drop policy if exists "semesters_select_own" on public.semesters;
drop policy if exists "semesters_insert_own" on public.semesters;
drop policy if exists "semesters_update_own" on public.semesters;
drop policy if exists "semesters_delete_own" on public.semesters;
drop policy if exists "semesters_own" on public.semesters;
create policy "semesters_own" on public.semesters
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

-- cancelled_occurrences / cancelled_class_occurrences ------------------------

drop policy if exists "own rows" on public.cancelled_occurrences;
create policy "own rows" on public.cancelled_occurrences
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

drop policy if exists "cco_own" on public.cancelled_class_occurrences;
create policy "cco_own" on public.cancelled_class_occurrences
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

-- AI tools: quizzes, flashcards, chat ---------------------------------------

drop policy if exists "ai_quizzes_own" on public.ai_quizzes;
create policy "ai_quizzes_own" on public.ai_quizzes
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

drop policy if exists "ai_quiz_questions_own" on public.ai_quiz_questions;
create policy "ai_quiz_questions_own" on public.ai_quiz_questions
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (
        user_id = (select auth.uid())
        and (select public.is_approved())
        and exists (select 1 from public.ai_quizzes q where q.id = ai_quiz_questions.quiz_id and q.user_id = (select auth.uid()))
    );

drop policy if exists "ai_quiz_attempts_own" on public.ai_quiz_attempts;
create policy "ai_quiz_attempts_own" on public.ai_quiz_attempts
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (
        user_id = (select auth.uid())
        and (select public.is_approved())
        and exists (select 1 from public.ai_quizzes q where q.id = ai_quiz_attempts.quiz_id and q.user_id = (select auth.uid()))
    );

drop policy if exists "ai_flashcard_decks_own" on public.ai_flashcard_decks;
create policy "ai_flashcard_decks_own" on public.ai_flashcard_decks
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

drop policy if exists "ai_flashcards_own" on public.ai_flashcards;
create policy "ai_flashcards_own" on public.ai_flashcards
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (
        user_id = (select auth.uid())
        and (select public.is_approved())
        and exists (select 1 from public.ai_flashcard_decks d where d.id = ai_flashcards.deck_id and d.user_id = (select auth.uid()))
    );

drop policy if exists "ai_chat_conversations_own" on public.ai_chat_conversations;
create policy "ai_chat_conversations_own" on public.ai_chat_conversations
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (user_id = (select auth.uid()) and (select public.is_approved()));

drop policy if exists "ai_chat_messages_own" on public.ai_chat_messages;
create policy "ai_chat_messages_own" on public.ai_chat_messages
    for all to authenticated
    using (user_id = (select auth.uid()) and (select public.is_approved()))
    with check (
        user_id = (select auth.uid())
        and (select public.is_approved())
        and exists (select 1 from public.ai_chat_conversations c where c.id = ai_chat_messages.conversation_id and c.user_id = (select auth.uid()))
    );

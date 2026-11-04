# QCU Student Planner — Data Isolation & Supabase Security Audit

Scope: data isolation and Supabase security only, covering every table touched by
the Subjects/Schedule/Calendar/Tasks and Grades-GWA/Attendance/Syllabus/Notes
cloud migrations, plus the pre-existing tables they share RLS patterns with.

## What I inspected

- All 28 `public.*` tables, their ownership columns (`user_id`), foreign keys, and
  the RLS policies listed for them (as documented in the project's schema/RLS
  export — this environment has no live network/DB access, so this audit is a
  **static review of the schema export and the repo's migration history**, not a
  live `psql`/dashboard inspection).
- `is_admin()`, `is_approved()`, `profiles_guard_privileged_columns()` and the
  other `SECURITY DEFINER` functions already in the migrations folder.
- Every place in the frontend (`cloud-sync.js`, `auth-service.js`, `storage.js`)
  that reads, writes, or caches the data these tables hold.

## Findings & fixes (`supabase/migrations/0016_security_audit_data_isolation.sql`)

1. **RLS-enabled guarantee (defense against drift).** None of these 28 tables were
   created via a migration in this repo (they predate it / were created in the
   dashboard), so there's no in-repo proof RLS is actually turned **on** for all
   of them — only that policies exist for most. A table can have well-written
   policies and still be wide open if RLS itself is off. Fix: idempotent
   `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all 28 tables.

2. **Foreign-key ownership spoofing (real gap, fixed).** The `*_own` policies
   (`tasks_own`, `notes_own`, `attendance_own`, `grades_own`,
   `syllabus_courses_own`, `subjects_own`, `calendar_events_own`,
   `gwa_calculator_own`) correctly require `user_id = auth.uid()` on the row
   itself, in both `USING` and `WITH CHECK` — but none of them verify that a
   *related* row a foreign key points at (`subject_id`, `task_id`,
   `semester_id`) belongs to that same user. A student's `user_id` is forced
   correct by RLS, but nothing stopped a hand-crafted request (same student,
   real session) from setting e.g. `subject_id` to **another student's**
   subject UUID. This doesn't let one student *read* another's data through
   this path, but it is a genuine cross-tenant write and exactly the class of
   bypass requirement #4/#5 describe. Fixed with a reusable
   `assert_owned_fk()` function and `BEFORE INSERT OR UPDATE` triggers on
   `tasks`, `notes`, `attendance`, `subjects`, `calendar_events`, `grades`,
   `gwa_calculator`, and `syllabus_courses` that re-validate every such FK
   against the row's own `user_id`, independent of whatever the frontend sends.

   While building this, I found that `tasks.syllabus_week_id` (set when a task
   is created from a syllabus week) pointed at an id that only exists inside
   `syllabus_courses.data` (jsonb) — `syllabus_weeks` is intentionally left
   unpopulated (see the Syllabus migration). The new FK-ownership trigger would
   have rejected every such save. Fixed by **no longer writing that value to
   the real `syllabus_week_id` column** (`cloud-sync.js` now always sends
   `null` there) and keeping the task↔week link in a small client-side map
   instead (`sp_cloud_task_syllabus_week_map`), the same pattern already used
   for the local-only semester link. This was a genuine (pre-existing) latent
   bug the audit surfaced, not a security issue by itself, but it would have
   broken saving in combination with the new trigger, so I fixed it here.

3. **`profiles` privileged-column escalation** (`role`, `account_status`) —
   already closed by `0013_lock_profiles_privileged_columns.sql`. Re-verified
   the trigger logic during this audit; no gap found, no change made.

4. **`grade_components` / `grade_assessments` / `task_checklist_items`** have no
   `user_id` column of their own. Their `*_own` policies already join up to the
   owning `grades`/`tasks` row's `user_id` in both `USING` and `WITH CHECK`,
   which is the correct and sufficient check — re-verified, no gap, no change.

5. **Stale cross-student cache on shared devices (requirement #7).** This is not
   an RLS issue but a real data-isolation issue: `storage.js` keeps a
   localStorage cache of the signed-in student's cloud rows (subjects, tasks,
   notes, attendance, grades, GWA rows, calendar events, syllabus, semesters).
   `AuthService.signOut()` only called `supabase.auth.signOut()` — it never
   cleared that cache. On a shared/public browser, a second student signing in
   after the first signed out would briefly (or, if the next cloud sync failed,
   indefinitely) see the first student's cached planner data rendered by the
   UI. Fixed:
   - Added `DB.clearPrivateCacheOnSignOut()` (clears every planner data key,
     deliberately leaves the device-level theme/accent preference alone) and
     call it from `AuthService.signOut()` — the single sign-out path used by
     every "Log out" button in the app.
   - Added a defense-in-depth check in `cloud-sync.js`'s `hydrate()`: it now
     records the last-synced `user.id` in localStorage and wipes the cache if
     the current session's user id differs, so even a session swap that didn't
     go through the sign-out button (stale tab, token refreshed as a different
     account, etc.) can't render stale data from a previous user.

## Preserved / explicitly not changed

- Admin policies (`*_admin_write`), shared reference-data read policies
  (`curriculum_courses_read`, `university_*_read`, `student_services_read`),
  and the messaging/support-ticket policies — untouched.
- No tables dropped, no data reset, no unrelated functionality changed.
- AI Quiz Maker, AI Flashcard Maker, AI Study Assistant — not touched.

## Testing

**I did not have network or database access in this environment** (sandboxed,
no outbound connectivity, no Supabase credentials), so **no live test against
real accounts was performed**, and I am not claiming otherwise. What follows is
a concrete test plan for a human (or CI with real credentials) to run before
trusting this migration, using two real student accounts, A and B:

1. Sign in as A, create one record in each migrated table (a subject, a task, a
   calendar event, a note, an attendance entry, a grade with a component and an
   assessment, a GWA row, a syllabus course+week). Confirm each appears.
2. Sign in as B (same browser, after signing out of A) and confirm:
   a. None of A's records appear anywhere in B's UI (Subjects, Schedule,
      Calendar, Tasks, Notes, Attendance, Grades/GWA, Syllabus) — validates
      finding #5's fix as well as RLS isolation.
   b. Using the browser devtools console with B's own session, run e.g.
      `await (await getSupabase()).from('tasks').select('*')` and confirm only
      B's own tasks come back, never A's — validates RLS independent of the
      frontend's own filtering.
3. Still as B, attempt a direct cross-user write to confirm the new FK guard,
   e.g.:
   `await (await getSupabase()).from('tasks').insert({ id: crypto.randomUUID(), user_id: (await (await getSupabase()).auth.getSession()).data.session.user.id, title: 'x', subject_id: '<A\'s real subject id>' })`
   — expect this to fail with the `security: subject_id ... does not belong to
   this user` exception from `tasks_guard_fk`, not silently succeed.
4. As B, attempt `update profiles set role = 'admin' where id = auth.uid()`
   (via the client) — expect the row to be writable but `role` to remain
   unchanged (the existing `profiles_guard_privileged_columns` trigger).
5. Re-run step 3's style of probe against `notes`, `attendance`, `grades`, and
   `syllabus_courses` with a foreign key borrowed from A, to cover each new
   trigger.

## Remaining risks / out of scope

- The test plan above has not been executed against a live project; the
  migration should be treated as **reviewed but not yet verified live**.
- `grade_components`/`grade_assessments`/`task_checklist_items` rely entirely
  on their parent row's RLS join rather than an independent ownership column —
  correct, but means their protection is only as good as the parent table's
  policy; no issue found, just worth knowing for future changes.
- `semesters` rows created as the FK placeholder for `grades`/`syllabus_courses`
  (see the earlier migration) are real per-user rows protected by
  `semesters_own`; they are not a new exposure, just noted for completeness.
- Full relational normalization of Syllabus (`syllabus_weeks`/`syllabus_topics`)
  remains future work, as already noted in migration 0015.
- This audit did not re-review the AI Quiz/Flashcard/Study Assistant features,
  admin email/announcements, or support-ticket flows beyond confirming their
  policies were left untouched — out of scope per the task.

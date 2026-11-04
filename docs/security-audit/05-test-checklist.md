# Security Test Checklist

Legend: **[CODE]** = verified by reading code/policies in this audit. **[MANUAL]** = cannot be verified without a live DB + two real accounts + a browser; must be run by a human against the live project.

## Per-student table isolation (tasks/schedule/calendar/subjects/grades/attendance/syllabus/notes/GWA/pomodoro/push subscriptions)

| # | Test | Status |
|---|---|---|
| 1 | Student A can SELECT/INSERT/UPDATE/DELETE their own rows | [CODE] policy allows it (`user_id = auth.uid() AND is_approved()`) — **[MANUAL]** to confirm end-to-end once the frontend actually calls Supabase for these tables (see finding #6 in `03-vulnerabilities-and-fixes.md`) |
| 2 | Student A cannot SELECT Student B's row (by id or listing) | [CODE] `USING` clause excludes it |
| 3 | Student A cannot UPDATE Student B's row | [CODE] `USING` clause excludes it from being targeted at all |
| 4 | Student A cannot DELETE Student B's row | [CODE] `USING` clause excludes it |
| 5 | Student A cannot INSERT a row with `user_id` set to Student B | [CODE] `WITH CHECK` requires `user_id = auth.uid()` |
| 6 | Student A cannot UPDATE their own row to reassign `user_id` to Student B | [CODE] `WITH CHECK` re-validates the new row, same requirement |
| 7 | Same isolation for `task_checklist_items` / `grade_components` / `grade_assessments` / `syllabus_weeks` / `syllabus_topics` via parent join | [CODE] per supplied schema summary — **[MANUAL]** recommended re-check of literal policy SQL (see note in `03-vulnerabilities-and-fixes.md`) |
| 8 | Unauthenticated (no session / anon-only) request cannot read any row | [CODE] `is_approved()` requires an authenticated, approved profile; `auth.uid()` is null for anon, so `user_id = auth.uid()` can never match |
| 9 | A pending/rejected/suspended account cannot read or write their own planner rows | [CODE] `is_approved()` gate in every policy requires `account_status = 'approved'` |

## Shared reference data

| # | Test | Status |
|---|---|---|
| 10 | Any approved student can still read `university_events`, `university_resources`, `curriculum_courses`, `university_directory`, `student_services` | [CODE] unchanged, policies not touched |
| 11 | Students cannot write to those shared tables | [CODE] unchanged, admin-write-only policies not touched |

## Account/role security

| # | Test | Status |
|---|---|---|
| 12 | Student cannot call `set_account_status()` to approve themselves or anyone | [CODE] function raises on `not is_admin()` |
| 13 | Student cannot call the `admin-delete-account` Edge Function on any account | [CODE] Edge Function independently re-checks `role='admin' AND account_status='approved'` via its own service-role lookup before acting |
| 14 | **Student cannot `UPDATE profiles SET role='admin'` (or `account_status='approved'`) on their own row via a raw `.update()` call** | [CODE, before fix] gap confirmed — RLS alone did not block this. **[CODE, after fix]** blocked by the new `trg_profiles_guard_privileged_columns` trigger once migration `0013` is applied. **[MANUAL]** required to confirm against the live DB after applying the migration — e.g. sign in as a non-admin student in the browser console and run `await supabase.from('profiles').update({ role: 'admin' }).eq('id', (await supabase.auth.getUser()).data.user.id)`, then re-select the row and confirm `role` is still `'student'`. |
| 15 | Student cannot submit a support ticket or message as a different `student_id` | [CODE] `submit_support_report()` always stamps `auth.uid()` server-side |
| 16 | Student cannot read another student's inbox message or support ticket | [CODE] policies scope to `student_id = auth.uid()` |

## Session / logout hygiene

| # | Test | Status |
|---|---|---|
| 17 | Logging out and logging in as a different student does not show stale data from the previous session | **[MANUAL]** — requires a browser. Note: for the eight localStorage-backed planner features this is actually a *real risk today*, independent of RLS — `localStorage` is shared per browser/profile, not per logged-in user, so switching accounts on the same browser can currently surface the previous student's locally-cached planner data. This is not an RLS gap (RLS doesn't apply to data that never left `localStorage`) and is flagged as a manual/product follow-up in `06-manual-steps-remaining.md` rather than fixed here, since fixing it means wiring these features to Supabase, which is outside "minimal, surgical, don't rewrite the frontend." |
| 18 | Admin dashboards/approve/reject/suspend/restore flows still work | [CODE] no admin RPC or policy was changed by migration 0013; only non-admin column writes are affected |
| 19 | Existing auth flows (login, registration, email verification, password recovery, Google OAuth finish-profile) still work | [CODE] migration 0013 does not touch `handle_new_user()`, `submit_profile_details()`, or any auth-related policy |

## What "verified" means here

Every [CODE] row above is based on reading the actual policy definitions supplied in the live-schema dump, the migration files, and the relevant SECURITY DEFINER function bodies — not assumption. Rows marked [MANUAL] genuinely require a live database and, for several, two real distinguishable accounts (one approved student "A", one approved student "B", and for #12–14 a non-admin account specifically) plus a browser session; we have neither in this environment and are not claiming these are verified.

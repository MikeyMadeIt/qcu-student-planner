# Manual Steps Remaining

## 1. Apply the new migration (required for the one real vulnerability found)

Run `supabase/migrations/0013_lock_profiles_privileged_columns.sql` in the Supabase SQL Editor (or `supabase db push`). See `04-migration-instructions.md`. Without this, an approved student can self-promote `role`/`account_status` via a hand-crafted API call (no UI currently does this, but RLS alone did not block it).

## 2. Run the [MANUAL] rows in `05-test-checklist.md` against the live project with two real student accounts

In particular test #14 (role self-escalation, before and after applying 0013) and #1/#7 (end-to-end CRUD + isolation for the planner tables) once the frontend actually talks to them — see item 3 below.

## 3. Decide what to do about the planner features not using the database (bigger than this audit's scope, flagged for visibility)

Tasks, Schedule, Calendar, Subjects, Grades/GWA, Attendance, Syllabus, and Notes currently store all data in `localStorage` via `assets/js/data/storage.js` — none of them call Supabase. Consequences:

- The live database's RLS on these tables (which is correctly designed — see `02-policy-changes.md`) is not currently protecting any real traffic from this app, because the app doesn't send it any.
- Data does not sync across devices/browsers for a student.
- Logging out and logging back in as a different student on the same browser can surface the previous student's cached planner data (checklist item #17) — this is a `localStorage` hygiene issue, not an RLS one.
- "Student data isolation enforced by RLS" for these eight features, as asked for in the task, cannot be fully true today in the sense of "the database is the enforcement point," because the database isn't in the data path yet.

This was explicitly out of scope to fix here: the task says not to rewrite the frontend and not to add new features, and wiring eight feature modules to Supabase (replacing their `storage.js` calls with `supabase.from(...)` calls, each scoped to `auth.uid()`) is a substantial frontend engineering effort, not a surgical RLS fix. We're flagging it rather than silently working around it or pretending the audit covers data these features don't actually store in the database. If/when that wiring work happens, the RLS policies already in place for these tables (per `01-tables-audited.md`) should need no further changes — they already follow the correct `user_id = auth.uid()` ownership pattern.

## 4. Correct `supabase/SECURITY_VALIDATION.md` test #3's explanation

Its current wording implies `profiles_update_own`'s RLS alone already prevents a student from writing `account_status`/`role`. That's not accurate at the database level (see `03-vulnerabilities-and-fixes.md`, item 1) — it was only true because no frontend code happens to send those fields. Once migration 0013 is applied, update that doc to credit the trigger, not the RLS policy alone, for closing that path.

## 5. Optional hardening (not required, not applied)

Running the `pg_policies` query in `03-vulnerabilities-and-fixes.md` to get the literal text of the pre-migrations base-schema policies (especially the child-table joins for `task_checklist_items`/`grade_components`/`grade_assessments`/`syllabus_weeks`/`syllabus_topics` and `profiles_update_own` itself) would let a future audit verify those by direct inspection instead of relying on the supplied summary.

# Security Audit — QCU Student Planner (non-AI features)

Scope per the task: Tasks, Schedule, Calendar, Subjects, Grades/GWA, Attendance, Syllabus, Notes, Resources, curriculum-related personal records, and any other student-owned data — explicitly excluding AI Quiz Maker, AI Flashcard Maker, and AI Study Assistant (untouched).

## Bottom line

1. **The live database's RLS design for per-student data is already correct and mature.** All 17 per-student tables already use the right ownership pattern (`user_id = auth.uid() AND is_approved()` on `USING` **and** `WITH CHECK`, for all of SELECT/INSERT/UPDATE/DELETE). This already blocks reading/writing another student's rows, inserting-as-another-user, and reassigning ownership via update. No policy changes were needed or made to these tables.
2. **One real vulnerability was found and fixed:** a column-level gap in the `profiles` table. RLS's `WITH CHECK` validates a whole row, not individual columns, so the existing `profiles_update_own` policy did not actually stop an approved student from writing `role = 'admin'` or `account_status = 'approved'` on their own row via a direct API call — only the fact that no frontend code sends those fields kept this from being exploitable through the UI. Fixed with a new `BEFORE UPDATE` trigger (migration `0013_lock_profiles_privileged_columns.sql`) that reverts such changes unless the acting session is an admin. **This migration has not been applied to production — you must run it yourself (see below).**
3. **A significant scope finding, not a vulnerability in the RLS design itself:** the eight in-scope planner features (Tasks, Schedule, Calendar, Subjects, Grades/GWA, Attendance, Syllabus, Notes) have **no Supabase calls anywhere in their frontend code**. They read and write exclusively through `assets/js/data/storage.js`, a `localStorage`-only layer. Only auth, profiles, admin, messaging, support tickets, and the shared reference data (`curriculum.js`) actually talk to the database. This means the database's correctly-designed RLS isn't currently protecting these features' data — because that data never reaches the database. We did not rewrite this (out of scope: no frontend rewrites, no new features, minimal surgical changes), but it's the most important thing to understand about the current state of "student data isolation" in this app. See `06-manual-steps-remaining.md` item 3.

## What was audited

17 per-student tables, 5 shared/admin-managed tables, `profiles`, `admin_audit_log`, the messaging/support-ticket tables, every SECURITY DEFINER function, the `admin-delete-account` Edge Function, and the full non-AI frontend JS. Full list: `01-tables-audited.md`.

## What changed

One new file: `supabase/migrations/0013_lock_profiles_privileged_columns.sql`. Nothing else in `supabase/migrations/` or any existing policy was modified. Details: `02-policy-changes.md`.

## Vulnerabilities found

Exactly one (the `profiles` column-level gap above). Everything else checked — ownership reassignment, child-table joins, SECURITY DEFINER input validation, service-role key exposure — came back secure, no fix needed. Full detail and reasoning: `03-vulnerabilities-and-fixes.md`.

## Applying the fix

See `04-migration-instructions.md`. Short version: copy `supabase/migrations/0013_lock_profiles_privileged_columns.sql` into the Supabase SQL Editor and run it, or `supabase db push`. It is idempotent and non-destructive.

## Testing

Full checklist with [CODE]-verified vs [MANUAL]-required rows: `05-test-checklist.md`. We have no live database or browser access in this environment, so anything requiring a real session with two distinguishable accounts is marked [MANUAL] and was not actually executed.

## What's left for you to do

1. Apply migration `0013` in the Supabase SQL Editor — this is the one real security fix from this audit and is not live yet.
2. Run the [MANUAL] checklist items with real accounts, especially the `profiles` self-escalation test before/after applying the migration.
3. Decide how/when to wire the eight planner features to Supabase instead of `localStorage` — this is the biggest open item and was intentionally left alone as out of scope for a "minimal, surgical RLS audit," not because it doesn't matter.

Full detail: `06-manual-steps-remaining.md`.

## No secrets found

`assets/js/core/config.js` contains only the public anon key, which is safe and intended to be public under RLS. No service-role key or other secret was found anywhere in the repository; nothing needed to be redacted from the packaged zip.

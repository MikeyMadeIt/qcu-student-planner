# Policy Changes

## Summary

**One** real gap was found and fixed. Everything else in the per-student RLS layer was already correct and required **no changes**.

## What was NOT changed (already correct)

All 17 per-student tables (`user_settings`, `semesters`, `subjects`, `tasks`/`task_checklist_items`, `notes`, `calendar_events`, `pomodoro_stats`, `attendance`, `grades`/`grade_components`/`grade_assessments`, `gwa_calculator`, `syllabus_courses`/`syllabus_weeks`/`syllabus_topics`, `push_subscriptions`) already use `command = ALL` policies with:

```
USING ( (user_id = auth.uid()) AND is_approved() )
WITH CHECK ( (user_id = auth.uid()) AND is_approved() )
```

(or, for the three nested/child tables per table group, the equivalent via a join to the parent's `user_id`). Because `WITH CHECK` is evaluated against the *new* row on both INSERT and UPDATE:

- A student cannot `INSERT` a row with someone else's `user_id` (WITH CHECK fails: new row's `user_id != auth.uid()`).
- A student cannot `UPDATE` a row to reassign it to another `user_id` (same reason — the new row after the update must still satisfy `user_id = auth.uid()`).
- A student cannot read/update/delete another student's row at all (`USING` fails before the row is even visible).

This is the correct, standard pattern for owner-isolated tables and no fix was needed here. No new migration touches these tables or their policies.

Shared/admin-managed tables (`university_events`, `university_resources`, `curriculum_courses`, `university_directory`, `student_services`) correctly have **no** `user_id` column and were correctly left alone — adding one would have been wrong per the task's own instructions.

`admin_messages`/`admin_message_recipients`/`support_tickets`/`support_ticket_notes`: insert paths go only through SECURITY DEFINER RPCs (`admin_send_message()`, `submit_support_report()`), which re-derive the audience/author server-side; there is no direct student-insert policy on these tables. Verified via `0008_messaging_and_support_tickets.sql` and `supabase/README.md`. No change needed.

`admin_audit_log`: select-only policy for admins, no authenticated insert/update/delete policy. The only writer is `set_account_status()` (`0002_admin_audit_log.sql`), a `SECURITY DEFINER` function owned by a role that is not subject to the missing insert policy (SECURITY DEFINER functions run with the privileges of their owning role, and RLS only restricts what the *invoking* session can do directly against the table — not what a SECURITY DEFINER function running as table owner can do internally). This is the standard, intended pattern and matches comments in `0002_admin_audit_log.sql` itself. No change needed.

## What WAS changed

### `profiles` — new BEFORE UPDATE trigger (migration `0013_lock_profiles_privileged_columns.sql`)

**Added:** `public.profiles_guard_privileged_columns()` function + `trg_profiles_guard_privileged_columns` trigger on `public.profiles`.

**Not removed or altered:** the existing `profiles_update_own` RLS policy itself is left exactly as-is — this is an additive, defense-in-depth fix, not a policy rewrite.

See `03-vulnerabilities-and-fixes.md` for the full rationale and `04-migration-instructions.md` for how to apply it.

## Not a policy change, but worth recording

No RLS/policy change can fix the fact that the eight in-scope planner features' frontend currently never reaches the database at all (it uses `localStorage`). That is a frontend wiring issue, not an RLS issue, and is documented separately in the README and `06-manual-steps-remaining.md` rather than "fixed" here, per the instruction not to rewrite the frontend or invent new scope.

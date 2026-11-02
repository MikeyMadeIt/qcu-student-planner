# Vulnerabilities Identified and Fixes

Honesty note: this project's RLS layer is genuinely mature. We are not padding this list — most things checked came back "secure, no change needed" and are recorded as such.

## 1. (Fixed) `profiles` table — column-level privilege escalation gap

**Severity:** High (if ever exploited; currently unreachable via the UI).

**What we checked:** whether `profiles_update_own`'s `WITH CHECK` (`id = auth.uid() AND is_approved()`) actually prevents an approved student from changing their own `role` or `account_status` via a direct `.update()` call.

**Finding:** It does not. PostgreSQL RLS policies validate the *entire new row* against a boolean expression — they have no concept of "this column may not change." A boolean expression of `id = auth.uid() AND is_approved()` is satisfied by `update profiles set role = 'admin' where id = auth.uid()` just as much as by `update profiles set full_name = 'x' where id = auth.uid()`, because the row still belongs to the caller and the caller is still approved. `supabase/SECURITY_VALIDATION.md` (test #3) currently asserts this is already blocked, which is **not accurate** as a statement about the database layer — it only reflects that no *frontend* code sends those fields.

**Why this didn't show up as an exploited bug:** no frontend code anywhere in this repo sends `role`/`account_status` on a student-facing `.update()` call (only `admin-service.js`, going through admin-gated RPCs, ever writes them). So in normal use the gap is never triggered. But RLS is supposed to be the actual security boundary regardless of what the UI does — a hand-crafted request using the public anon key plus a logged-in student's own JWT (e.g. via `curl` or the browser devtools console) would, as the policy stood, succeed in self-promoting to `role = 'admin'` or `account_status = 'approved'`/`'suspended'` etc.

**Fix:** `supabase/migrations/0013_lock_profiles_privileged_columns.sql` adds a `BEFORE UPDATE` trigger (`profiles_guard_privileged_columns`) that silently reverts any attempted change to `role`/`account_status` on a row unless the acting session is `is_admin()`. This is additive defense-in-depth alongside the existing RLS policy, not a replacement for it, and does not touch:
- `set_account_status()` — already `is_admin()`-gated before it touches the row, so the trigger is a no-op for it (it's already an admin acting).
- `submit_profile_details()` — never touches `role`/`account_status`, so the trigger never fires for it.
- Any admin UI flow — admins pass the trigger's `is_admin()` check and proceed normally.

**Needs manual action:** yes — this SQL file must be run in the Supabase SQL Editor (or via `supabase db push`). It was not applied automatically; we do not have live database access. See `04-migration-instructions.md`.

**Also recommended (manual, not scripted here):** correct the misleading claim in `supabase/SECURITY_VALIDATION.md` test #3 once the trigger is live, so future readers don't rely on an RLS-only explanation that was never quite true.

## 2. (No vulnerability found) Ownership reassignment / cross-student writes on owned tables

Checked every per-student table's `WITH CHECK` clause for both INSERT and UPDATE. All use the `user_id = auth.uid()` pattern, which blocks both inserting-as-another-user and reassigning an existing row's `user_id`. No fix needed.

## 3. (No vulnerability found) Child-table ownership (`task_checklist_items`, `grade_components`, `grade_assessments`, `syllabus_weeks`, `syllabus_topics`)

These have no direct `user_id`; ownership is enforced via a join back to the parent's `user_id` in the policy's `USING`/`WITH CHECK`. Per the schema dump, this join is present on both read and write sides (not only `USING`), so a student cannot insert a checklist item under someone else's task, a grade component under someone else's grade, etc. — the parent-ownership join is also checked on `WITH CHECK`, not only `USING`. No fix needed. (We could not read the literal policy SQL text for these — it predates the migrations folder — so this is based on the supplied live-schema summary; see "Needs manual verification" below for a concrete re-check.)

## 4. (No vulnerability found) SECURITY DEFINER functions

`set_account_status()`, `admin_delete_rejected_account()`, `admin_send_message()`, `set_message_read_status()`, `submit_support_report()`, `handle_new_user()` were read in full. Each one that performs a privileged action re-checks `is_admin()` server-side rather than trusting a client-supplied flag, and functions that stamp an owner id (`submit_support_report()`, `handle_new_user()`) always use `auth.uid()` internally, never a client-supplied id. No fix needed.

## 5. (No vulnerability found) Service-role key exposure

`assets/js/core/config.js` contains only the public anon key (expected and safe — it only works through RLS). The only use of a service-role-equivalent key is inside `supabase/functions/admin-delete-account`, which is server-side Edge Function code, reads the key from an environment secret (not a literal), and independently re-verifies the caller is an approved admin before using it. No fix needed, no secret found to redact.

## 6. (Scope/architecture finding, not an RLS vulnerability) Planner features are not wired to the database at all

This is not a vulnerability *of the RLS/auth design* — it's a finding about what the RLS design is actually protecting today. See the README and `06-manual-steps-remaining.md`. In short: Tasks, Schedule, Calendar, Subjects, Grades/GWA, Attendance, Syllabus, and Notes all read/write exclusively through `assets/js/data/storage.js` (`localStorage`), never through Supabase. The live database's per-student RLS on these tables is correctly designed, but currently has no traffic from this frontend to protect, because the frontend doesn't use it. We did not rewrite this (out of the stated scope: "don't needlessly rewrite frontend," "don't add new tables/features," minimal surgical changes), but it needs to be flagged loudly rather than silently audited around.

## Needs manual verification (we could not confirm from code alone)

- The exact literal SQL text of the base-schema policies for `task_checklist_items`, `grade_components`, `grade_assessments`, `syllabus_weeks`, `syllabus_topics`, and `profiles_update_own` itself — these predate `supabase/migrations/` and were not in any file we could read; our analysis of them is based on the live-schema/RLS summary provided for this audit, not a direct `pg_policies` read. Recommend running, in the Supabase SQL Editor:
  ```sql
  select schemaname, tablename, policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname;
  ```
  and diffing against the summary above.

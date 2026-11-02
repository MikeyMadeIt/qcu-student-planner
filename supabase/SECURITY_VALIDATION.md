# Phase 3 — security validation checklist

How to verify each requirement, and where the enforcement actually lives
(never just the UI — the UI only avoids showing an admin an action the
database will refuse anyway).

| # | Scenario | How to test | Where it's actually enforced |
|---|----------|-------------|-------------------------------|
| 1 | Unauthorized deletion attempt | As a signed-in **student**, call `supabase.functions.invoke('admin-delete-account', { body: { target_user_id: '<any uuid>' } })` from the browser console. | Edge Function re-checks `profiles.role = 'admin' AND account_status = 'approved'` via the service-role client before doing anything (step 2 in the flow). Even if that check were skipped, `admin_delete_rejected_account()` independently raises `42501` from `is_admin()`. Expect HTTP 403. |
| 2 | Unauthorized approval attempt | As a student, call `supabase.rpc('set_account_status', { target_user_id: '<any uuid>', new_status: 'approved' })`. | `set_account_status()` (`0002_admin_audit_log.sql`) raises `42501` via `is_admin()`. RLS on `profiles` also has no student-writable path to `account_status` at all (`profiles_update_own`'s `WITH CHECK` still requires `is_approved()`, and does not permit changing `account_status`/`role` — only the RPC path exists). |
| 3 | Student changes their own status | As a student, try `update profiles set account_status = 'approved' where id = auth.uid()` via `supabase.from('profiles').update(...)`. | Direct table writes to `profiles` go through RLS (`profiles_update_own`), not through `set_account_status()`, so this is a plain UPDATE with no special-casing for `account_status`/`role` — but more importantly, verify in the dashboard that no policy or client code ever calls `.update()` with those columns from student-facing pages (`grep -rn "account_status\|role:" assets/js/modules` outside `admin-*`/`admin-service.js` should return nothing). The only legitimate writer of `account_status` is `set_account_status()`, SECURITY DEFINER, `is_admin()`-gated. |
| 4 | Student changes their own role | Same as above for `role = 'admin'`. | Same answer: no RLS policy or RPC grants `authenticated` the ability to set `role`. `handle_new_user()` always inserts `role = 'student'` server-side at signup; nothing in the app ever lets a client set `role` directly. |
| 5 | Access to another student's records | As student A, query `supabase.from('tasks').select('*').eq('user_id', '<student B uuid>')` (or any other per-user table). | Every per-user table's RLS policy (`tasks_own`, `notes_own`, `subjects_own`, etc.) filters on `user_id = auth.uid()` — the query above returns zero rows, not an error, regardless of the `.eq()` filter, because RLS is enforced at the row level before the filter is even relevant. |
| 6 | Failure during a privileged operation | Temporarily rename `admin_delete_rejected_account` (or call the Edge Function with a `target_user_id` for a profile whose `account_status` is `'approved'`, not `'rejected'`). | Edge Function returns the exact failure (HTTP 409 "Only rejected accounts can be permanently deleted…", or 500 naming the missing function) — see `admin-delete-account/index.ts`. Nothing is marked deleted in the UI unless the function returns `200 { ok: true }`. If the DB cleanup succeeds but `auth.admin.deleteUser()` fails, the function logs `account_deletion_auth_step_failed` and returns a 500 explaining exactly that — it does not report success. |
| 7 | Related-record cleanup | Create planner data for a test account (a subject, a task with a checklist item, a grade with components/assessments, a syllabus course/week/topic, a note, a calendar event, attendance, pomodoro stats, a semester), reject the account, then delete it permanently. Afterward, query each table `where user_id = '<deleted id>'` (or the equivalent child FK) as an admin/service-role. | `admin_delete_rejected_account()` deletes, in dependency order, every table listed in `0006_account_permanent_deletion.sql` — all scoped to `user_id = target_user_id` (or transitively, via the owning row's `user_id`), never unscoped. Confirm a **different** student's otherwise-identical data (e.g. another `task_checklist_items` row under a different `task_id`) is untouched. |
| 8 | Audit logging | After any `set_account_status()` call or a permanent deletion, query `supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(5)` as an admin. | Every status change and deletion writes exactly one row inside the same transaction as the change itself (not a separate, skippable step) — see `set_account_status()` and `admin_delete_rejected_account()`. `admin_audit_log` has no `INSERT`/`UPDATE`/`DELETE` policy for `authenticated` at all (`0002_admin_audit_log.sql`), so a client can never fabricate, edit, or erase an entry — only the SECURITY DEFINER functions (running as the table owner) can write to it. |

## Manual smoke test for the full deletion flow

1. Sign up a throwaway test account, let it sit `pending`.
2. As an admin, reject it (`pages/admin/verification.html` → Reject, with a
   reason) — confirm it now appears on **Rejected Accounts**
   (`pages/admin/rejected.html`) and an `account_status_change` row appears in
   **Activity Log**.
3. Create some planner rows for that test user directly (as that user, or via
   the SQL editor) across a few tables (a subject, a task + checklist item, a
   note) so there's something to verify gets cleaned up.
4. On **Rejected Accounts**, click the trash icon → type `DELETE` → confirm.
5. Expect: a success toast, the row disappears from the list, the account can
   no longer sign in, `profiles`/`tasks`/`task_checklist_items`/`notes` rows
   for that id are gone, and **Activity Log** shows
   `account_permanently_deleted` (with the reviewer, the previous status, and
   a `target_email`/`target_full_name` snapshot) followed by
   `account_permanently_deleted_auth_completed`.
6. Try clicking delete again on a row for an account that is not `rejected`
   (there shouldn't be one in the UI — confirm this by calling the Edge
   Function directly with an `approved` account's id) and confirm it is
   refused with a clear 409, not a silent no-op or a false success.

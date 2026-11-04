# Database Migration Report — QCU Student Planner

> **Final QA pass note (re-verification):** This report was re-checked
> during the final QA audit. Confirmed by direct inspection in this pass:
> the migration sequence on disk is contiguous `0001`–`0018` with no gaps
> or duplicate numbers; `0018_add_missing_indexes.sql` exists, is
> purely additive (`CREATE INDEX IF NOT EXISTS`, no DDL that touches RLS,
> grants, or existing columns), and its stated rationale (unindexed
> `admin_audit_log.created_at`/`actor_id`/`target_user_id` behind
> `listAuditLog()`'s `order()`/`range()`/FK-embed query in
> `assets/js/services/admin-service.js`) matches the actual query in that
> file. Every table name queried from `assets/js/` (`.from('...')`) is
> referenced in at least one migration file, consistent with §3 below.
> The content from here down is the substantive migration audit carried
> forward unchanged from the database cleanup pass, since re-reading every
> migration line-by-line reached the same conclusions.

**Scope:** static analysis of `supabase/migrations/0001`–`0017` (plus the corrective `0018` added here), `supabase/functions/admin-delete-account/index.ts`, `supabase/README.md`, `supabase/SECURITY_VALIDATION.md`, `docs/security-audit/*.md`, and the frontend's `.from()/.rpc()` calls under `assets/js/`.

**Critical limitation, stated up front and repeated below: no live Supabase/Postgres instance was connected to at any point. Everything here is static reading of the files in this repo. Nothing in this report should be read as "the live database currently has state X" — only as "the committed migration files, read in order, imply state X."**

---

## 1. Authoritative migration sequence

| # | File | One-line description |
|---|---|---|
| 0001 | `0001_submit_profile_details.sql` | **Dead/never-applied.** Defines `submit_profile_details()` referencing a `student_number` column that doesn't exist on `profiles` — the `CREATE FUNCTION` fails at creation time in Postgres (column refs in a plpgsql body are validated eagerly), so this file never actually created anything live. Left in place (not deleted) per migration-history rules; superseded by 0005. |
| 0002 | `0002_admin_audit_log.sql` | Creates `admin_audit_log` (append-only, RLS SELECT-only for admins), and `set_account_status()` (admin-gated status change + audit write). Marked in its own header as already applied manually via the SQL editor. |
| 0003 | `0003_handle_new_user.sql` | `handle_new_user()` trigger on `auth.users` insert, creates the pending `profiles` row from signup metadata. |
| 0004 | `0004_profile_email_and_google_oauth.sql` | Adds `profiles.email`, `profiles.signup_provider`; backfills email; extends `handle_new_user()`; adds `handle_user_email_update()` trigger to keep email in sync. |
| 0005 | `0005_fix_submit_profile_details.sql` | Correctly recreates `submit_profile_details()` without the bogus `student_number` parameter. This is the version actually in effect. |
| 0006 | `0006_account_permanent_deletion.sql` | Redeclares `is_admin()`/`is_approved()` defensively (documented as already-live, redeclared for disaster-recovery rebuildability). Relaxes `admin_audit_log.target_user_id` FK to `ON DELETE SET NULL`, adds `target_email`/`target_full_name` snapshot columns. Adds `admin_delete_rejected_account()` — admin-gated, rejects non-`'rejected'` targets, cascades deletes across every planner table by `user_id`, writes one audit row, deletes the profile. Does **not** touch `auth.users` (left to the Edge Function). |
| 0007 | `0007_grant_service_role_privileges.sql` | Restores missing base table/sequence/function `GRANT`s to `service_role` (diagnosed from a live 42501 error) and adds `ALTER DEFAULT PRIVILEGES` so future tables auto-grant to `service_role`. |
| 0008 | `0008_messaging_and_support_tickets.sql` | Creates `admin_messages`/`admin_message_recipients` (one-way admin→student inbox) and `support_tickets`/`support_ticket_notes` (student Report tab). RLS SELECT policies only; all writes go through SECURITY DEFINER functions: `admin_send_message()`, `admin_archive_message()`, `set_message_read_status()`, `submit_support_report()`, `admin_set_ticket_status()`, `admin_add_ticket_note()`. |
| 0009 | `0009_grant_messaging_tickets_privileges.sql` | Restores the missing base `GRANT` to `authenticated` on the four 0008 tables (same 42501-class bug as 0007, this time for `authenticated`). |
| 0010 | `0010_fix_inbox_rls_and_report_ambiguity.sql` | Fixes an ambiguous-column bug in `admin_messages_select` (bare `id` resolved to the subquery's own `id`, not the outer table's) and a `variable_conflict` ambiguity in `submit_support_report()` (RETURNS TABLE column `id` colliding with a `profiles.id` reference). Both are real correctness bugs in 0008, fixed forward-only here rather than by editing 0008. |
| 0011 | `0011_fix_audit_log_actor_relationship.sql` | Adds a second FK from `admin_audit_log.actor_id` straight to `public.profiles(id)` (it only had one to `auth.users(id)` from 0002) so PostgREST can resolve the `actor:actor_id(full_name)` embed the admin UI uses. |
| 0012 | `0012_grant_audit_log_privileges.sql` | Restores the missing base `GRANT SELECT` to `authenticated` on `admin_audit_log` (same 42501-class bug, third occurrence). |
| 0013 | `0013_lock_profiles_privileged_columns.sql` | **Security fix.** Adds a `BEFORE UPDATE` trigger (`profiles_guard_privileged_columns`) that silently reverts any change to `profiles.role`/`profiles.account_status` unless the acting session is `is_admin()`. Closes a real RLS gap: `profiles_update_own`'s `WITH CHECK` only verifies row ownership + approval, not which columns changed, so a hand-crafted request could otherwise self-promote to admin. |
| 0014 | `0014_planner_cloud_migration_columns.sql` | Adds `subjects.online`, `tasks.time_estimate_min` (+ check constraint); adds `idx_subjects_user_id`, `idx_tasks_user_id`, `idx_calendar_events_user_id`, `idx_task_checklist_items_task_id`; adds `touch_updated_at()` trigger function and wires it to `subjects`/`tasks`/`calendar_events`. This is the migration that actually enables the cloud-sync feature (see §4 — the existing `docs/security-audit` predates this and is stale on this point). |
| 0015 | `0015_syllabus_jsonb_and_grade_touch.sql` | Adds `syllabus_courses.data jsonb` (stores the full nested course/week/topic record as-is; `syllabus_weeks`/`syllabus_topics` are deliberately left unused by the client). Wires `touch_updated_at()` to `notes`/`attendance`/`grades`/`grade_components`/`grade_assessments`/`gwa_calculator`/`syllabus_courses`. Adds the matching per-user/per-FK indexes. |
| 0016 | `0016_security_audit_data_isolation.sql` | **Security fix.** Force-enables RLS (idempotent) on 27 tables as a guarantee rather than an assumption, since the base schema predates this migrations folder and RLS-on was never provable from the repo alone. Adds `assert_owned_fk()` + per-table `BEFORE INSERT OR UPDATE` triggers (`tasks_guard_fk`, `notes_guard_fk`, `attendance_guard_fk`, `calendar_events_guard_fk`, `subjects_guard_fk`, `grades_guard_fk`, `gwa_calculator_guard_fk`, `syllabus_courses_guard_fk`) that re-verify every foreign key on a row actually belongs to that row's own `user_id` — closing a cross-tenant **write** path (e.g. filing a task under another student's `subject_id`) that plain `user_id = auth.uid()` RLS does not catch. |
| 0017 | `0017_authenticated_default_privileges.sql` | Closes the recurring missing-GRANT bug class (hit three times: 0009, 0012, and implicitly 0007 for `service_role`) at its root for `authenticated`, via `ALTER DEFAULT PRIVILEGES`, so any *future* table automatically gets the grant. |
| **0018** | **`0018_add_missing_indexes.sql` (added by this audit)** | **Corrective, new.** Adds `idx_admin_audit_log_created_at`, `idx_admin_audit_log_actor_id`, `idx_admin_audit_log_target_user_id`. See §2. |

### Why only one corrective migration was added

The migration history is unusually disciplined for a project of this size — every bug found in a prior migration (0001, 0008's two bugs, the 0007/0009/0012/0017 grant-omission class) was already fixed with its own forward-only follow-up migration by the original author(s), never by silently editing the broken file. I looked specifically for: duplicate/conflicting grants (found and already fixed, see above), SECURITY DEFINER functions missing a pinned `search_path` (checked all 27 occurrences of `security definer` across the 17 files — every one has `set search_path to ''` or `set search_path = ...`; the one function without a pin, `touch_updated_at()` in 0014, is plain `SECURITY INVOKER`, not DEFINER, so it carries no privilege-escalation risk — only noted as a minor hygiene item, not worth a migration), overly-broad grants to `anon` (found none — `anon` is never granted anything beyond what Supabase auto-provisions, and 0006 explicitly comments that `admin_delete_rejected_account` is deliberately not granted to `anon`), and missing indexes on FK/filter columns actually used by the app (found exactly one real gap: `admin_audit_log`, fixed in 0018). I did not find, and did not invent, any other issue meeting the bar ("provably real, verifiable from the files") for a corrective migration.

---

## 2. Corrective migration added: `0018_add_missing_indexes.sql`

**Why:** `public.admin_audit_log` (created 0002) has never had an index beyond its primary key. `assets/js/services/admin-service.js`'s `listAuditLog()` (used by the Admin Activity Log page) runs:

```js
supabase.from('admin_audit_log')
  .select(...)       // embeds actor:actor_id(full_name), target:target_user_id(full_name)
  .order('created_at', { ascending: false })
  .range(from, to)
```

on every page load/pagination step. An `ORDER BY created_at DESC ... OFFSET/LIMIT` with no index on `created_at` forces a full sort of the (append-only, ever-growing) table on every request, and the two embedded foreign-key joins (`actor_id`, `target_user_id` — added in 0002/0006/0011) have no supporting index either. This is a provable gap: the query pattern is a literal grep match in the service file, and the column is a literal, unindexed column in the migration. The fix is purely additive (`CREATE INDEX IF NOT EXISTS`), changes no policy, grant, constraint or function, and is safe to apply to the live database at any time with zero behavior change other than query speed.

I deliberately did **not** add indexes anywhere else — every other FK/filter column the app actually queries (`subjects.user_id`, `tasks.user_id`, `calendar_events.user_id`, `notes.user_id`, `attendance.user_id`, `grades.user_id`, `gwa_calculator.user_id`, `syllabus_courses.user_id`, `task_checklist_items.task_id`, `grade_components.grade_id`, `grade_assessments.component_id`) already has a matching index from 0014/0015, confirmed by cross-referencing every `.eq('user_id', …)` / `.eq('task_id', …)` / `.eq('grade_id', …)` / `.eq('component_id', …)` call in `assets/js/data/cloud-sync.js` against the `create index` statements in those two files.

---

## 3. Security findings (full)

### RLS coverage per table (as defined cumulatively by 0001–0017)

All student-owned tables (`profiles`, `user_settings`, `semesters`, `subjects`, `tasks`, `task_checklist_items`, `notes`, `calendar_events`, `pomodoro_stats`, `attendance`, `grades`, `grade_components`, `grade_assessments`, `gwa_calculator`, `syllabus_courses`, `syllabus_weeks`, `syllabus_topics`, `push_subscriptions`) and every admin/reference/workflow table (`admin_audit_log`, `admin_messages`, `admin_message_recipients`, `support_tickets`, `support_ticket_notes`, `university_events`, `curriculum_courses`, `university_directory`, `student_services`, `university_resources`) have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` force-applied in 0016 (idempotent, so this is true regardless of what state they were in before). `anon` is never granted SELECT/INSERT/UPDATE/DELETE on any of these tables in any migration — only `authenticated` and `service_role` receive table-level grants, and only after RLS/policies gate what those grants actually unlock.

- **Direct per-row ownership tables** (`user_id = auth.uid()` pattern, per `docs/security-audit/01-tables-audited.md`, which I could not re-derive myself since these base policies predate the migrations folder — see "what could not be verified" below): correctly scope SELECT/INSERT/UPDATE/DELETE to the owner, plus `is_approved()` in most cases.
- **Child tables with no `user_id`** (`task_checklist_items`, `grade_components`, `grade_assessments`, `syllabus_weeks`, `syllabus_topics`): ownership enforced via join to the parent's `user_id` in the base policies (per the same source), and, as of 0016, cross-tenant **FK-write spoofing** (pointing an owned row's FK at another student's parent row) is additionally blocked by `assert_owned_fk()` triggers on `tasks`, `notes`, `attendance`, `calendar_events`, `subjects`, `grades`, `gwa_calculator`, `syllabus_courses`.
- **`profiles`**: students can read/update only their own row; 0013's trigger additionally prevents a student from writing their own `role`/`account_status` even on their own row, independent of RLS.
- **`admin_audit_log`**: SELECT-only policy, admin-gated; no insert/update/delete policy for any client role, so writes are only possible through SECURITY DEFINER functions.
- **`admin_messages`/`admin_message_recipients`**: a student can SELECT only messages they are a recipient of (and only non-archived ones); no student insert/update/delete policy at all — every write goes through `admin_send_message()`/`admin_archive_message()`/`set_message_read_status()`.
- **`support_tickets`**: a student can SELECT only their own tickets (or an admin, all); no direct write policy — only `submit_support_report()`, `admin_set_ticket_status()`, `admin_add_ticket_note()`.
- **`support_ticket_notes`**: admin-only SELECT — a student can never read internal notes on their own ticket, by design.

### SECURITY DEFINER functions — `search_path` pin status

Every SECURITY DEFINER function across 0001–0017 (`submit_profile_details`, `set_account_status`, `handle_new_user`, `handle_user_email_update`, `is_approved`, `is_admin`, `admin_delete_rejected_account`, `admin_send_message`, `admin_archive_message`, `set_message_read_status`, `submit_support_report`, `admin_set_ticket_status`, `admin_add_ticket_note`, `profiles_guard_privileged_columns`, `assert_owned_fk`, and the eight `*_guard_fk` trigger functions in 0016) pins `search_path` to `''` or an explicit schema list. **No classic Postgres search_path privilege-escalation gap was found.** The sole exception, `touch_updated_at()` (0014), has no `security definer` clause at all (plain invoker), so an unpinned search_path there carries no elevated-privilege risk — noted as a minor hygiene item only, not acted on.

### Grants review

- `anon`: no table/function grants issued by any migration. Clean.
- `authenticated`: table-level grants restored three separate times after being accidentally omitted when a table was first created (0009 for the 0008 tables, 0012 for `admin_audit_log`), then closed permanently via `ALTER DEFAULT PRIVILEGES` in 0017. `EXECUTE` is granted per-function, narrowly, to the functions meant to be callable (never to raw table writes on the sensitive tables — 0008/0012/0017's grants to `authenticated` include INSERT/UPDATE/DELETE at the table level, but this is explicitly safe per those files' own comments: with no RLS write policy for `authenticated` on those tables, RLS denies the operation for every row regardless of the table grant — the grant only unblocks what the SELECT policies already allow).
- `service_role`: full table/sequence/function access restored in 0007 (it never had it at all on this project) plus `ALTER DEFAULT PRIVILEGES` so future objects inherit it automatically. Appropriate for a role that only the Edge Function uses, server-side.
- No grant to any client role was found to be overly permissive relative to what its RLS policies/SECURITY DEFINER functions already allow.

### Extensions

No migration file issues a `CREATE EXTENSION` statement (no `pgcrypto`/`uuid-ossp`/etc.). All migrations use `gen_random_uuid()` for PK defaults, which is natively available in modern Postgres via `pgcrypto`, implying the relevant extension was enabled outside the migrations folder (consistent with §4's finding that the base schema predates this repo's migrations). **This could not be verified without a live connection** — if a fresh database were ever bootstrapped purely from these files, `CREATE EXTENSION IF NOT EXISTS pgcrypto;` would need to be added first, or `gen_random_uuid()` calls would fail.

### Edge Function (`supabase/functions/admin-delete-account/index.ts`) — auth/authorization review

Read in full. Findings:
- Requires a `Bearer` Authorization header carrying the **caller's own session JWT** — never accepts or forwards the service_role key from the client.
- Independently re-verifies the caller is an approved admin via a `service_role`-backed `profiles` lookup (`role === 'admin' && account_status === 'approved'`), **in addition to** the database-side `is_admin()` check inside `admin_delete_rejected_account()` — genuine defense in depth, not a single point of trust.
- The actual data-deletion RPC call (`callerClient.rpc('admin_delete_rejected_account', …)`) is made **as the calling admin** (their JWT forwarded, not the service key), so the database's own authorization logic (is_admin-gated, rejected-only, self-delete-blocked) is the real boundary — the Edge Function is not a bypass of it.
- The service_role key is read from `Deno.env.get('SERVICE_ROLE_KEY')` (an explicitly-set Edge Function secret, per the code's own comment, because this project uses Supabase's newer scoped `sb_secret_...` key system rather than the legacy auto-injected one) — never a literal, never logged, never echoed to the client. A fallback to `SUPABASE_SERVICE_ROLE_KEY` is present for compatibility but both paths stay server-side only.
- Self-deletion is blocked (`callerId === targetUserId` → 403) before any privileged action runs.
- Idempotent/retry-safe: a `P0002` from the RPC (profile already gone) is treated as "DB side already clean" and the function proceeds straight to the Auth-user deletion step; an already-gone Auth user is treated as success.
- Failure paths are never swallowed — every failure returns an explicit error and, where the DB cleanup already succeeded but the Auth deletion failed, writes a permanent audit-log entry (`account_deletion_auth_step_failed`) so an orphaned Auth user is never silently invisible.
- No hardcoded secrets anywhere in the file (checked with a pattern search for `sb_secret_`, literal key/password assignments — none found; only comments referencing the *name* of the secret system).

This function's authorization design is sound: the service_role key never reaches the browser, and the database — not the Edge Function — is treated as the actual security boundary throughout, exactly as its own header comment claims.

### `docs/security-audit/*.md` vs. what the migrations actually contain

The existing audit is largely accurate for the state of the project **as of migration 0013**, and its one documented vulnerability (profiles privileged-column escalation) is in fact fixed in 0013, present in this repo, matching the audit's description exactly. However, two of its claims are now stale because migrations 0014–0017 were added after that audit was written:

1. **`03-vulnerabilities-and-fixes.md` §6 and `06-manual-steps-remaining.md` §3 both state the planner features (Tasks/Schedule/Calendar/Subjects/Grades-GWA/Attendance/Syllabus/Notes) "read/write exclusively through `assets/js/data/storage.js` (localStorage), never through Supabase."** This is no longer true. Migrations 0014 and 0015 were written specifically to support moving these features onto Supabase, and `assets/js/data/cloud-sync.js` (confirmed by direct grep) does call `.from('subjects')`, `.from('tasks')`, `.from('calendar_events')`, `.from('notes')`, `.from('attendance')`, `.from('grades')`, `.from('gwa_calculator')`, `.from('syllabus_courses')`, `.from('task_checklist_items')`, `.from('grade_components')`, `.from('grade_assessments')`, `.from('semesters')` — i.e., the RLS on these tables **is** protecting live traffic. This report does not edit `docs/security-audit/*.md` per the task's instructions (content there is left alone), but flags the discrepancy here.
2. 0016's own header comment explicitly states this project's **base schema (`profiles`, `tasks`, `subjects`, etc.) was created outside the migrations folder** (Supabase dashboard / a pre-repo SQL editor session), consistent with `01-tables-audited.md`'s note that its table list is "sourced from a live production schema/RLS dump ... authoritative over `supabase/migrations/*.sql`." **This means the migration set in this repo is NOT sufficient to bootstrap a fresh database from zero.** Running 0001→0018 against an empty Postgres database would fail immediately — every file from 0004 onward does `ALTER TABLE public.profiles ...` / `ALTER TABLE public.tasks ...` / etc. against tables that no `CREATE TABLE` statement in this repo ever creates. This repo's migrations are **incremental patches on an externally-created base schema**, not a from-scratch bootstrap script. Any disaster-recovery plan must account for this — see §5.

---

## 4. Schema-vs-application consistency

Every table name and RPC function name referenced via `.from('...')` / `.rpc('...')` in `assets/js/data/cloud-sync.js`, `assets/js/services/*.js`, and `assets/js/core/supabase-client.js` was cross-referenced against the migrations:

- **Tables referenced by the app, all present in the migrations or base schema:** `admin_audit_log`, `admin_message_recipients`, `admin_messages`, `attendance`, `calendar_events`, `grade_assessments`, `grade_components`, `grades`, `gwa_calculator`, `notes`, `profiles`, `semesters`, `subjects`, `support_ticket_notes`, `support_tickets`, `syllabus_courses`, `task_checklist_items`, `tasks`. No table/column the app queries was found to be missing from the migration-defined schema.
- **RPC functions referenced by the app, all defined in the migrations:** `admin_add_ticket_note`, `admin_archive_message`, `admin_send_message`, `admin_set_ticket_status`, `set_account_status`, `set_message_read_status`, `submit_profile_details`, `submit_support_report`. `admin_delete_rejected_account` is not called via `.rpc()` from the frontend directly — it's invoked indirectly through the `admin-delete-account` Edge Function (confirmed in `assets/js/modules/admin-rejected.js`), which is the intended, documented design (never expose the deletion RPC to a direct client call path that could skip the Edge Function's extra checks — though note the RPC itself is still independently `is_admin()`-gated either way).
- **Tables defined but confirmed intentionally unused by the client (lower priority, not a bug):** `syllabus_weeks`, `syllabus_topics` — 0015's own header and `cloud-sync.js`'s comments explicitly document that the full syllabus record is stored denormalized in `syllabus_courses.data` (jsonb) instead, with these two tables kept only for a possible future normalization. `pomodoro_stats`, `user_settings`, `push_subscriptions`, `university_events`, `curriculum_courses`, `university_directory`, `student_services`, `university_resources` — not referenced anywhere under `assets/js/data/` or `assets/js/services/`; `pomodoro`/`universityEvents` still only exist as `localStorage` keys in `assets/js/data/storage.js`. These tables/RLS policies exist and are correctly scoped but currently have no live traffic from this frontend — consistent with, and the likely origin of, the stale "nothing is wired to the DB" claim in the existing audit, which turned out to be true for a subset of tables but not all of them.
- **No type mismatches** were found between what the client inserts/updates and the column types/constraints added in the migrations (e.g. `tasks.time_estimate_min` is sent as a number from `cloud-sync.js` and constrained `>= 0` in 0014; `subjects.online` is sent as a boolean and typed boolean in 0014).

---

## 5. Validation actually performed (and what could not be verified)

**Performed:**
- Read all 17 original migration files plus the new 0018 in full, in order.
- Checked every file for balanced `$$` function-body delimiters (all balanced).
- Searched every `security definer` occurrence for a `search_path` pin (all 27 present except one non-DEFINER function, noted above).
- Searched all SQL files and the Edge Function for hardcoded secrets/keys/passwords via pattern matching (`sb_secret_`, literal key/password assignments) — none found, only documentation references to the naming convention.
- Grepped `assets/js/data/cloud-sync.js`, `assets/js/services/*.js`, and `assets/js/core/supabase-client.js` for every `.from()`/`.rpc()` call and cross-referenced each table/function name against the migration files (§4).
- Visually/structurally reviewed `admin-delete-account/index.ts` line by line (no Deno/tsc available in this environment to type-check it; reviewed for control flow, error handling, and auth logic by hand instead — see §3).
- Confirmed grant statements for `anon`/`authenticated`/`service_role` per migration by direct grep.

**Not performed, and not possible without a live connection (stated per the task's safety rules):**
- No connection was made to any Supabase/Postgres instance. Nothing here confirms the *live* database actually matches these files — only that these files, read together, describe a consistent and apparently-secure design.
- The literal SQL text of the base-schema RLS policies (`profiles_update_own` and the ownership policies on every table that predates this migrations folder) was not available to read in this repo at all — this report's RLS claims for those tables rely on the same `docs/security-audit/01-tables-audited.md` summary the prior audit used, which that audit itself flagged as unverified against `pg_policies` directly. This remains unverified here too.
- Whether `pgcrypto` (or equivalent) is actually enabled on the live project was not verified — inferred only from `gen_random_uuid()` being used without a `CREATE EXTENSION` statement anywhere in this repo.
- 0018 (the new migration) has not been applied to any database, live or otherwise — it has only been written and reviewed by hand for syntax/logic correctness.

---

## 6. Required manual steps for the user

1. **Apply `supabase/migrations/0018_add_missing_indexes.sql`** against the live project — via `supabase db push` (after `supabase link --project-ref <ref>`) or by pasting it into the Supabase Dashboard → SQL Editor. It is purely additive (`CREATE INDEX IF NOT EXISTS`) and safe to run at any time with no downtime.
2. **Verify it worked** by running, in the SQL Editor:
   ```sql
   select indexname from pg_indexes where tablename = 'admin_audit_log';
   ```
   and confirming `idx_admin_audit_log_created_at`, `idx_admin_audit_log_actor_id`, `idx_admin_audit_log_target_user_id` all appear.
3. **Re-check the base-schema RLS policy text directly**, since this repo (and the prior audit) could only summarize it rather than read it:
   ```sql
   select schemaname, tablename, policyname, cmd, qual, with_check
   from pg_policies where schemaname = 'public' order by tablename, policyname;
   ```
4. **Confirm `pgcrypto` (or whichever extension provides `gen_random_uuid()`) is actually enabled**, e.g. `select * from pg_extension;` — and if ever rebuilding this database from scratch, be aware the migrations in this repo assume the base tables (`profiles`, `tasks`, `subjects`, etc.) already exist; they are not a from-zero bootstrap script (§3's "schema-vs-application" finding).
5. **Update `docs/security-audit/03-vulnerabilities-and-fixes.md` §6 and `06-manual-steps-remaining.md` §3** to reflect that cloud-sync (0014/0015) now wires most planner features to Supabase — left as-is in this pass per the task's instruction not to rewrite that content, but it should not be relied on as current.
6. **Remaining unverified risk:** the exact RLS policy text for `task_checklist_items`, `grade_components`, `grade_assessments`, `syllabus_weeks`, `syllabus_topics`, and `profiles_update_own` itself — all predate this migrations folder and were not readable from any file in this repo. Treat §3's description of them as inherited from the prior audit's summary, not independently re-verified here, until step 3 above is run.

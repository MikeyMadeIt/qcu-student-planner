# Supabase backend — deployment guide

This folder is the full server-side half of the app: SQL migrations (schema, RLS,
triggers, and SECURITY DEFINER functions) and one Edge Function. Everything here
runs against the project already configured in `assets/js/core/config.js`
(`supabaseUrl` / `supabaseAnonKey` — safe to expose, RLS-gated). Nothing in this
folder should ever contain a service_role key as a literal value.

## 1. Apply the SQL migrations

Run the files in `supabase/migrations/` **in filename order** — each one is a
single idempotent step. Easiest options:

```bash
# Using the Supabase CLI, from the project root:
supabase link --project-ref pjafmgabajqqozdxhzvz
supabase db push
```

or paste each file's contents into the Supabase Dashboard → SQL Editor and run
them in order (0001 → 0006). Migrations 0002–0005 were already applied to the
live project in Phase 2 (each file says so in its header comment) and are safe
to re-run — `create or replace` / `if not exists` throughout.

**0006_account_permanent_deletion.sql is new in Phase 3** and must be applied
before the Edge Function below can work — it adds:
- `public.admin_delete_rejected_account(target_user_id, reason)` — the only
  function allowed to delete a rejected account's data. Re-checks `is_admin()`,
  re-checks the target is still `'rejected'`, deletes the account's rows across
  every planner table in dependency order, writes one audit entry, then deletes
  the `profiles` row — all inside one transaction.
- `admin_audit_log.target_email` / `target_full_name` — a permanent snapshot so
  deletion audit entries stay meaningful forever, even after `target_user_id`
  is set to `NULL` (the FK is now `ON DELETE SET NULL`, not blocking or cascading).
- Defensive `is_admin()` / `is_approved()` redeclarations, matching the
  behaviour every existing RLS policy already relies on (see the file header —
  this is a safety net for rebuilding the schema from scratch, not a change
  in behaviour).

## 2. Deploy the `admin-delete-account` Edge Function

This function performs the one operation the browser must never be trusted
with: removing a Supabase Auth user. It is the **only** place in this project
that touches `service_role`, and that key never leaves the function's own
server-side environment.

```bash
supabase functions deploy admin-delete-account --project-ref pjafmgabajqqozdxhzvz
```

**Required configuration** — `SUPABASE_URL` and `SUPABASE_ANON_KEY` are
auto-provisioned as secrets for every Edge Function in a Supabase project.

**`SERVICE_ROLE_KEY` must be set manually, as a secret named exactly
`SERVICE_ROLE_KEY`** (Supabase does not allow a custom secret name starting
with `SUPABASE_`). The auto-injected `SUPABASE_SERVICE_ROLE_KEY` is not used,
because on this project it was found to not reliably carry full privileges.

1. **Project Settings → API Keys** → use (or create) a secret key
   (`sb_secret_...`). Give it **Bypass Row Level Security** and an **Auth:
   manage users** (or equivalent Auth admin) permission.
2. Copy that key's value and set it as the `SERVICE_ROLE_KEY` secret under
   **Edge Functions → Secrets**. Never paste a secret key into chat, a commit,
   or any file in this repo — set it directly in the dashboard, and rotate any
   key that was ever shared outside of it.
3. **Also run `supabase/migrations/0007_grant_service_role_privileges.sql`.**
   This was the actual root cause hit during setup: Postgres returned
   `permission denied for table profiles (42501)` with the hint
   `GRANT SELECT ON public.profiles TO service_role;` — meaning the
   `service_role` Postgres role itself had never been granted table
   privileges on this project at all. This is a plain SQL `GRANT`, unrelated
   to RLS or to the new key system's "Bypass RLS" permission (that only
   matters once a base table grant already exists). 0007 restores the
   grants Supabase normally sets up automatically, for every current and
   future table.

If the function ever reports *"missing required Edge Function secret(s)"*,
check whether `SERVICE_ROLE_KEY` is set at all. If it instead reports
`permission denied for table ...`, that means the key resolves fine but
0007 above has not been applied yet.

No CORS allow-list is hard-coded beyond `*`, because this is a static site
with no fixed deployment origin (see the root `README.md` — GitHub Pages,
Netlify, Vercel, etc. are all supported). The real access boundary is not CORS
here, it's: a valid signed-in session JWT, re-verified admin status, and the
database-side `is_admin()` + `'rejected'`-only checks inside the RPC the
function calls. If you deploy this behind a single known domain, you may
tighten `Access-Control-Allow-Origin` in `index.ts` accordingly, but it is not
required for the security model to hold.

## 3. What the deletion flow actually does, end to end

1. Admin clicks **Delete Permanently** on `pages/admin/rejected.html`, confirms
   with a typed "DELETE", which calls
   `AdminService.deleteAccountPermanently()` →
   `supabase.functions.invoke('admin-delete-account', ...)`.
2. The Edge Function verifies the caller's JWT, independently re-checks (via
   the service-role client, bypassing RLS on purpose for this one read) that
   the caller is `role = 'admin'` and `account_status = 'approved'`.
3. It calls `admin_delete_rejected_account()` **as the calling admin** (their
   JWT is forwarded, not the service key) — this is what makes `auth.uid()`
   resolve correctly inside the database for both `is_admin()` and the audit
   log's `actor_id`. The database, not the Edge Function, is still the real
   authorization boundary.
4. Only after that succeeds (or is confirmed already done, for a safe retry)
   does the function call `supabase.auth.admin.deleteUser()` with the
   service-role client — the one step that genuinely requires it.
5. Every outcome — success, "not authorized", "not rejected", or a failure
   partway through — returns an explicit, specific error message. The UI is
   only updated after a real `200 { ok: true }` response; nothing is assumed.

## 4. Did deleting the Auth user cascade the `profiles` row?

**Do not assume either way without checking the live project** (Dashboard →
Database → Tables → `profiles` → find the foreign key on `id`, or run
`\d profiles` / query `information_schema.table_constraints` /
`referential_constraints` in the SQL editor). This project does not rely on
the answer: `admin_delete_rejected_account()` explicitly deletes the
`profiles` row itself (and every child table) regardless of whatever FK
behaviour `auth.users → profiles` has, and the Edge Function's Auth-deletion
step is written to be safe whether or not that FK cascades. If it turns out
`profiles.id` does cascade from `auth.users`, the explicit
`delete from public.profiles` in the function simply becomes a no-op by the
time it would matter — it causes no error either way.

## 5. Retention

Audit log rows (`admin_audit_log`) are never deleted by this feature, by
`set_account_status()`, or by any migration here — only `INSERT` is possible
for any client role (see the table's RLS policy in `0002_admin_audit_log.sql`;
there is still no insert/update/delete policy for `authenticated`, so even an
admin can only read it, never edit or clear it from the app). Deleting an
account removes its *planner data*; it does not and cannot remove the record
that the account existed and was deleted, by whom, and when.

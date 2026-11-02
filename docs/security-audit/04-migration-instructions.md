# Applying the New Migration

**We do not have live Supabase access in this environment.** Nothing has been applied to the production database. You must run this yourself.

## File

`supabase/migrations/0013_lock_profiles_privileged_columns.sql`

## What it does

Adds a `BEFORE UPDATE` trigger on `public.profiles` that reverts any attempted change to `role` or `account_status` unless the acting session passes `is_admin()`. Purely additive — does not drop or alter any existing policy, function, or data.

## How to apply

Option A — Supabase CLI, from the project root:
```bash
supabase link --project-ref pjafmgabajqqozdxhzvz
supabase db push
```

Option B — Supabase Dashboard → SQL Editor: open `supabase/migrations/0013_lock_profiles_privileged_columns.sql`, copy its full contents, paste into a new query, and run it.

## Safety

- Idempotent: uses `create or replace function` and `drop trigger if exists` before `create trigger`, so it is safe to run more than once.
- Non-destructive: touches no rows, no existing columns, no existing policies.
- No lock-heavy operation: adding a trigger to `profiles` takes a brief `ACCESS EXCLUSIVE` lock on that one table, same as any `CREATE TRIGGER`; for a table of this size (user profiles, not a high-write hot table) this is effectively instant and safe to run during normal operation.

## After applying

Run the verification queries in `05-test-checklist.md` (the ones marked "requires manual testing") against a real non-admin student account to confirm the trigger blocks self-promotion.

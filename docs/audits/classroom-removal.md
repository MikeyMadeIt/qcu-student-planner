# Google Classroom integration removal record

This records repository findings and the separate, unexecuted database cleanup
plan in [`supabase/verification/remove-classroom-integration.sql`](../../supabase/verification/remove-classroom-integration.sql).
The SQL must not be run until the owner confirms the Supabase project and
approves the external cleanup. Historical Git commits and the merged deployment
PR remain in repository history by design.

## Repository components removed

- Student navigation entry and its page section/group references.
- `pages/app/classroom.html` and `assets/js/modules/classroom.js`.
- Edge Functions `classroom-oauth-start`, `classroom-oauth-callback`, and
  `classroom-connection`, plus their exclusive helper
  `supabase/functions/_shared/classroom.ts`.
- The callback function's `supabase/config.toml` entry.
- Classroom Edge Function deployment and database preflight GitHub Actions.
- Local-only Classroom OAuth setup/audit documents, migrations, verification
  query, environment example entries, and security test were found in the
  developer working tree; they were not committed on `dev/mikey`.

The shared Google Sign-In flow, Supabase authentication, profiles, other Edge
Functions, and the general task copy about coursework are not Classroom
integration code and are retained.

## Database objects identified

Migration files `0031_google_classroom_oauth.sql` and
`0032_classroom_oauth_return_origin.sql` define these feature-owned objects:

- Tables `public.classroom_connections` and
  `private.classroom_oauth_transactions` (including the `return_origin` column).
- Indexes `classroom_connections_one_active_per_user`,
  `classroom_connections_status_sync_idx`, and
  `classroom_oauth_transactions_expiry_idx` (removed automatically with their
  owning tables).
- RPCs `public.classroom_create_oauth_transaction(text, uuid, text, text, text,
  text[], timestamptz)`, `public.classroom_consume_oauth_transaction(text)`,
  `public.classroom_create_oauth_transaction_v2(text, uuid, text, text, text,
  text[], timestamptz, text)`, `public.classroom_consume_oauth_transaction_v2(text)`,
  `public.classroom_save_connection(uuid, text, text, text, timestamptz, text[])`,
  `public.classroom_get_refresh_token(uuid, uuid)`,
  `public.classroom_disconnect_connection(uuid, uuid)`,
  `public.classroom_mark_reauthorization_required(uuid, uuid)`, and
  `public.classroom_record_token_refresh(uuid, uuid, timestamptz, text)`.
- Trigger `classroom_connection_delete_secret` on
  `public.classroom_connections` and its function
  `private.delete_classroom_refresh_secret()`.
- Vault secret rows with names beginning `qcu-classroom-refresh-`, created by
  the migrations for Classroom refresh credentials.

The tables reference `public.profiles`, but are outgoing foreign keys; dropping
the Classroom tables does not drop or modify profiles. The migrations add no
custom types, enums, or explicit RLS policies. The cleanup script uses the
exact function signatures and secret prefix above, orders dependent objects,
and uses `DROP ... RESTRICT` without `CASCADE`. It intentionally retains the
shared Vault extension, `vault` objects, `private` schema, and schema grants.

## External cleanup still awaiting approval

- Check the Supabase project `pjafmgabajqqozdxhzvz` for the three deployed
  functions and any Classroom-only Edge Function secrets. Remove them only
  after confirming exact names and that they are not shared.
- Review and, after approval, run the SQL cleanup script against that project.
- Inspect Google Cloud for the dedicated Classroom OAuth client, Classroom API
  enablement, consent-screen scopes, and test users. Retire only resources
  verified as Classroom-only; preserve the separate Google Login client/project.
- GitHub repository and `github-pages` environment secret names were inspected.
  They contain shared Supabase deployment/database secrets; none is
  Classroom-named. Secret values were not read.
- GitHub has no open Classroom issue, PR, discussion, or Classroom-only remote
  branch. The Classroom deployment workflow PR is already merged and remains
  in history. Local Classroom-related worktrees/branches were left intact.

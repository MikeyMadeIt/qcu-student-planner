# Shared Note Repository schema proposal

**Status:** Review only. This is a design proposal, not an executable migration. No database or Storage changes have been applied.

## Current repository findings

- The app has a personal Notes feature in `pages/app/notes.html` and `assets/js/modules/notes.js`.
- Notes are stored in `public.notes`, hydrated and written by `assets/js/data/cloud-sync.js`, and are associated with a user, semester, optional subject, optional task, category, and tags.
- Existing client mapping reads and writes only the current personal-note fields. It must be updated before adding persisted folder or publication fields, or ordinary note sync could fail to round-trip the new fields.
- Migrations `0016_security_audit_data_isolation.sql` and `0024_approved_only_data_access_remaining.sql` document owner-scoped notes protection. The repository does not contain the base `public.notes` DDL or the exact original notes policies.
- No repository upload client or `supabase.storage.from(...)` call is present. No Storage bucket or Storage policy is defined in the checked-in migrations. The deployed dashboard configuration was not inspected.

## Proposed data model

1. Add `public.note_folders` with UUID ID, `user_id`, optional same-owner `parent_id`, folder name, optional same-owner `subject_id`, and timestamps. A composite owner key/FK should prevent cross-user parent or subject references. Deleting a folder should either move notes to its parent or reject deletion while it contains notes; it must not cascade-delete notes.
2. Add nullable `folder_id`, `visibility` (`private` by default), and `published_at` to `public.notes`. Preserve current rows as private. Keep the existing notes table so private authored notes are not copied into a second notes system.
3. Add `public.note_attachments` for file metadata and the private Storage object path. Include owner, note/folder association, original filename, media type, byte size, and timestamps. Enforce owner consistency across note and folder associations.
4. Create a **private** Storage bucket with an explicit file-size limit and allowlisted study-material MIME types. Store objects under an owner UUID and attachment UUID path. Never use public object URLs; download with short-lived signed URLs after authorization.

## Proposed access rules

- Keep note insert/update/delete owner-only. Only an owner may set a note to `published`; reject publication if the owner, folder, subject, or attachment relationships do not match.
- Permit authenticated, approved repository readers to select only published notes and published attachment metadata. Owners may also read their own private drafts.
- Keep folder management owner-only. Published folders may be readable only when needed for navigation; never expose a private folder name through a published note relationship.
- Storage insert/update/delete must require the authenticated owner and a matching attachment metadata row. Storage reads should permit the owner or a reader whose attachment is attached to an authorized published note. Use signed URLs and verify the matching row before issuing them.
- Add admin moderation only after the repository’s actual administrator authorization helper and expected access rules are confirmed. Do not infer admin rights from client state.
- Keep RLS enabled and add explicit grants, indexes, owner-consistency triggers, and policy tests. Review default privileges for all new tables.

## Required client and release work before a migration is approved

- Update `notesRowToLocal` and `notesLocalToRow` in `assets/js/data/cloud-sync.js` to preserve folder, visibility, and publication fields through hydration and sync.
- Add a repository query/download service that queries by visibility and obtains signed Storage URLs; do not make the bucket public.
- Define upload limits, MIME validation, object cleanup on note deletion, publication review rules, and behavior when a note or folder is deleted.
- Validate the exact live `public.notes` schema, grants, RLS policies, Storage buckets, and repository audience before drafting executable SQL. The checked-in base schema and live dashboard state are unavailable in this audit.
- Add RLS and Storage policy tests covering anonymous access, other-user access, private drafts, published reads, owners, and administrators.

## Open product decisions

- Whether published materials are visible to all approved students or only selected courses/subjects.
- Whether publishing is immediate or requires moderation.
- Whether uploaded files may be attached to an existing personal note or are standalone repository items.
- Supported formats, per-file and per-user quotas, and retention/virus-scanning requirements.
- Whether administrators can edit owner submissions or only moderate publication state.


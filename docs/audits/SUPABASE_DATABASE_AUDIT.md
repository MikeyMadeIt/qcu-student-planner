# Supabase Database Audit and Pre-Production Readiness

**Project:** QCU Student Planner  
**Audit date:** 2026-11-23  
**Scope:** Repository-level review of migrations, frontend database calls, Edge Functions, configuration, data handling, and existing audit notes.  
**Mode:** Audit only. No application, schema, migration, policy, or database changes were made.

## A. Executive summary

### Overall assessment

The repository describes a thoughtful Supabase design with user-scoped RLS, approval gating, cross-tenant foreign-key checks, and server-side admin functions. The strongest evidence is in migrations 0013–0017 and 0024–0027. However, this is **not production-ready on repository evidence alone**. The actual base schema and its policies are missing from the migration history, the AI Edge Function and AI save RPC implementations are absent, there is no verifiable backup/restore runbook, and static review cannot establish the live project's RLS, indexes, bucket configuration, or size.

**Supabase Free can support a small pilot, but it is not a sound first-production plan for student academic data.** Its 500 MB database limit may be enough for a small cohort with little AI use; the app's growing AI content and unbounded collection sync make that uncertain. Free projects also pause after inactivity and have no automatic backups. Supabase Pro is the practical choice for the first public deployment because it preserves the existing Auth, Postgres, RLS, Storage, and Edge Functions architecture while adding 8 GB included database disk and daily backups retained for seven days. Current published pricing is $25/month before overages and additional compute choices. [Supabase pricing](https://supabase.com/pricing), [backup documentation](https://supabase.com/docs/guides/platform/backups)

### Most important findings

1. **HIGH — Schema recovery is not reproducible from this repository.** Most core tables were created outside the committed migrations. Several AI RPCs called by the frontend and the `ai-study` function it invokes are not present in the repository.
2. **HIGH — Free has no automated backup and the app has no documented tested restore process.** Supabase database backups do not contain Storage objects; files need a separate backup plan if buckets are added or exist outside this repository.
3. **HIGH — Per-user hydration has no pagination and selects every column.** A 1,000-row API response ceiling is configured locally; the production API limit was not verifiable. Larger user collections can be truncated or cause repeated large responses.
4. **HIGH — Current table-level security cannot be fully verified.** RLS policies for the pre-migration base schema are not included, and there was no safe live database connection. Later migrations improve coverage, but only the live catalog and role behavior can establish production state.
5. **MEDIUM — AI conversations and generated study content accumulate.** The UI limits the conversation/deck/quiz list to 50, but does not show a retention cap for messages or quiz attempts. Original AI input files appear transient and are not uploaded to Supabase Storage by the reviewed client.
6. **MEDIUM — Semester mapping is partly browser-local.** `cloud-sync.js` keeps the mapping between local record semester IDs and semesters in `localStorage`; a new browser/device cannot rely on that mapping being present.

No live measurements, query plans, or confirmed live security exploit were obtained. Findings below distinguish repository evidence from facts that need live verification.

## B. Existing architecture

### Database structure and migration history

The repository contains migrations 0001–0030, but these are **incremental changes, not a from-zero schema**. `DATABASE_MIGRATION_REPORT.md` and migration 0016 state that the original core schema predates the migrations folder. Of the audited `CREATE TABLE` statements in these migrations, tables include:

| Area | Tables visible in migrations | Role in the app / evidence |
|---|---|---|
| Profiles and admin | `profiles` (base schema), `admin_audit_log` | Profile creation/status flow; audit rows written by privileged admin functions. |
| Student planner | `subjects`, `tasks`, `task_checklist_items`, `notes`, `calendar_events`, `attendance`, `grades`, `grade_components`, `grade_assessments`, `gwa_calculator`, `semesters` (mostly base schema) | Local-storage-backed planner state is mirrored to and hydrated from Supabase in `assets/js/data/cloud-sync.js`. |
| Syllabus | `syllabus_courses`, `syllabus_weeks`, `syllabus_topics` (base schema) | Migration 0015 adds `syllabus_courses.data jsonb`; the existing migration report says the nested syllabus is stored in that JSON rather than the child tables. Current cloud sync does not include syllabus in its main hydration list, so actual persistence/use should be confirmed. |
| AI tools | AI chat, quiz, flashcard tables (base schema, policies in later migrations) | Stores call `save_ai_chat_turn`, `save_ai_quiz`, and `save_ai_flashcard_deck`. Definitions are not in the committed migration set. |
| Communication/support | `admin_messages`, `admin_message_recipients`, `support_tickets`, `support_ticket_notes` | Created in 0008; app writes through SECURITY DEFINER RPCs rather than direct client mutations. |
| Shared institutional content | `university_events`, `qcu_news_articles`, `qcu_news_sync_state` | Migrations 0028 and 0030 create these; QCU news sync is handled by a server-side function. |
| Preferences | `user_preferences` | Created in 0026; cloud sync stores preference JSON. |

The migration history and `DATABASE_MIGRATION_REPORT.md` do not provide a canonical base-schema dump or a complete current schema snapshot. There are also likely externally created objects such as Auth triggers, extensions, and AI RPCs that cannot be reconstructed from the committed SQL alone.

### Read/write paths by feature

| Feature | Read/write path found in repository | Important observations |
|---|---|---|
| Tasks, subjects, calendar, notes, attendance, grades | `storage.js` maintains localStorage; `cloud-sync.js` hydrates selected collections and pushes dirty changes to Supabase. | Cloud calls generally `select('*')`; hydration is unpaginated. Nested task checklist and grade component/assessment writes use multiple calls and deletes/upserts. |
| Semesters | `semesters` rows are synced; per-record semester links are additionally stored under `sp_cloud_semester_map` in localStorage. | The mapping is device-local. A second device/browser needs a robust reconstruction path; fallback behavior uses the active/local semester. This weakens cross-device relationship consistency. |
| AI chat | `ai-chat-store.js` calls `save_ai_chat_turn`; reads latest 50 conversations and retrieves messages for a selected conversation. | RPC implementation and table DDL are absent. The assistant prompt history has a limit, but storage retention is not evident. |
| AI quizzes | `ai-quiz-store.js` calls `save_ai_quiz`; lists latest 50 and fetches attempts relation for listed quizzes. | Attempt count is not paginated in the client. JSON answers and generated explanations can accumulate. RPC implementation/schema unavailable. |
| AI flashcards | `ai-flashcard-store.js` calls `save_ai_flashcard_deck`; lists latest 50 and fetches deck cards. | No database-side retention or size cap was found. RPC implementation/schema unavailable. |
| AI file input | `ai-file-upload.js` accepts PDF/JPG/PNG up to 8 MiB, reads the input as base64, and passes it to AI processing. | No `storage.from(...).upload(...)` use was found. The reviewed client does not persist uploaded originals in Supabase Storage; only metadata such as a filename may be retained by AI history. The referenced `ai-study` Edge Function is absent from this checkout, so server-side processing/retention cannot be audited. |
| Admin and student support | `admin-service.js` uses range pagination for large admin lists and short limits for dashboard previews. Migrations 0008 provide RPC-based writes. | This is better bounded than planner hydration. Audit log is append-only by client policy and has indexes added in 0018. |
| QCU news | `sync-qcu-news` fetches bounded pages from the public QCU source and upserts article rows. | No pruning of old articles was found; shared cache can grow over successive syncs. This is likely small compared with user-generated AI content. |
| Pomodoro and some local settings/events | `storage.js` retains localStorage keys; existing migration report says `pomodoro_stats` and `university_events` have no client traffic from the reviewed frontend path. | Do not treat a table's existence as proof a feature is cloud-backed. Verify which local-only records are expected to survive browser loss. |

### Authentication, RLS, functions, and configuration

- Signup trigger migrations create a pending student profile. `submit_profile_details` handles the pending profile workflow. Migration 0013 blocks users from changing their own role/account status; 0025 extends the protected privileged fields.
- Migration 0016 enables RLS on the then-known core tables and uses `assert_owned_fk()` SECURITY DEFINER triggers to reject cross-user parent references on several direct user-owned tables. Migrations 0024–0030 add approved-account policies and new protected/shared tables.
- `admin-delete-account` uses server-side service credentials from environment variables, separately checks the caller as an approved admin, and also invokes database-side authorized cleanup. No service-role secret was found in the reviewed frontend paths. Do not publish or copy public client keys into this report.
- `sync-qcu-news` uses a service-side client and validates a cron secret or approved authenticated caller. Its `qcu_news_sync_state` access is granted to the server-side role.
- `supabase/config.toml` is local CLI configuration. It sets `api.max_rows = 1000`, local Storage `file_size_limit = "50MiB"`, and has no active bucket definition. These values do **not** prove production cloud settings. The file has no committed Storage bucket creation or Storage object policies.
- No Storage upload or object access path was found in reviewed application code. A deployed dashboard may still contain out-of-repository buckets/policies; check the live Storage catalog before launch.

## C. Storage analysis

### Actual vs. estimated

**Actual measured storage: unavailable.** No Supabase/Postgres connection or database inspection tool was available. No `pg_database_size`, table counts, relation sizes, TOAST sizes, or index usage measurements were obtained. This report does not claim a measured database size or row count.

**Schema-based risk assessment:** likely database growth sources are AI message text, generated quiz/flashcard content and explanations, quiz attempts/answers (including JSONB), notes, syllabus JSONB if synced, and append-only audit/support records. There are no observed database columns storing uploaded PDF/image bytes. AI uploads are converted to base64 only for the request path in the client and are not seen being stored in Supabase Storage.

**Separate file storage:** the local config declares a 50 MiB Storage upload cap, but the AI upload client cap is 8 MiB and no Storage uploads were found. Supabase Storage file quotas are separate from PostgreSQL database size; do not add object bytes to the database forecast. No bucket configuration/policies can be verified from the repo.

### Largest table/index status

| Category | Static finding | Actual size status |
|---|---|---|
| AI history and generated records | Highest likely per-user growth because user and model text, quiz question/explanation text, cards, and attempts can be retained indefinitely. | Unknown; AI schema/RPC implementation missing. |
| Planner records | Notes and tasks accumulate; attendance/events can add repeated rows each term. | Unknown; base schema absent. |
| Syllabus payload | `syllabus_courses.data jsonb` is a potentially large nested payload by design, but current sync coverage is unclear. | Unknown. |
| Admin audit/support | Append-only or retained operational records. | Unknown; likely lower volume than student content. |
| Indexes | Migrations explicitly add user/FK indexes and admin audit indexes; catalog may contain more indexes from base schema. | Unknown; no live index sizes or usage. |
| TOAST | Large text/JSONB values can be compressed/out-of-line by PostgreSQL. | Unknown; no catalog access. |

### Safe read-only inspection SQL

Run these manually in the Supabase SQL Editor using a read-only database role if available. They inspect catalogs and do not change data. Table estimates are statistics, not exact counts; `ANALYZE` is intentionally not included. `EXPLAIN ANALYZE` is intentionally not included because it executes the query.

```sql
-- Database size
select current_database() as database_name,
       pg_database_size(current_database()) as database_bytes,
       pg_size_pretty(pg_database_size(current_database())) as database_size;

-- Table, heap, index, and TOAST-inclusive size; estimated rows from stats
select s.schemaname, s.relname as table_name, s.n_live_tup, s.n_dead_tup,
       pg_relation_size(c.oid) as heap_bytes,
       pg_indexes_size(c.oid) as index_bytes,
       pg_total_relation_size(c.oid) as total_bytes,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
       case when c.reltoastrelid = 0 then 0
            else pg_total_relation_size(c.reltoastrelid) end as toast_total_bytes
from pg_stat_user_tables s
join pg_class c on c.oid = s.relid
order by pg_total_relation_size(c.oid) desc;

-- Per-index size and observed use since stats were last reset
select schemaname, relname as table_name, indexrelname as index_name,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_relation_size(indexrelid) as index_bytes,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
order by pg_relation_size(indexrelid) desc;

-- Current RLS state and policies
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;
```

For a live index review, collect these stats after meaningful usage and interpret `idx_scan = 0` only after confirming the stats reset time and a representative workload window. Do not drop an index based on a short or idle sample.

## D. Index and query findings

### Indexes present in migrations

- 0014 adds indexes on `subjects(user_id)`, `tasks(user_id)`, `calendar_events(user_id)`, and `task_checklist_items(task_id)`.
- 0015 adds indexes on `notes(user_id)`, `attendance(user_id)`, `grades(user_id)`, `gwa_calculator(user_id)`, `syllabus_courses(user_id)`, `grade_components(grade_id)`, and `grade_assessments(component_id)`.
- 0018 adds `admin_audit_log(created_at)`, `actor_id`, and `target_user_id` to support the paginated ordered admin log and FK embeds.
- 0008 adds indexes for message recipient/time, message ID, support ticket student/time, status, ticket-note ticket ID, and message time. 0020–0022 establish a unique semester owner/client ID pair. 0028 and 0030 add event/news indexes and uniqueness constraints.

The base schema is absent, so primary keys, all FKs, and indexes created outside these migrations cannot be fully inventoried. No live `pg_stat_user_indexes` data or query plan was available. No index can responsibly be called unused from this repository alone.

### Candidate index review (verify before migration)

| Candidate | Query evidence | Recommendation |
|---|---|---|
| `subjects(user_id)` vs. `subjects(user_id, source, setup_status)` | Migration 0029 adds the composite; 0014 adds the single-column index. | Possible prefix overlap for owner-only lookups, but the composite serves source/setup filters. Check sizes and `idx_scan` by query workload; do not remove either solely on this review. |
| Ordered planner collections | `cloud-sync.js` filters by owner and orders tasks/subjects by `created_at`, notes by `created_at DESC`, calendar/attendance by date, semesters by creation time. | Existing single-column owner indexes may still require sorts. Consider composite `(user_id, sort_column)` indexes only if `EXPLAIN` and live latency show a real benefit. |
| AI child lookup/FK indexes | Client filters messages by conversation, questions/attempts by quiz, cards by deck; RLS policies traverse parent ownership. | Verify base-schema indexes on `conversation_id`, `quiz_id`, `deck_id`, and related FKs. Add only if absent; these support child retrieval, cascades, and parent ownership checks. |
| Profiles/admin filters | Admin service filters/searches role, account status, and orders/paginates profile lists. | Base schema is missing; verify indexes against the actual admin queries and explain plans. |

No duplicate index is proven. The `event_date` and `(is_published,event_date)` indexes from 0028 have different leading columns and may serve distinct query shapes. Migration 0022 drops/replaces the prior semester conflict index, so no duplicate is evident from the sequence.

### Query/performance findings

1. **Unbounded hydration and `SELECT *` (HIGH).** Lines around 424–435 in `assets/js/data/cloud-sync.js` load 13 result sets with broad `select('*')`, most without `.range()`/pagination. The local API config caps rows at 1,000; a similarly configured hosted API may return only a page-sized subset. Large notes, task, attendance, or AI collections can exceed that and be silently incomplete unless the client explicitly pages and verifies counts. Broad selects also transfer data not needed by each view.
2. **N+1 style nested writes and reads (MEDIUM).** Grade sync fetches components per grade, assessments per component, and then performs individual upserts/deletes. Task checklist rows are deleted/reinserted per task. This raises round trips and creates partial-sync windows under latency/failure. Batch writes or a transactional RPC are options if measured sync duration warrants the extra complexity.
3. **Quiz attempts loaded as a nested unbounded relation (MEDIUM).** The quiz list requests latest quizzes but includes attempts for each quiz with no attempt pagination visible. Long-term attempts can make a small list response large.
4. **Ignored errors in some deletes (MEDIUM).** Several sync cleanup calls await delete operations without consistently checking returned error objects. This can leave stale child rows while the dirty snapshot advances; verify the surrounding control flow before changing it.
5. **No safe query plans.** No production `EXPLAIN` was run. Use `EXPLAIN (COSTS, VERBOSE, FORMAT JSON)` on representative SELECT statements in a staging or read-only session. Avoid `EXPLAIN ANALYZE` on production when query cost is unknown.

## E. Data integrity and security

### Data relationships and integrity

- Later migrations establish ownership checks on several FK-bearing tables, which is a positive control against a user attaching a row to another student's subject/grade/semester.
- Core foreign-key definitions, nullability, check constraints, and `ON DELETE` behavior are not reconstructible because the original DDL is missing. Therefore this report cannot certify all user-owned rows have valid, cascading parent relationships.
- Semester membership for synced planner records is partly represented in a browser-local map rather than a clear server-side FK relationship in the hydration logic. This creates cross-device and recovery risk: server rows alone may not preserve the intended local semester association.
- `syllabus_courses.data` JSONB is reasonable for a nested imported syllabus snapshot if the client treats it as a document. It should not duplicate authoritative queryable entities unnecessarily; current app sync use was not confirmed.
- `reset_my_planner_data()` in 0027 provides user-controlled cleanup for major planner and AI records. Admin rejected-account cleanup in 0006 predates later AI/preferences/cancelled-occurrence additions and uses an explicit table list; verify that rejected-account cleanup leaves no per-user rows if those tables can contain data before approval.

### RLS and privileged access

**Positive repository evidence:**

- Migration 0016 enables RLS across the known base table set and introduces cross-owner FK guard triggers.
- Migration 0025 adds a broad RLS safety net for public tables and protects profile role/status/review fields from self-editing.
- Migration 0013 fixes a prior self-promotion risk by reverting non-admin changes to privileged profile columns.
- Migrations 0008 and 0024 use admin/owner-gated policies and RPCs for support and grade hierarchies. Admin actions are audit logged.
- SECURITY DEFINER functions reviewed in committed SQL generally pin `search_path`; the QCU sync claim RPC is restricted to service role.
- No frontend service-role credential was found. Edge Functions retrieve privileged credentials from server environment variables.

**Unverified / residual risk:**

- The original RLS SQL for profiles and several core user tables is absent; prior security notes themselves indicate the exact policy catalog was not verified. A repository summary is not a substitute for querying live `pg_policies` and role grants.
- Migration 0017 grants broad table privileges to `authenticated` by default for future public objects. RLS remains the row boundary, but any future table created without RLS or an intended policy could expose data. The default function execute grant also raises risk for a future SECURITY DEFINER function unless it is explicitly revoked/restricted.
- RLS does not by itself guarantee privileged columns are protected; retain and verify the profile guard trigger for role, approval, and review metadata.
- Existing Storage buckets and `storage.objects` policies were not available in repository configuration. No app upload path means there is no verified student-file exposure path in this code, but production bucket state must still be inspected.
- AI processing security and retention cannot be assessed end-to-end: `ai-study` is called by the app but its implementation is not in `supabase/functions/` in this checkout.

No confirmed live cross-user data exposure was found. The correct conclusion is “strong static controls with critical live-state verification gaps,” not “RLS is proven safe.”

## F. Data retention recommendations

| Classification | Data | Recommended policy |
|---|---|---|
| Permanent / protected | Profiles and account decisions; grade/attendance/academic records; admin audit trail | Retain under institutional policy. Do not auto-delete grades, notes, or academic records. Define an export and account-closure process before deployment. Keep audit events immutable for a documented period. |
| User-controlled deletion | Notes, tasks, planner events, AI chats, quizzes, flashcard decks, attempts, preferences | Keep the existing reset/delete controls accurate; provide per-item deletion for AI history and clear user messaging about what reset covers. Preserve an export option for important student records. |
| Automatically cleanable | Stale QCU news cache; temporary generation state; operational logs | QCU shared cache can be pruned after an agreed interval (for example, 12–24 months) while keeping current articles. Delete transient generation rows only after confirming they are not user-owned saved results. Use scheduled job/Edge Function only for clearly nonessential data. |
| Archivable | Completed tasks and prior semesters; old generated study material | Offer user-controlled archive/filter/export. Keep archived academic records accessible; do not delete them automatically. |
| Temporary uploads | AI PDFs/images | Current reviewed client sends files in request payload and does not upload them to Supabase Storage. If a future flow stores them, use private per-user object paths, strict MIME/size checks, an explicit expiry/cleanup schedule, and delete objects on user deletion. |
| Support/admin messages | Tickets, internal notes, broadcast records | Set a policy aligned with support and institutional needs; do not silently purge active cases. Archive/soft-delete should have a documented physical cleanup period. |

No scheduled cleanup job for AI data, old news, or app-specific logs was found. Supabase platform log retention is plan-dependent and distinct from app database retention.

## G. Scalability forecast

These are **scenarios, not measurements**. Since no production data or live schema types were available, model a typical active student at **1 MiB of ordinary planner/academic rows + 2 MiB of AI chat/generated study records = 3 MiB total**. Illustrative uncertainty range: **0.5–2 MiB ordinary + 0.25–8 MiB AI = 0.75–10 MiB/student**. This range assumes modest text-centric use, not uploaded file bytes; large essays, OCR text, repeated generations, and index/tuple overhead can exceed it. Actual average must be measured after a pilot. MB uses 1 MiB here; Supabase quota accounting may use its own displayed unit/measurement convention.

| Students | Ordinary at 1 MiB/student | AI at 2 MiB/student | Base total | Scenario range total | Relationship to Free 500 MB |
|---:|---:|---:|---:|---:|---|
| 100 | 100 MiB | 200 MiB | 300 MiB | 75 MiB–1,000 MiB | Base fits, but high-use scenario exceeds Free. |
| 500 | 500 MiB | 1,000 MiB | 1,500 MiB (~1.46 GiB) | 375 MiB–5,000 MiB | Base exceeds Free by 3×. |
| 1,000 | 1,000 MiB | 2,000 MiB | 3,000 MiB (~2.93 GiB) | 750 MiB–10,000 MiB | Base exceeds Free by 6×. |
| 5,000 | 5,000 MiB | 10,000 MiB | 15,000 MiB (~14.65 GiB) | 3,750 MiB–50,000 MiB | Base exceeds Free by 30×. |
| 10,000 | 10,000 MiB | 20,000 MiB | 30,000 MiB (~29.30 GiB) | 7,500 MiB–100,000 MiB | Base exceeds Free by 60×. |

At the base scenario, 500 MiB would be consumed around 167 students before accounting for schema/system overhead, indexes, growth buffer, and uneven AI adoption. A prudent operating ceiling is lower. AI records contribute about two-thirds of the base scenario; the biggest growth control is retention and user deletion for AI history/attempts, not moving PDFs to a database table (the reviewed code does not do that).

PostgreSQL database usage is separate from Storage object usage. If uploaded files are introduced later, estimate that quota independently based on file count, size, and retention.

## H. Provider comparison

Provider prices/limits are current official documentation reviewed 2026-11-23; they can change and production-region/compute choices affect actual bills.

| Provider | Storage / price snapshot | Fit for this app | Migration and operations |
|---|---|---|---|
| **Supabase Free** | 500 MB database, 1 GB Storage, 50k MAU, 5 GB egress; projects pause after one week inactivity; no automatic backups. | Good for development/pilot. Weak for production academic records due to tight DB headroom, pause behavior, and manual backup requirement. | Existing stack fits exactly. Lowest migration work. [Official pricing](https://supabase.com/pricing) |
| **Supabase Pro** | From $25/month; 8 GB database, 100 GB Storage, daily backups retained 7 days, higher quotas; overages/compute choices apply. | **Recommended for first production.** More reasonable database runway and built-in daily DB backup while retaining the current integrated stack. Still needs independent backup/export and tested restore. | No provider migration. Check spend caps, region, compute, quota alerts. Database backups exclude Storage objects. [Pricing](https://supabase.com/pricing), [backups](https://supabase.com/docs/guides/platform/backups) |
| **Neon** | Current official 2026 announcement: Free 1 GB/project and 100 CU-hours/project/month; paid usage-based compute, with current Launch compute at $0.106/CU-hour and storage $0.35/GB-month per official pricing update. Verify exact current details before budgeting. | Attractive managed Postgres and branching/scale-to-zero, but not a drop-in replacement for the existing Supabase platform. | PostgreSQL data migration is manageable; Auth, PostgREST client/RLS integration, Storage, and Edge Functions must be replaced or separately hosted. More integration work for little benefit at current stage. [Neon current limits](https://neon.com/blog/neon-free-plan-1-gb-per-project), [pricing update](https://neon.com/blog/making-pricing-more-predictable) |
| **Amazon RDS for PostgreSQL** | Compute, provisioned storage, backup, and transfer costs vary by region, instance, HA, and usage; use AWS calculator for a real estimate. | Mature managed PostgreSQL with a broad scale path; sensible if QCU later has AWS operations/hosting standards. | No built-in replacement for Supabase Auth, Storage, API, or Edge Functions. Requires backend/API, auth, connection pool, RLS/JWT claims, secrets, and file storage integration. [AWS RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/) |
| **Google Cloud SQL for PostgreSQL** | Compute, memory, storage, backups, and network are billed separately by region/edition. Official page lists SSD storage from $0.17/GB-month and compute from $0.0413/vCPU-hour (region/edition dependent); $300 new-customer credits are promotional. | Robust managed PostgreSQL with configurable backups/HA; more operational ownership than Supabase. | PostgreSQL compatibility is high; Supabase Auth/API/Storage/Edge Functions would need replacements. More complex for a student-built app without an existing GCP backend. [Cloud SQL pricing](https://cloud.google.com/sql/pricing) |

**Recommendation:** stay with Supabase and use Pro for first production. Reassess storage/compute after collecting real 30–90 day metrics and a pilot cohort. Do not migrate to Neon solely for a larger free quota; provider replacement also means rebuilding or replacing Auth, Storage, API/RLS integration, and Edge Function paths.

## I. Prioritized findings

“Requires migration” refers to a likely schema/policy/code deployment change if the finding is confirmed. This audit itself made no such changes.

### HIGH

#### H1 — No complete reproducible database baseline

- **Affected:** `supabase/migrations/0001–0030`, core tables, AI tables/RPCs, Edge Functions.
- **Evidence:** `DATABASE_MIGRATION_REPORT.md` states base tables were created outside migrations; only a subset of tables has `CREATE TABLE` in committed migrations. Frontend calls `save_ai_chat_turn`, `save_ai_quiz`, and `save_ai_flashcard_deck`, but definitions are absent. Client invokes `ai-study`, whose function implementation is not in this checkout.
- **Impact:** a fresh environment or disaster recovery cannot reliably rebuild the database and AI backend from source; migrations may fail on an empty database, and security/retention behavior for AI processing is opaque.
- **Recommended solution:** capture a sanitized canonical schema/migration baseline and commit all required database function and Edge Function source (without credentials); test a clean restore in staging.
- **Requires schema migration:** likely yes for baseline reconciliation; audit finding alone does not prescribe changing live schema.

#### H2 — Backup and restore readiness is insufficient for production

- **Affected:** deployment/operations; Free plan; any future Storage buckets.
- **Evidence:** no backup schedule, off-site export, restore runbook, or restore test was found in repository docs. Supabase says Free has no automatic backups; Pro daily backups retain seven days. Platform DB backups do not contain Storage objects. [Official backup documentation](https://supabase.com/docs/guides/platform/backups)
- **Impact:** accidental deletion, migration error, project loss, or provider incident may cause unrecoverable student data loss; object data can be missing even when database metadata restores.
- **Recommended solution:** before real student data, enable Pro backups or automated encrypted off-site `supabase db dump`/`pg_dump`, version schema and document restore steps. Restore to an isolated staging project periodically. Back up Storage objects separately if any buckets are used.
- **Requires schema migration:** no; operational configuration/runbook.

#### H3 — Live RLS and ownership policies are not independently verified

- **Affected:** `profiles`, planner and AI tables, Storage policies, privileged profile fields.
- **Evidence:** 0016/0025 show safety controls, but base RLS SQL predates this repository; previous audit notes say policy definitions were not directly verified from `pg_policies`. No live database was available. Storage bucket policies are absent from repo.
- **Impact:** a mismatch between deployed state and migrations could expose student records or allow unauthorized changes; the audit cannot certify isolation from static files alone.
- **Recommended solution:** run the read-only catalog queries above on the production project; test as anonymous, pending student, approved student A, approved student B, and admin using non-sensitive test accounts. Confirm Storage policies and profile privilege guards. Keep test evidence in deployment records.
- **Requires schema migration:** unknown; only if live verification finds gaps.

#### H4 — Unpaginated whole-collection sync and broad column selection

- **Affected:** `assets/js/data/cloud-sync.js` hydration (subjects, tasks, checklist items, calendar events, notes, attendance, grades and child rows, GWA, semesters).
- **Evidence:** queries around lines 424–435 use `select('*')` and no pagination. `supabase/config.toml` sets local `api.max_rows = 1000`; cloud setting is unknown.
- **Impact:** larger users may receive partial collections at the API row ceiling; repeated logins transfer all history and large text fields, increasing latency, egress, memory, and apparent missing data.
- **Recommended solution:** paginate deterministically by primary key/created date, request only needed columns, surface incomplete/error states, and measure representative syncs. Ensure collection counts are checked before merging local/cloud state.
- **Requires schema migration:** usually no; possible composite indexes after plan review.

#### H5 — Default privileges make future tables/functions easy to expose accidentally

- **Affected:** migration 0017 default privileges in public schema.
- **Evidence:** `ALTER DEFAULT PRIVILEGES` grants `authenticated` rights to future tables/sequences/functions. Existing tables have RLS safety work, but a new table without RLS or a new SECURITY DEFINER RPC without explicit revoke can be overexposed/callable.
- **Impact:** future migrations can silently widen the attack surface if developers assume grants are restrictive by default.
- **Recommended solution:** review default grants and choose least-privilege defaults; require every new table migration to enable RLS and define policies, and every SECURITY DEFINER function to explicitly revoke PUBLIC/anon/authenticated as appropriate. Add this to migration review checklist and verify in catalogs.
- **Requires schema migration:** yes, if changing existing default privileges; also process/documentation.

### MEDIUM

#### M1 — AI records can grow without a database retention cap

- **Affected:** AI chat messages, quizzes/questions/attempts, flashcards; AI stores and missing RPC definitions.
- **Evidence:** UI lists are limited to 50 parent records, but that is not a deletion/retention policy. Chat history query returns a conversation's messages; quiz list loads related attempts. No cleanup job or schema/RPC retention cap found.
- **Impact:** AI content can dominate per-user storage and response payloads. The scenario model assigns two-thirds of typical usage to AI records, with high uncertainty.
- **Recommended solution:** add user-visible per-record deletion/export and define retention for abandoned drafts/attempts; preserve saved study sets unless user deletes them. Measure average payload/rows before choosing automatic cleanup. Consider moving only genuinely large immutable assets to object storage, not routine short text.
- **Requires schema migration:** possibly, if adding retention metadata/indexes or cleanup support; user deletion controls may be app-only.

#### M2 — Semester mapping depends on browser-local state

- **Affected:** `assets/js/data/cloud-sync.js` keys `sp_cloud_semester_map`, `sp_cloud_server_semester_id`; planner records and `semesters`.
- **Evidence:** server hydration reconstructs semester IDs with `semFor(...)`; local-to-server associations are stored in `localStorage`, with fallback to local active semester.
- **Impact:** a new device or cleared browser storage can lose the intended semester assignment even when rows exist in PostgreSQL, creating inconsistent cross-device academic organization.
- **Recommended solution:** store the semester association durably in the server row/relationship and make migration/rehydration deterministic. Confirm existing schema FK and ownership constraints first.
- **Requires schema migration:** likely.

#### M3 — Nested grade/task sync performs many round trips and can partially apply

- **Affected:** `cloud-sync.js` grade components/assessments and task checklist writes/deletes.
- **Evidence:** repeated per-parent/per-child selects, upserts, and deletes; not one atomic transaction. Some delete responses are awaited without consistently checking errors.
- **Impact:** slower sync at scale and partial state when a mid-sequence call fails.
- **Recommended solution:** first fix explicit error checking and add retry/reconciliation. Batch writes; use a transaction/RPC only if measurements show need and after the missing RPC source/recovery story is addressed.
- **Requires schema migration:** optional/likely if implementing transactional RPC.

#### M4 — Admin rejected-account cleanup may not cover later user-owned tables

- **Affected:** `admin_delete_rejected_account()` in migration 0006 vs tables added later (AI, preferences, cancellation state).
- **Evidence:** 0006 explicitly deletes a fixed list of then-existing planner tables; 0026–0027 and AI policies arrive later. Separate user reset function 0027 includes later data, but rejected-account cleanup was not shown updated.
- **Impact:** if rejected users can create rows in newly added user tables, deletion may fail on FKs or leave orphaned rows. Approval policies may make this unlikely, but it should be verified rather than assumed.
- **Recommended solution:** reconcile the deletion function's table list with current schema and test it using a disposable rejected test account; retain audit snapshot behavior.
- **Requires schema migration:** likely if omissions are confirmed.

#### M5 — Storage configuration and ownership are not auditable from repository

- **Affected:** Supabase Storage buckets and policies.
- **Evidence:** local config contains a 50 MiB global cap; no bucket definition, Storage policy migration, or client upload API use was found. Dashboard state may differ.
- **Impact:** if buckets exist, public access, broad object policies, unlimited file sizes, or orphaned objects cannot be ruled out. Database backup alone would not back up objects.
- **Recommended solution:** inventory production buckets and `storage.objects` policies; use private per-user folders and server-validated MIME/size limits; ensure delete flows remove objects and establish object backup/expiry policies.
- **Requires schema migration:** no for bucket setup/policies, but policy/config changes may be required.

#### M6 — Unbounded support/audit/news retention needs an explicit policy

- **Affected:** `admin_audit_log`, support tickets/messages, `qcu_news_articles`.
- **Evidence:** audit is append-only; no scheduled cleanup found. QCU sync upserts bounded pages but does not prune old article rows. Support data is retained by default.
- **Impact:** operational tables grow indefinitely and privacy retention expectations remain undocumented; likely less storage impact than AI history.
- **Recommended solution:** establish institutional retention and legal owner first; archive/expire shared news cache after an agreed age; retain audit/support records according to policy rather than generic deletion.
- **Requires schema migration:** maybe for archive/expiry mechanics.

### LOW

#### L1 — Possible subjects index overlap

- **Affected:** `subjects(user_id)` from 0014 and `subjects(user_id, source, setup_status)` from 0029.
- **Evidence:** the composite begins with `user_id`, so it can overlap owner-only lookups, but it also supports setup filters.
- **Impact:** duplicate maintenance/storage overhead if single-column index has no meaningful workload.
- **Recommended solution:** inspect live index sizes/usage and query plans after representative load; consolidate only if evidence supports it.
- **Requires schema migration:** yes if an index is removed/replaced.

#### L2 — Local-only records may not be backed up centrally

- **Affected:** localStorage state such as Pomodoro or legacy university event/cancellation data.
- **Evidence:** `storage.js` remains localStorage-based; existing audit notes identify some feature tables as unused by current frontend cloud path.
- **Impact:** browser loss can lose data that a student may believe is account-synced.
- **Recommended solution:** document local-only behavior or wire selected important data to cloud sync with ownership policies and restore coverage.
- **Requires schema migration:** possibly; depends on desired product behavior.

## J. Recommended action plan

### 1. Must fix before production

1. Establish canonical schema and all required database/Edge Function source, including AI RPC definitions and `ai-study`; verify an empty staging project can be built and seeded from repository artifacts.
2. Inspect deployed RLS state and policies for every public table and Storage bucket. Test access as anon, pending, two distinct approved students, and admin.
3. Set up automated/off-site database backup and a separate Storage object backup if any bucket exists; document and perform a staging restore before real student data.
4. Fix or explicitly guard the whole-collection unpaginated sync before student cohorts can exceed practical collection sizes. Make truncation detectable.
5. Use Supabase Pro for production unless this is a tightly controlled short pilot with explicit backup/export coverage and a hard cohort cap. Configure usage alerts and monitor database/storage quota.

### 2. Should fix before public release

1. Make semester associations server-authoritative and verify migration/ownership constraints.
2. Define AI record deletion and retention behavior; add per-item user deletion and a clear account export/reset scope.
3. Verify rejected-account cleanup covers all current user-owned tables and test the procedure in staging.
4. Review future default grants and require RLS/policy review for every new table and SECURITY DEFINER function.
5. Audit live Storage buckets, allowed MIME types, size limits, private/public access, and object deletion behavior.

### 3. Can implement after deployment

1. Measure and tune composite indexes based on observed `pg_stat_user_indexes` and representative `EXPLAIN` plans.
2. Batch nested task/grade sync operations if network latency and error rates justify it.
3. Define archival/expiry for QCU news and support/audit records with the relevant institutional owner.
4. Clarify which planner features are browser-local versus account-backed and communicate this in product UX.

### 4. Future scaling improvements

1. Track per-user database growth, AI contribution, largest relations/TOAST, index bloat, sync time, and API row counts monthly.
2. Add explicit database-side pagination/cursor APIs for long histories and optimize parent-child query patterns.
3. Reassess Pro compute/storage, read replicas, or provider architecture as multi-campus usage becomes real; maintain Supabase integration while its Auth/RLS/Storage/Edge Functions reduce operational burden.
4. For multi-campus scale, formalize campus/tenant ownership and authorization boundaries before introducing cross-campus administration.

## Audit limitations and verification checklist

- No live database connection or Supabase read-only connector was available. No actual row counts, bytes, indexes-in-use, EXPLAIN plans, backup settings, or live bucket policies were observed.
- No production credentials were requested or used. Never provide a service-role key for this audit.
- Existing workspace changes were left untouched; this report is the only file created for this audit.
- Before sign-off, run the read-only SQL in §C, inspect Storage settings, confirm backup configuration, verify deployed function source, and record restore-test evidence.

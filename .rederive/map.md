# Decision map
repo: qcu-student-planner | built from: a73e6f2 | date: 2026-11-23
root problem: This is an academic project for one of our major subjects. We are a group of students, and we built it because many students have trouble managing their academic information. It is a web application for QCU students to manage tasks, subjects, calendar dates, notes, curriculum tracking and related information.

## D1. Keeping a student's semester information together
- Problem: A student needs their classes, deadlines, notes and progress to work together.
- Given: One student uses a browser to plan a semester.
- Constraints, in order:
  1. Different views need overlapping records -> breaks: independent copies of subjects, tasks and dates on each page.
  2. Each record needs to remain editable from the places it appears -> breaks: a display-only combined view.
- Decision: Shared domain state — pages work on common records; schedule, calendar and tasks reuse subject/task editing workflows.
- Options: Separate page-specific copies (simple, divergent); one shared record set with separate page logic (consistent, coordination cost); one giant page module (shared, tightly coupled).
- Evidence: commit db17efc "refactor: share subject and task modals across pages", files assets/js/shared/subject-modal.js and assets/js/shared/task-modal.js.
- Where: assets/js/shared/subject-modal.js::openSubjectModal — shared subject editing; assets/js/shared/task-modal.js::openTaskModal — shared task editing; assets/js/modules/calendar.js::openScheduleModal — calendar entry point.

## D2. Preserving a student's work across visits and devices
- Problem: Semester records should still be there after leaving the page and should follow the student across signed-in devices.
- Given: Records are edited in the browser and the app has a database service.
- Constraints, in order:
  1. A network may be absent or slow -> breaks: waiting for every save before showing local changes.
  2. Local edits and server records can differ -> breaks: blindly replacing one copy with the other.
  3. A user must know when a save failed -> breaks: silent background sync.
- Decision: Local-first synchronization — browser storage gives immediate access while queued changes hydrate and push to the cloud, with dirty tracking and visible sync errors.
- Options: Cloud-only (one canonical copy, network required); local-only (works offline, device-bound); local-first sync (responsive and cross-device, conflict handling required).
- Evidence: code only, assets/js/data/cloud-sync.js and assets/js/data/storage.js.
- Where: assets/js/data/cloud-sync.js::hydrate — merge server/local state; assets/js/data/cloud-sync.js::pushTasks — persist local task changes; assets/js/data/storage.js::DB — browser-side records.

## D3. Deciding who may use student records
- Problem: Students need private records and the institution needs a way to review new accounts.
- Given: People sign in through an identity provider; records live in a shared database.
- Constraints, in order:
  1. Knowing who signed in does not mean an account is approved -> breaks: granting every authenticated user the planner immediately.
  2. Browser code can be altered -> breaks: trusting only the page's role check.
  3. Students should only access their own records -> breaks: broad table access.
- Decision: Approval-gated, row-scoped authorization — account status gates entry and database policies enforce role and owner checks.
- Options: Open registration (low friction, no review); UI-only role checks (simple, bypassable); server/database-enforced status and ownership (stronger, more policy work).
- Evidence: commit faaa5b0 "make the login & signup work and wired to the database, and add authentication" and commit a6f79e7 "fix migrations 0024 and add migration 0025 for authorization and row level security (RLS)."
- Where: assets/js/services/auth-service.js::AuthService — identity and profile status; assets/js/modules/admin-guard.js::requireAdmin — admin page gate; supabase/migrations/0025_privileged_profile_columns_and_rls_safety_net.sql — database-side boundaries.

## D4. Sharing university dates without giving every student edit rights
- Problem: University-wide dates should appear for everyone and stay consistent, while students retain control of their personal calendar.
- Given: A calendar combines student-created and institution-wide dates.
- Constraints, in order:
  1. Student edits must not change official dates for everyone -> breaks: storing university dates as ordinary personal events.
  2. Dates must appear in each student's calendar -> breaks: an admin-only calendar that students cannot read.
- Decision: Centrally managed shared reference data — administrators publish events and student calendar treats them as read-only.
- Options: Each student enters dates (flexible, inconsistent); administrator sends announcements (central, not calendar-native); shared admin-managed event records (consistent, extra access rules).
- Evidence: commit 612f61f "instead of the user who will input the university events,it is now manage only by the admin in the admin page, and all dates that added there will reflect in the student calendar and it is read-only.", files assets/js/modules/admin-university-events.js and assets/js/modules/calendar.js.
- Where: assets/js/modules/admin-university-events.js::saveEvent — admin event writes; assets/js/modules/calendar.js::allEventsForDate — calendar event aggregation; supabase/migrations/0028_university_events.sql — shared event storage/access.

## D5. Performing administrative actions with a trustworthy audit trail
- Problem: Account decisions and support work affect other users and need accountability.
- Given: Administrators use the same browser app as students.
- Constraints, in order:
  1. A user can tamper with client requests -> breaks: authorization enforced only in the interface.
  2. Sensitive actions need to be attributable -> breaks: direct unlogged table updates.
  3. Privileged credentials must stay private -> breaks: putting a service-role key in browser code.
- Decision: Server-side privileged operations — database functions enforce admin rights and log actions; a narrow Edge Function handles account deletion.
- Options: Client-side mutations (simple, untrusted); direct privileged service from browser (convenient, credential exposure); server-side guarded operations with audit (safer, more moving parts).
- Evidence: code only, assets/js/services/admin-service.js, supabase/migrations and supabase/functions/admin-delete-account/index.ts.
- Where: assets/js/services/admin-service.js::AdminService — admin operation boundary; supabase/functions/admin-delete-account/index.ts — privileged account deletion.

## D6. Estimating academic progress from incomplete records
- Problem: A student needs a useful picture of progress through a program even when some past grades or enrollment details are missing.
- Given: A curriculum lists expected courses; the student has profile, semester, subject and grade records.
- Constraints, in order:
  1. A course record may be imported but not fully set up -> breaks: counting every imported course as active enrollment.
  2. Grades and semester context may be partial or conflicting -> breaks: treating every apparent pass or elapsed semester as certain.
  3. Students may know their history better than the available data -> breaks: a tracker that cannot be corrected.
  4. Repeated curriculum codes should not inflate totals -> breaks: counting duplicates as separate requirements.
- Decision: Evidence-aware status inference with user overrides — combine grade and enrollment evidence, flag uncertainty, permit correction, and count each curriculum course once.
- Options: Infer solely from year/semester (complete-looking, may be wrong); require students to set every status (accurate if maintained, burdensome); infer from multiple records with verification and overrides (useful, more logic).
- Evidence: code only, assets/js/modules/curriculum.js.
- Where: assets/js/modules/curriculum.js::trackerClassify — infer course state; assets/js/modules/curriculum.js::trackerBuildModel — deduplicate requirements; assets/js/modules/curriculum.js::trackerSetStatus — save user corrections; assets/js/modules/curriculum.js::trackerContextHtml — report context and uncertainty.

## D7. Making many planner tools usable across screen sizes
- Problem: Students need to move among many planner pages on both phones and larger screens.
- Given: The same application has grouped student and administrator pages.
- Constraints, in order:
  1. A desktop navigation column consumes too much room on a phone -> breaks: simply shrinking the desktop menu.
  2. Mobile users still need clear destinations and a way back to their place -> breaks: hiding navigation or opening an unstructured list.
  3. Desktop users benefit from persistent orientation -> breaks: replacing desktop navigation with a mobile-only drawer everywhere.
- Decision: Responsive navigation modes — keep destinations and groupings consistent while changing how navigation is presented for each screen size.
- Options: One compressed sidebar (consistent, cramped); separate unrelated navigation designs (space-appropriate, inconsistent); shared page model with tailored mobile and desktop navigation (usable, requires coordination).
- Evidence: commit bbd1a62 "Improve student navigation and mobile layout", files assets/js/core/layout.js and assets/css/layout/mobile-navigation.css.
- Where: assets/js/core/layout.js::renderShellBar — desktop/mobile shell header; assets/js/core/layout.js::ensureMobileAppNavMenu — grouped mobile destinations; assets/js/core/layout.js::openMobileAppNavMenu — open and focus navigation.

## D8. Providing AI study features through a controlled service boundary
- Problem: Students want generated study help, while requests need session checks, limits and understandable failures.
- Given: The browser collects prompts, conversation context and optional files; an AI service generates results.
- Constraints, in order:
  1. A private model credential must not ship in browser code -> breaks: calling the model provider directly from the page.
  2. Requests can be oversized, unauthenticated, slow or unavailable -> breaks: sending arbitrary requests and exposing raw failures.
  3. Assistant context can grow without bound -> breaks: resending every previous turn on each message.
- Decision: Authenticated AI service boundary — send bounded feature requests through a backend function and trim conversation context before sending.
- Options: Call provider from browser (simple, secret exposure); omit AI and use fixed material (safe, not generative); call a session-checked backend with request limits and clear errors (safer, extra service work).
- Evidence: code only, assets/js/services/ai-service.js; README notes the deployed `ai-study` Edge Function source is not in this repository.
- Where: assets/js/services/ai-service.js::callAiBackend — session check, limits and backend invocation; assets/js/services/ai-service.js::buildAssistantPrompt — bounded conversation context; assets/js/services/ai-service.js::describeInvokeError — student-facing failure messages.

## D9. Turning assessment records into comparable grade summaries
- Problem: Students need a useful grade per subject and semester from scores entered at different times and under different grading components.
- Given: Each subject can have weighted components, and each component can have multiple assessments with scores and total items.
- Constraints, in order:
  1. Many components begin with no scores -> breaks: treating blank components as zero.
  2. Students need early estimates before every component is scored -> breaks: refusing to calculate until all inputs are complete.
  3. Different pages display the same academic result -> breaks: each page implementing its own formula.
  4. Percentages must map to the university's grade-point bands -> breaks: treating a percentage and grade point as interchangeable.
- Decision: Shared pure grade calculations — compute assessment percentages, scored-component weighted averages, grade-point conversion and unit-weighted semester averages in one reusable logic layer.
- Options: Count missing components as zero (pessimistic); wait for all components (accurate only at end, no current estimate); normalize over scored weights and share one conversion formula (useful current estimate, needs clear incompleteness cues).
- Evidence: commit e11aab2 "Fix calculations across dashboard, grades, schedule, tasks, attendance", file assets/js/services/gwa.js.
- Where: assets/js/services/gwa.js::assessmentPct — normalize assessment score; assets/js/services/gwa.js::computeSubjectFinalPct — aggregate scored components; assets/js/services/gwa.js::percentToGWA — convert scale bands; assets/js/services/gwa.js::computeSemesterGWA — unit-weighted semester result.

## D10. Firing reminders from planner data without duplicate alerts
- Problem: Students want timely class, deadline and attendance reminders derived from their own planner records.
- Given: Their browser has current planner data, reminder preferences and notification permission.
- Constraints, in order:
  1. The app has no server that sends a notification at a scheduled time -> breaks: expecting alerts while every app page is closed.
  2. The open app checks repeatedly -> breaks: sending the same alert every time the check runs.
  3. Each reminder must follow current task, class and attendance rules -> breaks: maintaining separate guessed reminder data.
- Decision: Foreground polling with stable-key deduplication — check live planner records while an app page is open, send eligible notifications, and remember recently fired reminder keys.
- Options: Scheduled server push (works while closed, needs server infrastructure); check only when opening a page (simple, may miss exact timing); poll while app is open and deduplicate (timely in-session, stops when closed).
- Evidence: code only, assets/js/core/notification-engine.js and assets/js/core/layout.js.
- Where: assets/js/core/notification-engine.js::checkUpcomingClasses — class reminders from schedules; assets/js/core/notification-engine.js::checkTaskReminders — due-date checks; assets/js/core/notification-engine.js::markFired — deduplicate and expire sent reminders; assets/js/core/notification-engine.js::start — run checks on a timer and when the page returns.

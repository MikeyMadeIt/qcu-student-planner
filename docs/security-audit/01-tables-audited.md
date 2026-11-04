# Tables Audited

Source: live production schema/RLS dump supplied for this audit (authoritative over `supabase/migrations/*.sql`, whose earliest files are incremental patches on a base schema created before the migrations folder existed).

## Per-student tables (own `user_id` column, expected to be isolated per student)

| Table | Ownership column | RLS pattern observed |
|---|---|---|
| `user_settings` | `user_id` | `(user_id = auth.uid()) AND is_approved()`, ALL |
| `semesters` | `user_id` | same pattern |
| `subjects` | `user_id` | same pattern |
| `tasks` | `user_id` | same pattern |
| `task_checklist_items` | none (FK → `tasks.id`) | ownership via join to `tasks.user_id` |
| `notes` | `user_id` | same pattern |
| `calendar_events` | `user_id` | same pattern |
| `pomodoro_stats` | `user_id` | same pattern |
| `attendance` | `user_id` | same pattern |
| `grades` | `user_id` | same pattern |
| `grade_components` | none (FK → `grades.id`) | ownership via join to `grades.user_id` |
| `grade_assessments` | none (FK → `grade_components.id` → `grades.id`) | ownership via nested join |
| `gwa_calculator` | `user_id` | same pattern |
| `syllabus_courses` | `user_id` | same pattern |
| `syllabus_weeks` | none (FK → `syllabus_courses.id`) | ownership via join |
| `syllabus_topics` | none (FK → `syllabus_weeks.id` → `syllabus_courses.id`) | ownership via nested join |
| `push_subscriptions` | `user_id` | same pattern |

## Shared / admin-managed tables (correctly have no `user_id`, left unchanged)

`university_events`, `university_resources`, `curriculum_courses`, `university_directory`, `student_services` — admin-write, approved-student-read policies already present and appropriate; no per-row ownership exists or should exist for these.

## Account / auth / admin-workflow tables

`profiles`, `admin_audit_log`, `admin_messages`, `admin_message_recipients`, `support_tickets`, `support_ticket_notes` — audited for privilege-escalation and insert-path issues (see `03-vulnerabilities-and-fixes.md`).

## Functions / triggers reviewed

`is_admin()`, `is_approved()`, `handle_new_user()`, `submit_profile_details()`, `set_account_status()`, `admin_send_message()`, `set_message_read_status()`, `submit_support_report()`, `admin_delete_rejected_account()`, and the `admin-delete-account` Edge Function.

## Frontend inspected

All files under `assets/js/core/`, `assets/js/services/`, `assets/js/modules/` (excluding the three AI modules), and `pages/app/*.html` were grepped for `supabase.from(`, `.insert(`, `.update(`, `.delete(`, `service_role`, and ownership-field usage.

**Key observation that changes the shape of this audit** — see the README for details: the eight in-scope planner features (Tasks, Schedule, Calendar, Subjects, Grades/GWA, Attendance, Syllabus, Notes) have **no Supabase calls anywhere in their frontend code**. They read/write exclusively through `assets/js/data/storage.js`, a `localStorage`-only data layer. Only the auth/profile/admin/messaging/support-ticket subsystem (`auth-service.js`, `admin-service.js`, `student-service.js`, `curriculum.js` for the shared reference tables) actually talks to Supabase.

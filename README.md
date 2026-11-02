# 📘 QCU Student Planner — PWA

A premium, offline-first Student Planner Progressive Web App built with **HTML5, CSS3, Bootstrap 5.3, and vanilla JavaScript**. Authentication, profile/admin workflows, and all planner records (subjects, tasks, notes, grades, attendance, calendar, syllabus, GWA, settings, admin inbox, and support tickets) are stored in the configured Supabase project and protected by Row Level Security. The browser's `localStorage` is used only for device-local state (theme/UI preferences, cached copies of your own cloud data for offline/fast reload, and one-time migration/seed flags) — see [Data & Privacy](#️-data--privacy).

---

## ✨ Features

- **Dashboard** — live clock & greeting, today's schedule, next-class countdown, today's tasks, upcoming deadlines, assignment/attendance/GPA stats, weekly productivity chart, semester progress, quick notes, habit tracker, Pomodoro timer, daily quote
- **Schedule Manager** — full subject CRUD (code, days, time, room, professor, color, etc.), card / weekly timetable / timeline views, search, filter, sort, duplicate & archive
- **Calendar** — month / week / day views combining classes and tasks
- **Tasks & Assignments** — homework, projects, quizzes, exams; priority, checklist, progress, score & remarks; list view and drag-and-drop kanban board; completed history
- **Grade Tracker** — quiz / activity / lab / project / midterm / finals entry with automatic average, GPA (4.0 scale), and subject ranking
- **Attendance Tracker** — present / absent / late / excused logging with attendance rate and subject ranking
- **Notes** — lightweight markdown (bold, italic, headings, checklists, code), pin, favorite, search
- **Wallpaper Generator** — canvas-based lock-screen wallpapers from your live schedule in 8 themes (Minimal, Dark, Glassmorphism, Gradient, Neon, Cyberpunk, Pastel, AMOLED), multiple resolutions, PNG/JPG export
- **Settings** — student profile, semester dates, Dark/Light/AMOLED themes with 5 accent colors, notification toggles, export/import/reset data
- **Notifications** — dedicated task-reminder inbox with unread/read filters and persistent read state; the header shows a quick preview
- **Inbox** — one-way messages from administrators (announcements, updates, reminders, maintenance notices): read, search/filter, unread badges in the header and sidebar, mark read/unread — students cannot reply or message each other
- **Report** — submit a support ticket to the admins (category, subject, description) and track your own report history and status
- **Installable PWA** — manifest + service worker, offline caching, "Install App" prompt
- **Mobile-first** — responsive down to small phones, bottom nav with a "More" sheet so every page is always reachable

---

## 🚀 Getting Started

This is a static site — no build step, no bundler, no framework. `package.json` exists only to provide the optional local-dev `start` script below; there is nothing to `npm install` (no dependencies are declared) and no automated test suite.

### Option 1: Just open it
Open `index.html` (or `pages/app/dashboard.html`) directly in a browser. Most features work, but **installing as a PWA and the offline service worker require a real HTTP origin** (browsers block service workers on `file://`).

### Option 2: Serve it locally (recommended)
```bash
# from the project folder
python3 -m http.server 8080
# then visit http://localhost:8080
```
or with Node (uses the `start` script in package.json, which runs `npx serve .`):
```bash
npm start
```

### Option 3: Deploy it
Drop the folder as-is onto any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages, or a plain web server. No server-side code or environment variables needed for the static frontend itself (see below for the Supabase backend). The included `vercel.json` adds legacy-URL redirects and a few security/cache headers for a Vercel deployment; it is not required on other hosts.

### Connecting your own Supabase project
The frontend's Supabase URL and anon (public, RLS-gated) key live in `assets/js/core/config.js`. To point this app at your own Supabase project, replace the placeholder values there with your own project's URL and anon key — never a `service_role`/secret key, which must only ever live server-side (see `supabase/README.md`). Then apply the database migrations and deploy the Edge Function as described below.

---

## 📂 Project Structure

```
qcu-student-planner/
├── index.html  manifest.json  service-worker.js  vercel.json  package.json
├── CODEBASE_AUDIT_REPORT.md   SECURITY_AUDIT.md   LICENSE
├── pages/
│   ├── auth/   login, register, forgot/reset password, verify, pending, callback, finish-profile
│   ├── app/    dashboard, schedule, calendar, tasks, grades, attendance, notes, syllabus,
│   │           curriculum, university, wallpaper, inbox, notifications, settings,
│   │           AI tools (flashcards, quiz, study assistant, reviewer, summarizer), help, report
│   └── admin/  dashboard, verification, users, rejected, activity-log, inbox, tickets,
│               announcements, email, settings, reports
├── assets/
│   ├── css/    base/ (reset, typography, variables, utilities)  layout/  components/
│   │           pages/ (one stylesheet per page)  themes/ (light, dark, amoled, accents)
│   ├── js/     core/ (config, supabase client, theme, layout, pwa, ui)
│   │           data/ (storage, cloud-sync, registration options)
│   │           services/ (auth, admin, student, AI, gwa, attendance-stats)
│   │           modules/  (one controller per page)   utils/ (dom, dates, validation, sanitize, auth helpers)
│   ├── data/   assets/data/registration-options.json (college/program picklists)
│   ├── icons/  PWA icons (regular + maskable)
│   └── images/ branding, campus, and college images
├── supabase/
│   ├── migrations/   numbered SQL migrations (schema/RLS/functions) — see supabase/README.md
│   ├── functions/    admin-delete-account Edge Function
│   ├── README.md               deployment guide for the Supabase half
│   └── SECURITY_VALIDATION.md  manual security test checklist
└── docs/security-audit/   data-isolation audit notes (tables audited, policy changes,
                            vulnerabilities & fixes, migration instructions, test checklist)
```


---

## 🧰 Backend setup (Supabase)

The `supabase/` folder is the full server-side half of the app:

- `supabase/migrations/*.sql` — numbered, idempotent SQL migrations (schema changes, RLS policies, triggers, `SECURITY DEFINER` functions). Apply them **in filename/numeric order** — either with the Supabase CLI (`supabase link --project-ref <your-ref> && supabase db push`) or by pasting each file into the Supabase Dashboard's SQL Editor in order. See `supabase/README.md` for the full walkthrough, including why certain migrations exist (grant fixes, RLS hardening, etc.).
- `supabase/functions/admin-delete-account/` — one Edge Function, used only for an admin's permanent-delete-rejected-account action. Deploy with `supabase functions deploy admin-delete-account --project-ref <your-ref>` and set its `SERVICE_ROLE_KEY` secret as documented in `supabase/README.md`. This is the only place a service-role key is ever used, and it must never be placed in any frontend file.
- `supabase/SECURITY_VALIDATION.md` and `docs/security-audit/*.md` — the project's security review notes and manual verification checklist; read these before changing anything RLS-related.

This repository's migrations do not include a `CREATE TABLE` for the core planner tables (`profiles`, `subjects`, `tasks`, `notes`, `calendar_events`, `attendance`, `grades`, `syllabus_courses`, etc.) — those were created directly against the live project and predate the migration history here. If you are standing up a brand-new Supabase project rather than connecting to the existing one, you will need to first capture that baseline schema yourself (e.g. `supabase db dump --schema public`) before applying the migrations in this folder. See "Known limitations" below.

## 🗄️ Data & Privacy

Account authentication, profile review, planner records (subjects, tasks, notes, grades, attendance, calendar, syllabus, GWA and settings), the admin-to-student Inbox, and support tickets submitted through the Report tab are all stored in the configured Supabase project, protected by Row Level Security so each student can only ever read their own messages/reports — never another student's, and never send or reply to a message themselves. Task-reminder read states remain device-local in `localStorage`. Admin messaging is strictly one-way (admin → student); there is no student-to-student messaging and no reply feature.

Admins can approve, reject, suspend, reactivate, and — for already-rejected accounts only — **permanently delete** an account and its planner data. Deletion requires a privileged, server-side Edge Function (never the browser) and is fully documented in [`supabase/README.md`](supabase/README.md); the security model behind every account-management action is validated in [`supabase/SECURITY_VALIDATION.md`](supabase/SECURITY_VALIDATION.md).

---

## 🛠️ Tech Stack

- HTML5 / CSS3 (custom design system, glassmorphism, CSS variables for theming)
- [Bootstrap 5.3](https://getbootstrap.com/) (layout & form primitives only — components are custom-styled)
- [Bootstrap Icons](https://icons.getbootstrap.com/)
- [Chart.js](https://www.chartjs.org/) (weekly productivity chart)
- Vanilla JavaScript (ES6+, no framework, no build tools)
- Canvas API (wallpaper generation)
- Service Worker API (offline support)

---

## 🌐 Browser Support

Latest versions of Chrome, Edge, Firefox, and Safari (desktop & mobile). PWA installability depends on the browser — Chromium-based browsers offer the fullest experience (install prompt, offline splash screen).

---

## 🧪 Testing

There is no automated test suite (unit, integration, or end-to-end) in this project — `package.json` declares no `test` script. Changes are currently validated manually: by exercising the app in a browser against the live Supabase project, and by the static checks described in `CODEBASE_AUDIT_REPORT.md` and `FINAL_AUDIT_REPORT.md` (JS syntax via `node --check`, JSON validation, and script-based reference checking of every script/link/import path — no live-browser or live-database checks are performed by those scripts). If you add real tests, document how to run them here.

## ⚠️ Known limitations

- **No fresh-database bootstrap script.** As noted above, the core planner tables are not created by any migration in this repo — only by the live project's pre-existing schema. Standing up a truly new Supabase project requires capturing that schema first (see "Backend setup" above).
- **No automated tests.** All verification is manual/static; there is no CI pipeline in this repo.
- **Classic scripts + ES modules side by side.** Student-facing planner pages (`pages/app/*.html`) load plain global `<script>` tags; the auth and admin flows load ES modules (`type="module"`). This is an intentional, pre-existing split, not an inconsistency to "fix" — don't change a page's script-loading style without updating every file that depends on globals it may set.
- **`supabase/README.md`'s migration walkthrough** describes migrations through roughly `0009`; the `supabase/migrations/` folder now goes through `0018`. The newer files are self-documenting in their own header comments — read each later migration's header for what it does, or see `DATABASE_MIGRATION_REPORT.md` for a file-by-file summary of every migration through `0018`.
- **Root-level audit reports** (`CODEBASE_AUDIT_REPORT.md`, `DATABASE_MIGRATION_REPORT.md`, `FINAL_AUDIT_REPORT.md`, `SECURITY_AUDIT.md`) are point-in-time QA snapshots, not living documentation — each states clearly what was verified vs. assumed. Re-run the same checks after future changes rather than trusting an old report's specifics to still hold.

---

## 📄 License

Released under the [MIT License](./LICENSE) — free to use, modify, and distribute.

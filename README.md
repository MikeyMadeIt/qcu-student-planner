# 📘 QCU Student Planner — PWA

A premium, offline-first Student Planner Progressive Web App built with **HTML5, CSS3, Bootstrap 5.3, and vanilla JavaScript**. Account authentication and profile/admin workflows use the configured Supabase integration; planner records are stored in the browser's `localStorage`.

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

This is a static site — no build step, no `npm install`.

### Option 1: Just open it
Open `index.html` (or `pages/app/dashboard.html`) directly in a browser. Most features work, but **installing as a PWA and the offline service worker require a real HTTP origin** (browsers block service workers on `file://`).

### Option 2: Serve it locally (recommended)
```bash
# from the project folder
python3 -m http.server 8080
# then visit http://localhost:8080
```
or with Node:
```bash
npx serve .
```

### Option 3: Deploy it
Drop the folder as-is onto any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages, or a plain web server. No server-side code or environment variables needed.

---

## 📂 Project Structure

```
qcu-student-planner/
├── index.html  manifest.json  service-worker.js  vercel.json  package.json
├── pages/      auth/ (login, register, ...)  app/ (planner pages)  admin/ (verification)
├── assets/     css/ (base, themes, layout, components, pages)  js/ (core, data, modules, services, utils)
│               images/  icons/
```


---

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

## 📄 License

Released under the [MIT License](./LICENSE) — free to use, modify, and distribute.

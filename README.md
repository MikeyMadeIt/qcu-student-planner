# 📘 QCU Student Planner — PWA

A premium, offline-first Student Planner Progressive Web App built with **HTML5, CSS3, Bootstrap 5.3, and vanilla JavaScript** — no frameworks and no backend yet. Sign-in and registration screens are interface only until authentication is connected. Every byte of your data stays on your own device in `localStorage`.

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

All data (subjects, tasks, notes, grades, attendance, habits, settings) is stored **only** in your browser's `localStorage` — nothing is sent to a server. Clearing your browser data or using a different browser/device means starting fresh, so use **Settings → Export All Data** regularly to back up, and **Import Data** to restore.

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

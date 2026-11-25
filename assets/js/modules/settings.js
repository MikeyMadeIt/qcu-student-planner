// SETTINGS.JS — profile summary, appearance, notifications, academic
// semester management, data/storage and sign-out. ES module (for
// AuthService); every handler referenced from inline HTML attributes is
// re-exposed on window at the bottom of the file.

import { AuthService } from '../services/auth-service.js';
import { getSupabase } from '../core/supabase-client.js';

function initSettings() {
    const s = DB.getSettings();
    highlightTheme(s.theme);
    renderAccentPicker(s.accent);
    renderNotifToggles(s.notifications);
    renderSemesterManager();
    initDisplayPrefs(s);
    renderSyncStatus();
    loadProfileSummary();
}

// PROFILE SUMMARY (read-only) — the authenticated Supabase user plus the
// matching `profiles` row. No editing here; profile details are set once
// during onboarding (finish-profile.html) via submit_profile_details().
async function loadProfileSummary() {
    const nameEl = document.getElementById('settingsFullName');
    const emailEl = document.getElementById('settingsEmail');
    const metaEl = document.getElementById('settingsProfileMeta');
    const avatarEl = document.getElementById('settingsAvatar');
    const wrap = document.getElementById('settingsProfile');
    if (!nameEl || !emailEl)
        return;
    try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData && sessionData.session && sessionData.session.user ? sessionData.session.user : null;
        if (!user) {
            if (wrap) wrap.removeAttribute('aria-busy');
            emailEl.textContent = 'Not signed in';
            return;
        }
        const email = user.email || '';
        const metadata = user.user_metadata || {};
        const photoUrl = metadata.avatar_url || metadata.picture || '';

        let fullName = '';
        let course = '';
        let yearLevel = '';
        let school = '';
        const profileResult = await AuthService.getCurrentProfile();
        if (profileResult.ok && profileResult.data) {
            fullName = profileResult.data.full_name || '';
            course = profileResult.data.course || '';
            yearLevel = profileResult.data.year_level || '';
            school = profileResult.data.school || '';
        }

        nameEl.textContent = fullName || email || 'Student';
        emailEl.textContent = email;

        const metaParts = [course, yearLevel, school].filter(Boolean);
        if (metaEl) metaEl.textContent = metaParts.join(' • ');

        if (avatarEl) {
            const initial = ((fullName || email).charAt(0) || 'S').toUpperCase();
            if (photoUrl) {
                const img = document.createElement('img');
                img.src = photoUrl;
                img.alt = '';
                img.loading = 'lazy';
                img.referrerPolicy = 'no-referrer';
                img.onerror = () => { avatarEl.textContent = initial; };
                avatarEl.replaceChildren(img);
            } else {
                avatarEl.textContent = initial;
            }
        }
    } catch (error) {
        console.error('Could not load profile summary.', error);
    } finally {
        if (wrap) wrap.removeAttribute('aria-busy');
    }
}

// Shows real Supabase sync state under Data & Storage — "All data is
// synced" while nothing has failed, or the actual last error (with when
// it happened) while something has. Always visible, never hardcoded: it
// reads window.CloudSync.getLastSyncError(), which cloud-sync.js sets and
// clears as pushes actually fail and succeed, and re-renders live via the
// 'planner:sync-status-changed' event so it stays accurate without a
// page refresh while Settings is open.
function renderSyncStatus() {
    const row = document.getElementById('syncStatusRow');
    const msgEl = document.getElementById('syncStatusMsg');
    const retryBtn = document.getElementById('syncStatusRetryBtn');
    if (!row || !msgEl) return;
    const err = (window.CloudSync && typeof window.CloudSync.getLastSyncError === 'function')
        ? window.CloudSync.getLastSyncError() : null;
    if (!err) {
        row.classList.remove('is-error');
        row.classList.add('is-ok');
        msgEl.textContent = 'All data is synced.';
        if (retryBtn) retryBtn.hidden = true;
        return;
    }
    row.classList.remove('is-ok');
    row.classList.add('is-error');
    const when = err.at ? new Date(err.at).toLocaleString() : '';
    msgEl.textContent = when ? `${err.message} (${when})` : err.message;
    if (retryBtn) retryBtn.hidden = false;
}

window.addEventListener('planner:sync-status-changed', renderSyncStatus);

function initDisplayPrefs(s) {
    const compact = document.getElementById('prefCompact');
    const motion = document.getElementById('prefReduceMotion');
    if (!compact || !motion)
        return;
    compact.checked = !!s.compact;
    motion.checked = !!s.reduceMotion;
    compact.addEventListener('change', () => { const st = DB.getSettings(); st.compact = compact.checked; DB.saveSettings(st); applyTheme(); });
    motion.addEventListener('change', () => { const st = DB.getSettings(); st.reduceMotion = motion.checked; DB.saveSettings(st); applyTheme(); });
}

// SEMESTER MANAGEMENT (Academic Preferences)

function renderSemesterManager() {
    const wrap = document.getElementById('semesterManager');
    if (!wrap)
        return;
    wrap.removeAttribute('aria-busy');
    const semesters = DB.getSemesters();
    const activeId = DB.getActiveSemesterId();
    const byYear = {};
    semesters.forEach(sem => {
        if (!byYear[sem.schoolYear])
            byYear[sem.schoolYear] = [];
        byYear[sem.schoolYear].push(sem);
    });
    const sortedYears = Object.keys(byYear).sort();
    let html = '';
    sortedYears.forEach(year => {
        const yearSems = byYear[year].sort((a, b) => a.name.localeCompare(b.name));
        html += `<div class="sem-year-group mb-3">
      <div class="sem-year-label">${year}</div>
      ${yearSems.map(sem => {
            const isActive = sem.id === activeId;
            return `<div class="sem-item ${isActive ? 'sem-item-active' : ''}">
          <div class="sem-item-left">
            <span class="sem-dot ${isActive ? 'active' : ''}"></span>
            <div>
              <div class="sem-item-name">${escHtml(sem.name)}</div>
              <div class="sem-item-dates">${sem.startDate} – ${sem.endDate}</div>
            </div>
          </div>
          <div class="sem-item-actions">
            ${isActive ? '<span class="chip sem-active-chip"><i class="icon-lucide-check" aria-hidden="true"></i> Active</span>' :
                `<button class="btn btn-ghost btn-sm sem-switch-btn" data-id="${escHtml(sem.id)}" aria-label="Switch to ${escHtml(sem.name)}"><i class="icon-lucide-toggle-left me-1" aria-hidden="true"></i>Switch</button>`}
            <button class="btn btn-ghost btn-sm sem-edit-btn" data-id="${escHtml(sem.id)}" aria-label="Edit ${escHtml(sem.name)}"><i class="icon-lucide-pencil" aria-hidden="true"></i></button>
            ${semesters.length > 1 ? `<button class="btn btn-ghost btn-sm text-danger sem-delete-btn" data-id="${escHtml(sem.id)}" aria-label="Delete ${escHtml(sem.name)}"><i class="icon-lucide-trash-2" aria-hidden="true"></i></button>` : ''}
          </div>
        </div>`;
        }).join('')}
    </div>`;
    });
    html += `<div class="d-flex gap-2 mt-2">
    <button class="btn btn-accent btn-sm flex-grow-1" onclick="openAddSemesterModal()"><i class="icon-lucide-plus me-1" aria-hidden="true"></i>Add Semester</button>
  </div>`;
    wrap.innerHTML = html;
    if (!wrap._semBound) {
        wrap._semBound = true;
        wrap.addEventListener('click', function (e) {
            const switchBtn = e.target.closest('.sem-switch-btn');
            if (switchBtn) { switchActiveSemester(switchBtn.dataset.id); return; }
            const editBtn = e.target.closest('.sem-edit-btn');
            if (editBtn) { openEditSemesterModal(editBtn.dataset.id); return; }
            const deleteBtn = e.target.closest('.sem-delete-btn');
            if (deleteBtn) { confirmDeleteSemester(deleteBtn.dataset.id); return; }
        });
    }
}

function switchActiveSemester(id) {
    DB.setActiveSemester(id);
    renderSemesterManager();
    const sem = DB.getActiveSemester();
    Toast.show(`Switched to ${sem.schoolYear} • ${sem.name}`);
}

function openAddSemesterModal() {
    const body = document.getElementById('semModalBody');
    body.innerHTML = `
    <input type="hidden" id="editSemId" value="">
    <div class="row g-2">
      <div class="col-md-6">
        <label for="semYearInput">School Year</label>
        <input class="form-control" id="semYearInput" placeholder="e.g. 2026-2027" value="${new Date().getFullYear()}-${new Date().getFullYear() + 1}" autocomplete="off">
      </div>
      <div class="col-md-6">
        <label for="semNameInput">Semester</label>
        <select class="form-select" id="semNameInput">
          <option value="1st Semester">1st Semester</option>
          <option value="2nd Semester">2nd Semester</option>
        </select>
      </div>
      <div class="col-md-6"><label for="semStartInput">Start Date</label><input type="date" class="form-control" id="semStartInput" value="${ymdLocalNow()}"></div>
      <div class="col-md-6"><label for="semEndInput">End Date</label><input type="date" class="form-control" id="semEndInput" value="${ymdLocalFuture(105)}"></div>
      <div class="col-md-6"><label for="semFinalsInput">Finals Date</label><input type="date" class="form-control" id="semFinalsInput" value="${ymdLocalFuture(100)}"></div>
      <div class="col-md-6"><label for="semWeeksInput">Total Weeks</label><input type="number" class="form-control" id="semWeeksInput" value="15" min="1" max="52"></div>
    </div>
    <div class="modal-actions"><button class="btn btn-accent w-100" onclick="saveSemesterModal()"><i class="icon-lucide-check me-1" aria-hidden="true"></i>Add Semester</button></div>`;
    document.getElementById('semModalTitle').textContent = 'Add Semester';
    new bootstrap.Modal(document.getElementById('semModal')).show();
}

function openEditSemesterModal(id) {
    const sem = DB.getSemesters().find(s => s.id === id);
    if (!sem)
        return;
    const body = document.getElementById('semModalBody');
    body.innerHTML = `
    <input type="hidden" id="editSemId" value="${sem.id}">
    <div class="row g-2">
      <div class="col-md-6">
        <label>School Year</label>
        <input class="form-control sem-readonly-field" id="semYearInput" value="${escHtml(sem.schoolYear)}" readonly>
        <div class="text-faint mt-1 sem-readonly-hint">School year cannot be changed</div>
      </div>
      <div class="col-md-6">
        <label>Semester</label>
        <input class="form-control sem-readonly-field" id="semNameInput" value="${escHtml(sem.name)}" readonly>
        <div class="text-faint mt-1 sem-readonly-hint">Name cannot be changed</div>
      </div>
      <div class="col-md-6"><label for="semStartInput">Start Date</label><input type="date" class="form-control" id="semStartInput" value="${sem.startDate}"></div>
      <div class="col-md-6"><label for="semEndInput">End Date</label><input type="date" class="form-control" id="semEndInput" value="${sem.endDate}"></div>
      <div class="col-md-6"><label for="semFinalsInput">Finals Date</label><input type="date" class="form-control" id="semFinalsInput" value="${sem.finalsDate}"></div>
      <div class="col-md-6"><label for="semWeeksInput">Total Weeks</label><input type="number" class="form-control" id="semWeeksInput" value="${sem.totalWeeks}" min="1" max="52"></div>
    </div>
    <div class="modal-actions"><button class="btn btn-accent w-100" onclick="saveSemesterModal()"><i class="icon-lucide-check me-1" aria-hidden="true"></i>Update Semester</button></div>`;
    document.getElementById('semModalTitle').textContent = 'Edit Semester';
    new bootstrap.Modal(document.getElementById('semModal')).show();
}

function saveSemesterModal() {
    const editId = document.getElementById('editSemId').value;
    const schoolYear = (document.getElementById('semYearInput').value || '').trim();
    const semNameEl = document.getElementById('semNameInput');
    const semName = semNameEl ? semNameEl.value.trim() : '1st Semester';
    const startDate = document.getElementById('semStartInput').value;
    const endDate = document.getElementById('semEndInput').value;
    const finalsDate = document.getElementById('semFinalsInput').value;
    const totalWeeks = parseInt(document.getElementById('semWeeksInput').value) || 15;
    if (!schoolYear) {
        Toast.show('School year is required', 'high', 'icon-lucide-triangle-alert');
        return;
    }
    if (editId) {
        DB.updateSemester(editId, { startDate, endDate, finalsDate, totalWeeks });
        Toast.show('Semester updated');
    }
    else {
        const result = DB.addSemester(schoolYear, semName, { startDate, endDate, finalsDate, totalWeeks });
        if (!result) {
            Toast.show('That semester already exists', 'high', 'icon-lucide-triangle-alert');
        }
        else {
            Toast.show('Semester added');
        }
    }
    const modalEl = document.getElementById('semModal');
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst)
        inst.hide();
    renderSemesterManager();
}

function confirmDeleteSemester(id) {
    const sem = DB.getSemesters().find(s => s.id === id);
    if (!sem)
        return;
    const subCount = DB.getSubjectsForSemester(id).length;
    const taskCount = DB.getTasksForSemester(id).length;
    const noteCount = DB.getNotesForSemester(id).length;
    const attCount = DB.getAttendanceForSemester(id).length;
    const gradeCount = DB.getGradesForSemester(id).length;
    const syllabusCount = DB.getSyllabusCoursesForSemester(id).length;
    const parts = [];
    if (subCount)
        parts.push(`${subCount} subject${subCount !== 1 ? 's' : ''}`);
    if (taskCount)
        parts.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`);
    if (attCount)
        parts.push(`${attCount} attendance record${attCount !== 1 ? 's' : ''}`);
    if (gradeCount)
        parts.push(`${gradeCount} grade record${gradeCount !== 1 ? 's' : ''}`);
    if (noteCount)
        parts.push(`${noteCount} note${noteCount !== 1 ? 's' : ''}`);
    if (syllabusCount)
        parts.push(`${syllabusCount} syllabus course${syllabusCount !== 1 ? 's' : ''}`);
    const dataMsg = parts.length
        ? `This will also permanently remove ${parts.join(', ')}.`
        : 'No linked data will be affected.';
    confirmAction({
        title: `Delete ${sem.schoolYear} ${sem.name}?`,
        message: `${dataMsg} This cannot be undone.`,
        confirmLabel: 'Delete', danger: true, icon: 'icon-lucide-trash-2',
        onConfirm() {
            if (!DB.deleteSemester(id)) {
                Toast.show('Cannot delete the only semester', 'high', 'icon-lucide-triangle-alert');
            }
            else {
                Toast.show('Semester deleted');
                renderSemesterManager();
            }
        }
    });
}

function ymdLocalNow() { return ymdLocal(new Date()); }

function ymdLocalFuture(days) { return ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * days)); }
// ymdLocal defined in storage.js
function escHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// THEME / ACCENT / NOTIF

function chooseTheme(theme) { setTheme(theme, window.event); highlightTheme(theme); }

function highlightTheme(theme) {
    ['dark', 'light', 'amoled'].forEach(t => document.getElementById('theme_' + t).classList.toggle('btn-accent', t === theme));
}

// Keep in sync with assets/css/themes/accents.css — swatches need each
// accent's own --accent value, not the currently-applied one, so the
// colors are duplicated here rather than read off the live CSS variable.
const ACCENT_SWATCH_RGB = {
    blue: '36,87,214', violet: '95,76,189', indigo: '59,79,166', teal: '16,116,125',
    emerald: '27,128,94', olive: '107,122,31', ochre: '166,107,15', rust: '184,81,31',
    crimson: '178,40,40', rose: '189,51,83', maroon: '122,43,61', slate: '74,85,104',
    graphite: '55,61,74', steel: '62,102,128'
};

function renderAccentPicker(current) {
    const accents = Object.keys(ACCENT_SWATCH_RGB);
    const wrap = document.getElementById('accentPicker');
    wrap.innerHTML = accents.map(accent => `
    <button onclick="chooseAccent('${accent}')" data-accent="${accent}" data-accent-swatch="${accent}" aria-label="${accent} accent color" aria-pressed="${accent === current}" class="accent-swatch-btn" style="background:rgb(${ACCENT_SWATCH_RGB[accent]})"></button>`).join('');
}

function chooseAccent(a) {
    setAccent(a);
    document.querySelectorAll('[data-accent-swatch]').forEach(el => el.setAttribute('aria-pressed', el.dataset.accentSwatch === a ? 'true' : 'false'));
}

// Shared timing choices for anything reminding the user ahead of a
// moment in time (a class starting, a task's due date/time).
const REMINDER_TIMING_OPTIONS = [
    [0, 'At the scheduled time'],
    [5, '5 minutes before'],
    [10, '10 minutes before'],
    [15, '15 minutes before'],
    [30, '30 minutes before'],
    [60, '1 hour before'],
];

// Each entry: [toggle key, label, help, timing key or null]. Only toggles
// backed by a real, working check in notification-engine.js are listed —
// Exam/Pomodoro/Daily Review were removed because nothing in the app
// currently tracks exams separately from tasks, runs a focus timer, or
// has a daily review feature.
const NOTIF_ITEMS = [
    ['upcomingClass', 'Upcoming Classes', 'Notify me before a scheduled class starts, based on my saved schedule.', 'upcomingClassMinutes'],
    ['taskReminders', 'Task Reminders', 'Notify me before a task is due, based on the due dates on my Tasks page.', 'taskReminderMinutes'],
    ['lowAttendance', 'Low Attendance Warning', 'Notify me when a subject\u2019s absences reach the limit I\u2019ve set on the Attendance page.', null],
];

function timingSelectHtml(key, value) {
    return `<select class="form-select form-select-sm notif-timing-select" id="notif_${key}" aria-label="Reminder timing" onchange="updateNotifSetting('${key}', parseInt(this.value, 10))">
    ${REMINDER_TIMING_OPTIONS.map(([mins, label]) => `<option value="${mins}" ${Number(value) === mins ? 'selected' : ''}>${label}</option>`).join('')}
  </select>`;
}

// Toggles with a timing choice (Upcoming Classes, Task Reminders) share a
// single "Remind me" row placed after all the toggles, instead of each
// toggle getting its own separate "Remind me" row/divider directly under
// it. Each toggle still keeps its own independent timing value — only the
// row's layout is shared.
const TIMING_ITEMS = NOTIF_ITEMS.filter(([, , , timingKey]) => timingKey);

function anyTimingToggleOn(n) {
    return TIMING_ITEMS.some(([key]) => n[key]);
}

function renderNotifToggles(n) {
    const toggleRows = NOTIF_ITEMS.map(([key, label, help]) => `<div class="pref-row">
      <div><div class="pref-label">${label}</div><div class="pref-help">${help}</div></div>
      <div class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="notifToggle_${key}" aria-label="${label}" ${n[key] ? 'checked' : ''} onchange="updateNotifSetting('${key}', this.checked)"></div>
    </div>`).join('');

    const remindRow = `<div class="pref-stack notif-remind-row" id="notifRemindRow" ${anyTimingToggleOn(n) ? '' : 'hidden'}>
      <div><div class="pref-label">Remind me</div><div class="pref-help">How far ahead each reminder below should notify you.</div></div>
      <div class="notif-remind-selects">
        ${TIMING_ITEMS.map(([key, label, , timingKey]) => `<div class="notif-remind-select-group" id="notifTimingRow_${key}" ${n[key] ? '' : 'hidden'}>
          <span class="notif-remind-select-label">${label}</span>
          ${timingSelectHtml(timingKey, n[timingKey])}
        </div>`).join('')}
      </div>
    </div>`;

    const container = document.getElementById('notifToggles');
    container.innerHTML = toggleRows + remindRow;
    // The selects above are injected after page load, outside a modal, so
    // they're never picked up by the app-wide DOMContentLoaded/show.bs.modal
    // listeners in custom-select.js — enhance them here instead, so they
    // render as the same custom dropdown used everywhere else, not the
    // browser's native <select> menu.
    if (window.enhanceSelects) enhanceSelects(container);
}

function updateNotifSetting(key, val) {
    const s = DB.getSettings();
    s.notifications[key] = val;
    DB.saveSettings(s);
    // The timing group for a toggle only makes sense while that toggle is
    // on; the shared "Remind me" row only makes sense while at least one
    // timed toggle is on.
    const group = document.getElementById('notifTimingRow_' + key);
    if (group) {
        group.hidden = !val;
        const remindRow = document.getElementById('notifRemindRow');
        if (remindRow) remindRow.hidden = !anyTimingToggleOn(s.notifications);
    }
}

function requestNotifPermission() {
    if (!('Notification' in window)) {
        Toast.show('Notifications not supported in this browser', 'high', 'icon-lucide-triangle-alert');
        return;
    }
    Notification.requestPermission().then(p => {
        Toast.show(p === 'granted' ? 'Notifications enabled' : 'Permission not granted');
    });
}

// EXPORT — pulls the signed-in user's actual rows straight from Supabase
// (not the local cache) so the file always reflects what's really saved
// to their account, and can never include anyone else's data: every
// query below is scoped to this user's id, on top of each table's own
// RLS policy doing the same thing server-side.
const EXPORT_SCHEMA_VERSION = 2;

// Appearance/notification preferences only — theme, accent, compact,
// reduceMotion, notifications. Keeps the export honest even against a
// user_preferences row saved before name/studentNumber/course/yearLevel/
// school were removed from the settings schema: those were never
// collected or shown by any real feature (the actual name/course/year
// level/school live in the `profiles` table, already included via the
// account's profile elsewhere in the app), so they don't belong in a
// data export and are dropped here regardless of what's still sitting
// in the database row.
const PREFS_FIELDS = ['theme', 'accent', 'compact', 'reduceMotion', 'notifications'];
function sanitizePrefs(prefs) {
    if (!prefs || typeof prefs !== 'object') return null;
    const clean = {};
    PREFS_FIELDS.forEach(k => { if (k in prefs) clean[k] = prefs[k]; });
    return clean;
}

async function exportData() {
    const btn = document.getElementById('settingsExportBtn');
    if (window.Loading) Loading.setButtonLoading(btn, true);
    try {
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData && sessionData.session && sessionData.session.user;
        if (!user) {
            Toast.show('You need to be signed in to export your data.', 'high', 'icon-lucide-triangle-alert');
            return;
        }
        const userId = user.id;

        const [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes,
            gwaRes, coRes, semRes, prefRes] = await Promise.all([
            supabase.from('subjects').select('*').eq('user_id', userId),
            supabase.from('tasks').select('*').eq('user_id', userId),
            supabase.from('task_checklist_items').select('*'),
            supabase.from('calendar_events').select('*').eq('user_id', userId),
            supabase.from('notes').select('*').eq('user_id', userId),
            supabase.from('attendance').select('*').eq('user_id', userId),
            supabase.from('grades').select('*').eq('user_id', userId),
            supabase.from('grade_components').select('*'),
            supabase.from('grade_assessments').select('*'),
            supabase.from('gwa_calculator').select('*').eq('user_id', userId),
            supabase.from('cancelled_occurrences').select('occurrences').eq('user_id', userId).maybeSingle(),
            supabase.from('semesters').select('*').eq('user_id', userId),
            supabase.from('user_preferences').select('prefs').eq('user_id', userId).maybeSingle(),
        ]);

        // user_preferences is a newer table; on a project where that
        // migration hasn't landed yet, don't let a missing-relation error
        // block the rest of the export.
        const prefsTableMissing = prefRes.error && /relation .* does not exist/i.test(prefRes.error.message || '');
        const firstError = [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes, gwaRes, coRes, semRes]
            .map(r => r.error).find(Boolean);
        if (firstError) throw firstError;
        if (prefRes.error && !prefsTableMissing) throw prefRes.error;

        // Keep each task's/grade's nested records attached to their
        // parent, same shape the rest of the app already works with,
        // rather than five flat tables the person would have to join
        // themselves to make sense of.
        const checklistByTask = {};
        (clRes.data || []).forEach(c => { (checklistByTask[c.task_id] = checklistByTask[c.task_id] || []).push(c); });
        const tasks = (taskRes.data || []).map(t => ({ ...t, checklist_items: checklistByTask[t.id] || [] }));

        const assessmentsByComponent = {};
        (gaRes.data || []).forEach(a => { (assessmentsByComponent[a.component_id] = assessmentsByComponent[a.component_id] || []).push(a); });
        const componentsByGrade = {};
        (gcRes.data || []).forEach(c => {
            (componentsByGrade[c.grade_id] = componentsByGrade[c.grade_id] || [])
                .push({ ...c, assessments: assessmentsByComponent[c.id] || [] });
        });
        const grades = (gradeRes.data || []).map(g => ({ ...g, components: componentsByGrade[g.id] || [] }));

        const payload = {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            account: { userId, email: user.email || '' },
            data: {
                semesters: semRes.data || [],
                subjects: subjRes.data || [],
                tasks,
                notes: noteRes.data || [],
                calendarEvents: evRes.data || [],
                attendance: attRes.data || [],
                grades,
                gwaCalculator: gwaRes.data || [],
                cancelledOccurrences: (coRes.data && coRes.data.occurrences) || [],
                preferences: prefsTableMissing ? null : sanitizePrefs(prefRes.data && prefRes.data.prefs),
            }
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student-planner-backup-${todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        Toast.show('Data exported');
    } catch (err) {
        console.error('Export failed', err);
        Toast.show('Export failed: ' + (err && err.message ? err.message : 'Unknown error'), 'high', 'icon-lucide-triangle-alert');
    } finally {
        if (window.Loading) Loading.setButtonLoading(btn, false);
    }
}

// RESET ALL DATA — permanently deletes this user's own planner data from
// Supabase (CloudSync.resetAllData, backed by the reset_my_planner_data()
// transaction — see supabase/migrations/0027_reset_my_planner_data.sql),
// then clears the local cache to match. The account, Auth login, profile,
// role and approval status are never touched by any of this.
function confirmReset() {
    promptAction({
        title: 'Delete all data?',
        message: 'Deleting your data will permanently erase all your subjects, schedules, tasks, notes, academic records, and other personal application data. Your Google account and profile will remain intact. This action cannot be undone.',
        label: 'Type DELETE to confirm',
        placeholder: 'DELETE',
        confirmLabel: 'Delete all data',
        danger: true,
        requireExact: 'DELETE',
        async onConfirm() {
            const btn = document.getElementById('settingsResetBtn');
            if (window.Loading) Loading.setButtonLoading(btn, true);
            try {
                if (!window.CloudSync || typeof CloudSync.resetAllData !== 'function') {
                    throw new Error('Delete is unavailable right now. Please check your connection and try again.');
                }
                await CloudSync.resetAllData();
                Toast.show('Your data has been deleted.');
                // A full reload is the simplest reliable way to flush every
                // page's in-memory state back to the now-empty server
                // truth (dashboard stats, cached lists, etc.) without
                // having to special-case each page's own re-render logic.
                // The Supabase session lives in its own storage and this
                // never calls signOut(), so the person stays logged in.
                setTimeout(() => location.reload(), 600);
            } catch (err) {
                console.error('Reset failed', err);
                Toast.show('Reset failed: ' + (err && err.message ? err.message : 'Unknown error'), 'high', 'icon-lucide-triangle-alert');
                if (window.Loading) Loading.setButtonLoading(btn, false);
            }
        }
    });
}

// SIGN OUT — same AuthService.signOut() call used across the app, with a
// confirm dialog, a toast on failure, and a redirect to login on success.
function confirmSignOut() {
    confirmAction({
        title: 'Sign out?',
        message: 'You will need to sign in again to access your planner.',
        confirmLabel: 'Sign out', danger: true, icon: 'icon-lucide-log-out',
        async onConfirm() {
            const btn = document.getElementById('settingsSignOutBtn');
            if (btn) btn.disabled = true;
            const result = await AuthService.signOut();
            if (!result.ok) {
                Toast.show(result.message || 'Could not sign out. Please try again.', 'high', 'icon-lucide-triangle-alert');
                if (btn) btn.disabled = false;
                return;
            }
            location.href = '../auth/login.html';
        }
    });
}

// Inline HTML attributes (onclick=...) and DB.whenCloudReady(initSettings)
// resolve against window, not this module's scope — expose everything
// they call.
window.initSettings = initSettings;
window.openAddSemesterModal = openAddSemesterModal;
window.saveSemesterModal = saveSemesterModal;
window.chooseTheme = chooseTheme;
window.chooseAccent = chooseAccent;
window.updateNotifSetting = updateNotifSetting;
window.requestNotifPermission = requestNotifPermission;
window.exportData = exportData;
window.confirmReset = confirmReset;
window.confirmSignOut = confirmSignOut;

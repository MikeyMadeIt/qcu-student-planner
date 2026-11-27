// STORAGE.JS — localStorage data layer (Multi-Semester Edition)

const DB_KEYS = {
    subjects: 'sp_subjects',
    tasks: 'sp_tasks',
    notes: 'sp_notes',
    attendance: 'sp_attendance',
    grades: 'sp_grades',
    gwaCalc: 'sp_gwa_calc',
    settings: 'sp_settings',
    semester: 'sp_semester',
    pomodoro: 'sp_pomodoro_stats',
    calendarEvents: 'sp_calendar_events',
    semesters: 'sp_semesters',
    activeSemesterId: 'sp_active_semester_id',
};

// Real UUIDs are required now that subjects/tasks/calendar events are persisted to
const uid = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function')
        return window.crypto.randomUUID();
    const b = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
};

function readKey(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch (e) {
        console.warn('DB read failed', key, e);
        return fallback;
    }
}

function writeKey(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        if (key === DB_KEYS.tasks)
            window.dispatchEvent(new CustomEvent('planner:tasks-changed'));
        return true;
    }
    catch (e) {
        console.warn('DB write failed', key, e);
        return false;
    }
}

// Appearance/notification preferences only. Name, student number, course,
// year level and school used to live here too, but nothing in the app has
// ever let the user set them through this object — the real values for
// name/course/year level/school live in the `profiles` table (see
// AuthService.getCurrentProfile / loadProfileSummary in settings.js), and
// student number isn't collected anywhere at all. Keeping dead copies
// here just meant every settings save re-pushed stale placeholder values
// ("Student", "") to Supabase's user_preferences table, where they'd
// wrongly look like real data (e.g. in an export). Display code that used
// to read settings.name already falls back to the literal "Student" when
// it's missing, so dropping it here changes nothing visible.
const DEFAULT_SETTINGS = {
    theme: 'dark', accent: 'blue',
    compact: false, reduceMotion: false, curriculumStatusOverrides: {},
    notifications: {
        upcomingClass: true, upcomingClassMinutes: 10,
        taskReminders: true, taskReminderMinutes: 60,
        lowAttendance: true,
    },
};

const SUBJECT_COLORS = ['#2457D6', '#1F9254', '#B45309', '#D6433C', '#6D5BD6', '#0E8C8C', '#C2498A', '#4B5563'];
// SEMESTER HELPERS

function makeSemesterId(schoolYear, semName) {
    const num = semName.toLowerCase().includes('2nd') ? '2' : '1';
    return `${schoolYear}-${num}`;
}

function makeSemesterObject(schoolYear, semName, extra) {
    const id = makeSemesterId(schoolYear, semName);
    return {
        id,
        name: semName,
        schoolYear,
        startDate: extra && extra.startDate ? extra.startDate : ymdLocal(new Date()),
        endDate: extra && extra.endDate ? extra.endDate : ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)),
        finalsDate: extra && extra.finalsDate ? extra.finalsDate : ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)),
        totalWeeks: extra && extra.totalWeeks ? extra.totalWeeks : 15,
    };
}

// DATA MIGRATION — run once safely

function migrateLegacyData() {
    if (localStorage.getItem('sp_semester_migrated'))
        return;
    const legacySem = readKey(DB_KEYS.semester, null);
    let semesters = readKey(DB_KEYS.semesters, []);
    if (!semesters.length && legacySem && legacySem.schoolYear && legacySem.name) {
        const schoolYear = legacySem.schoolYear;
        const semName = legacySem.name;
        const sem = makeSemesterObject(schoolYear, semName, legacySem);
        semesters = [sem];
        writeKey(DB_KEYS.semesters, semesters);
    }
    const subjects = readKey(DB_KEYS.subjects, []);
    let subjectsChanged = false;
    subjects.forEach(s => {
        if (!s.semesterId) {
            const match = semesters.find(sem => sem.name === s.semester && sem.schoolYear === s.schoolYear);
            if (match) s.semesterId = match.id;
            subjectsChanged = true;
        }
    });
    if (subjectsChanged)
        writeKey(DB_KEYS.subjects, subjects);
    const attendance = readKey(DB_KEYS.attendance, []);
    let attChanged = false;
    attendance.forEach(r => {
        if (!r.semesterId) {
            const sub = subjects.find(s => s.id === r.subjectId);
            if (sub && sub.semesterId) r.semesterId = sub.semesterId;
            attChanged = true;
        }
    });
    if (attChanged)
        writeKey(DB_KEYS.attendance, attendance);
    const grades = readKey(DB_KEYS.grades, []);
    let gradesChanged = false;
    grades.forEach(g => {
        if (!g.semesterId) {
            const sub = subjects.find(s => s.id === g.subjectId);
            if (sub && sub.semesterId) g.semesterId = sub.semesterId;
            gradesChanged = true;
        }
    });
    if (gradesChanged)
        writeKey(DB_KEYS.grades, grades);
    const tasks = readKey(DB_KEYS.tasks, []);
    let tasksChanged = false;
    tasks.forEach(t => {
        if (!t.semesterId) {
            const sub = t.subjectId ? subjects.find(s => s.id === t.subjectId) : null;
            if (sub && sub.semesterId) t.semesterId = sub.semesterId;
            tasksChanged = true;
        }
    });
    if (tasksChanged)
        writeKey(DB_KEYS.tasks, tasks);
    const notes = readKey(DB_KEYS.notes, []);
    let notesChanged = false;
    notes.forEach(n => {
        if (!n.semesterId) {
            const subject = n.subjectId ? subjects.find(s => s.id === n.subjectId) : null;
            const task = n.taskId ? tasks.find(t => t.id === n.taskId) : null;
            if (subject && task && subject.semesterId === task.semesterId && subject.semesterId) n.semesterId = subject.semesterId;
            else if (subject && !task && subject.semesterId) n.semesterId = subject.semesterId;
            else if (task && !subject && task.semesterId) n.semesterId = task.semesterId;
            notesChanged = true;
        }
    });
    if (notesChanged)
        writeKey(DB_KEYS.notes, notes);
    localStorage.setItem('sp_semester_migrated', '1');
}

// FIRST-RUN INIT — creates a clean empty planner (no demo data)

function initIfEmpty() {
    if (localStorage.getItem('sp_initialized'))
        return;
    writeKey(DB_KEYS.semesters, []);
    writeKey(DB_KEYS.activeSemesterId, null);
    writeKey(DB_KEYS.subjects, []);
    writeKey(DB_KEYS.tasks, []);
    writeKey(DB_KEYS.notes, []);
    writeKey(DB_KEYS.attendance, []);
    writeKey(DB_KEYS.grades, []);
    writeKey(DB_KEYS.gwaCalc, []);
    writeKey(DB_KEYS.calendarEvents, []);
    writeKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] });
    writeKey(DB_KEYS.settings, DEFAULT_SETTINGS);
    writeKey(DB_KEYS.semester, null);
    localStorage.setItem('sp_initialized', '1');
    localStorage.setItem('sp_semester_migrated', '1');
}

// IMPORT ID NORMALIZATION — cloud-sync.js silently refuses to push any
// subject/task/note/attendance/grade/calendar-event/GWA-calculator row
// whose id isn't a real UUID (Supabase's column type for all of those is
// uuid; only a semester's id is plain text there, so semesters are left
// untouched). A backup built or edited outside the app's own Export button
// can easily carry readable ids like "subj-1" instead of a UUID — those
// rows would import fine locally, then vanish the moment the page reloads
// and re-pulls from the server, because they were never actually accepted
// by Supabase in the first place. Giving every such id a fresh UUID here,
// before anything is written or pushed, means an import always survives a
// reload no matter where the file came from.
const DB = {
    init() {
        if (localStorage.getItem('sp_seeded') && !localStorage.getItem('sp_initialized')) {
            localStorage.setItem('sp_initialized', '1');
        }
        initIfEmpty();
        migrateLegacyData();
    },
    uid,
    colors: SUBJECT_COLORS,
    get(key, fallback) { return readKey(DB_KEYS[key], fallback); },
    set(key, value) { return writeKey(DB_KEYS[key], value); },
    getSemesters() {
        const stored = readKey(DB_KEYS.semesters, []);
        const calendar = this.getUniversityCalendar();
        const shared = calendar && Array.isArray(calendar.semesters) ? calendar.semesters : [];
        const merged = new Map(stored.map(s => [s.id, s]));
        shared.forEach(s => merged.set(s.id, s));
        return [...merged.values()];
    },
    saveSemesters(list) { return writeKey(DB_KEYS.semesters, list); },
    getActiveSemesterId() {
        return this.getSelectedSemesterId();
    },
    getUniversityActiveSemesterId() {
        const calendar = this.getUniversityCalendar();
        return calendar && calendar.activeSemester ? calendar.activeSemester.id : null;
    },
    _semesterContextUserId: null,
    setSemesterContextUser(userId) { this._semesterContextUserId = userId || null; },
    _semesterSelectionKey() { return 'sp_selected_semester:' + (this._semesterContextUserId || 'anonymous'); },
    _canSelectSemester(semester, activeId) {
        if (typeof isSemesterSelectable === 'function') return isSemesterSelectable(semester, activeId, academicDateKey());
        return !!(semester && semester.id && semester.startDate && (semester.id === activeId || semester.startDate <= new Date().toISOString().slice(0, 10)));
    },
    getSelectedSemesterId() {
        const active = this.getUniversityActiveSemesterId();
        if (!active) return null;
        const key = this._semesterSelectionKey();
        const previousActive = localStorage.getItem(key + ':active');
        if (previousActive !== active) {
            localStorage.setItem(key + ':active', active);
            localStorage.setItem(key, active);
            return active;
        }
        const selected = localStorage.getItem(key);
        const calendar = this.getUniversityCalendar();
        const semester = calendar && (calendar.semesters || []).find(s => s.id === selected);
        if (!this._canSelectSemester(semester, active)) {
            localStorage.setItem(key, active);
            return active;
        }
        return selected;
    },
    selectSemester(id) {
        const active = this.getUniversityActiveSemesterId();
        const calendar = this.getUniversityCalendar();
        const candidate = calendar && (calendar.semesters || []).find(s => s.id === id);
        if (!active || !this._canSelectSemester(candidate, active)) return false;
        const key = this._semesterSelectionKey();
        localStorage.setItem(key + ':active', active);
        localStorage.setItem(key, id);
        window.dispatchEvent(new CustomEvent('planner:semester-context-changed', { detail: { semesterId: id } }));
        return true;
    },
    getUniversityCalendar() {
        try { return JSON.parse(localStorage.getItem('sp_university_academic_calendar') || 'null'); }
        catch (e) { return null; }
    },
    setUniversityCalendar(calendar) {
        const next = calendar || null;
        const oldCalendar = this.getUniversityCalendar();
        const oldActive = oldCalendar && oldCalendar.activeSemester ? oldCalendar.activeSemester.id : null;
        let changed = true;
        try {
            const key = 'sp_university_academic_calendar';
            const previous = localStorage.getItem(key);
            const serialized = JSON.stringify(next);
            changed = previous !== serialized;
            localStorage.setItem(key, serialized);
        } catch (e) { /* ignore */ }
        if (changed) {
            window.dispatchEvent(new CustomEvent('planner:academic-calendar-changed', { detail: next }));
            const newActive = next && next.activeSemester ? next.activeSemester.id : null;
            if (oldActive !== newActive) {
                const key = this._semesterSelectionKey();
                if (newActive) { localStorage.setItem(key + ':active', newActive); localStorage.setItem(key, newActive); }
                else { localStorage.removeItem(key + ':active'); localStorage.removeItem(key); }
                window.dispatchEvent(new CustomEvent('planner:semester-context-changed', { detail: { semesterId: newActive, activeChanged: true } }));
            }
        }
    },
    getActiveSemester() {
        const id = this.getSelectedSemesterId();
        return id ? this.getSemesters().find(s => s.id === id) || null : null;
    },
    getSubjectsForSemester(semId) { return semId ? this.getSubjects().filter(s => s.semesterId === semId) : []; },
    getAttendanceForSemester(semId) { return semId ? this.getAttendance().filter(r => r.semesterId === semId) : []; },
    getGradesForSemester(semId) { return semId ? this.getGrades().filter(g => g.semesterId === semId) : []; },
    getTasksForSemester(semId) { return semId ? this.getTasks().filter(t => t.semesterId === semId) : []; },
    getNotesForSemester(semId) { return semId ? this.getNotes().filter(n => n.semesterId === semId) : []; },
    getCalendarEventsForSemester(semId) { return semId ? this.getCalendarEvents().filter(e => e.semesterId === semId) : []; },
    getActiveSubjects() { const id = this.getActiveSemesterId(); return id ? this.getSubjectsForSemester(id) : []; },
    getActiveAttendance() { const id = this.getActiveSemesterId(); return id ? this.getAttendanceForSemester(id) : []; },
    getActiveGrades() { const id = this.getActiveSemesterId(); return id ? this.getGradesForSemester(id) : []; },
    getActiveTasks() { const id = this.getActiveSemesterId(); return id ? this.getTasksForSemester(id) : []; },
    getActiveNotes() { const id = this.getActiveSemesterId(); return id ? this.getNotesForSemester(id) : []; },
    getSubjects() { return readKey(DB_KEYS.subjects, []); },
    saveSubjects(list) { return writeKey(DB_KEYS.subjects, list); },
    getSubject(id) { return this.getSubjects().find(s => s.id === id); },
    getTasks() { return readKey(DB_KEYS.tasks, []); },
    saveTasks(list) { return writeKey(DB_KEYS.tasks, list); },
    getNotes() { return readKey(DB_KEYS.notes, []); },
    saveNotes(list) { return writeKey(DB_KEYS.notes, list); },
    getAttendance() { return readKey(DB_KEYS.attendance, []); },
    saveAttendance(list) { return writeKey(DB_KEYS.attendance, list); },
    getGrades() { return readKey(DB_KEYS.grades, []); },
    saveGrades(list) { return writeKey(DB_KEYS.grades, list); },
    getGwaCalcRows() { return readKey(DB_KEYS.gwaCalc, []); },
    saveGwaCalcRows(list) { return writeKey(DB_KEYS.gwaCalc, list); },
    getCancelledOccurrences() {
        try { return JSON.parse(localStorage.getItem('sp_cancelled_occurrences') || '[]'); }
        catch (e) { return []; }
    },
    saveCancelledOccurrences(list) {
        try { localStorage.setItem('sp_cancelled_occurrences', JSON.stringify(list)); } catch (e) { /* ignore */ }
    },
    getCalendarEvents() { return readKey(DB_KEYS.calendarEvents, []); },
    saveCalendarEvents(list) { return writeKey(DB_KEYS.calendarEvents, list); },
    // Only ever returns the known schema (DEFAULT_SETTINGS' keys) even if
    // `stored` (local cache, or whatever was last pulled from Supabase's
    // user_preferences row) still has old fields like name/studentNumber/
    // course/yearLevel/school from before those were removed — so a
    // legacy value can't leak back in via the `...stored` spread and
    // doesn't get re-pushed to Supabase on the next save.
    getSettings() {
        const stored = readKey(DB_KEYS.settings, DEFAULT_SETTINGS);
        const merged = {
            ...DEFAULT_SETTINGS,
            ...stored,
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications || {}) }
        };
        const clean = {};
        Object.keys(DEFAULT_SETTINGS).forEach(k => { clean[k] = merged[k]; });
        return clean;
    },
    // Sanitizes the same way getSettings() does, in case a caller is
    // holding an older object (or one hand-built from scratch) that still
    // carries a since-removed legacy key.
    saveSettings(s) {
        const clean = {};
        Object.keys(DEFAULT_SETTINGS).forEach(k => { clean[k] = (s && k in s) ? s[k] : DEFAULT_SETTINGS[k]; });
        if (s && s.notifications) clean.notifications = { ...DEFAULT_SETTINGS.notifications, ...s.notifications };
        return writeKey(DB_KEYS.settings, clean);
    },
    getSemester() { return this.getActiveSemester(); },
    saveSemester(s) { return writeKey(DB_KEYS.semester, s); },
    getPomo() { return readKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] }); },
    savePomo(p) { return writeKey(DB_KEYS.pomodoro, p); },
    clearPrivateCacheOnSignOut() {
        Object.keys(DB_KEYS).forEach(k => {
            if (k === 'settings') return;
            localStorage.removeItem(DB_KEYS[k]);
        });
        ['sp_program_code', 'sp_cloud_last_user_id',
         'sp_cancelled_occurrences', 'sp_cloud_dirty_subjects', 'sp_cloud_dirty_attendance',
         'sp_cloud_dirty_grades', 'sp_cloud_dirty_semesters', 'sp_cloud_dirty_tasks', 'sp_cloud_dirty_collections']
            .forEach(k => localStorage.removeItem(k));
    },
    resetAll() {
        Object.values(DB_KEYS).forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('sp_seeded');
        localStorage.removeItem('sp_initialized');
        localStorage.removeItem('sp_semester_migrated');
        initIfEmpty();
        migrateLegacyData();
    }
};

function academicDateKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

DB.init();

window.addEventListener('planner:semester-context-changed', function (event) {
    if (event.detail && event.detail.activeChanged && !window._semesterContextReloading) {
        window._semesterContextReloading = true;
        window.location.reload();
    }
});

const PROGRAM_KEY = 'sp_program_code';

function getSelectedProgram() {
    try { return localStorage.getItem(PROGRAM_KEY) || ''; }
    catch (e) { return ''; }
}

function setSelectedProgram(code) {
    try { localStorage.setItem(PROGRAM_KEY, code); }
    catch (e) { /* storage unavailable: page falls back to the picker */ }
}

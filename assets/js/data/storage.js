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
    syllabusCourses: 'sp_syllabus_courses',
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
    if (!semesters.length) {
        const schoolYear = (legacySem && legacySem.schoolYear) ? legacySem.schoolYear : '2026-2027';
        const semName = (legacySem && legacySem.name) ? legacySem.name : '1st Semester';
        const sem = makeSemesterObject(schoolYear, semName, legacySem);
        semesters = [sem];
        writeKey(DB_KEYS.semesters, semesters);
    }
    const activeSemId = semesters[0].id;
    if (!localStorage.getItem(DB_KEYS.activeSemesterId)) {
        writeKey(DB_KEYS.activeSemesterId, activeSemId);
    }
    const subjects = readKey(DB_KEYS.subjects, []);
    let subjectsChanged = false;
    subjects.forEach(s => {
        if (!s.semesterId) {
            const match = semesters.find(sem => sem.name === s.semester && sem.schoolYear === s.schoolYear);
            s.semesterId = match ? match.id : activeSemId;
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
            r.semesterId = sub ? sub.semesterId : activeSemId;
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
            g.semesterId = sub ? sub.semesterId : activeSemId;
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
            t.semesterId = sub ? sub.semesterId : activeSemId;
            tasksChanged = true;
        }
    });
    if (tasksChanged)
        writeKey(DB_KEYS.tasks, tasks);
    const notes = readKey(DB_KEYS.notes, []);
    let notesChanged = false;
    notes.forEach(n => {
        if (!n.semesterId) {
            n.semesterId = activeSemId;
            notesChanged = true;
        }
    });
    if (notesChanged)
        writeKey(DB_KEYS.notes, notes);
    const courses = readKey(DB_KEYS.syllabusCourses, []);
    let coursesChanged = false;
    courses.forEach(c => {
        if (!c.semesterId) {
            const match = semesters.find(sem => sem.name === c.semester && sem.schoolYear === c.academicYear);
            c.semesterId = match ? match.id : activeSemId;
            coursesChanged = true;
        }
    });
    if (coursesChanged)
        writeKey(DB_KEYS.syllabusCourses, courses);
    localStorage.setItem('sp_semester_migrated', '1');
}

// FIRST-RUN INIT — creates a clean empty planner (no demo data)

function initIfEmpty() {
    if (localStorage.getItem('sp_initialized'))
        return;
    const defaultSem = makeSemesterObject('2026-2027', '1st Semester', {
        startDate: ymdLocal(new Date()),
        endDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)),
        finalsDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)),
        totalWeeks: 15,
    });
    writeKey(DB_KEYS.semesters, [defaultSem]);
    writeKey(DB_KEYS.activeSemesterId, defaultSem.id);
    writeKey(DB_KEYS.subjects, []);
    writeKey(DB_KEYS.tasks, []);
    writeKey(DB_KEYS.notes, []);
    writeKey(DB_KEYS.attendance, []);
    writeKey(DB_KEYS.grades, []);
    writeKey(DB_KEYS.gwaCalc, []);
    writeKey(DB_KEYS.calendarEvents, []);
    writeKey(DB_KEYS.syllabusCourses, []);
    writeKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] });
    writeKey(DB_KEYS.settings, DEFAULT_SETTINGS);
    writeKey(DB_KEYS.semester, { name: '1st Semester', schoolYear: '2026-2027',
        startDate: ymdLocal(new Date()),
        endDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)),
        finalsDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)),
        totalWeeks: 15 });
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
    getSemesters() { return readKey(DB_KEYS.semesters, []); },
    saveSemesters(list) { return writeKey(DB_KEYS.semesters, list); },
    getActiveSemesterId() {
        const id = readKey(DB_KEYS.activeSemesterId, null);
        if (id)
            return id;
        const sems = this.getSemesters();
        return sems.length ? sems[0].id : null;
    },
    setActiveSemester(id) {
        writeKey(DB_KEYS.activeSemesterId, id);
    },
    getActiveSemester() {
        const id = this.getActiveSemesterId();
        const sems = this.getSemesters();
        return sems.find(s => s.id === id) || sems[0] || null;
    },
    addSemester(schoolYear, semName, extra) {
        const sems = this.getSemesters();
        const newSem = makeSemesterObject(schoolYear, semName, extra);
        if (sems.find(s => s.id === newSem.id))
            return null;
        sems.push(newSem);
        this.saveSemesters(sems);
        return newSem;
    },
    updateSemester(id, data) {
        const sems = this.getSemesters();
        const idx = sems.findIndex(s => s.id === id);
        if (idx === -1)
            return false;
        sems[idx] = { ...sems[idx], ...data };
        this.saveSemesters(sems);
        return true;
    },
    deleteSemester(id) {
        const sems = this.getSemesters();
        if (sems.length <= 1)
            return false;
        const filtered = sems.filter(s => s.id !== id);
        this.saveSemesters(filtered);
        ['subjects', 'tasks', 'notes', 'attendance', 'grades', 'syllabusCourses', 'calendarEvents'].forEach(key => {
            const all = readKey(DB_KEYS[key], []);
            const remaining = all.filter(r => r.semesterId !== id);
            writeKey(DB_KEYS[key], remaining);
        });
        if (this.getActiveSemesterId() === id) {
            this.setActiveSemester(filtered[0].id);
        }
        return true;
    },
    getSubjectsForSemester(semId) { return this.getSubjects().filter(s => s.semesterId === semId); },
    getAttendanceForSemester(semId) { return this.getAttendance().filter(r => r.semesterId === semId); },
    getGradesForSemester(semId) { return this.getGrades().filter(g => g.semesterId === semId); },
    getTasksForSemester(semId) { return this.getTasks().filter(t => t.semesterId === semId); },
    getNotesForSemester(semId) { return this.getNotes().filter(n => n.semesterId === semId); },
    getSyllabusCoursesForSemester(semId) { return this.getSyllabusCourses().filter(c => c.semesterId === semId); },
    getCalendarEventsForSemester(semId) { return this.getCalendarEvents().filter(e => e.semesterId === semId); },
    getActiveSubjects() { return this.getSubjectsForSemester(this.getActiveSemesterId()); },
    getActiveAttendance() { return this.getAttendanceForSemester(this.getActiveSemesterId()); },
    getActiveGrades() { return this.getGradesForSemester(this.getActiveSemesterId()); },
    getActiveTasks() { return this.getTasksForSemester(this.getActiveSemesterId()); },
    getActiveNotes() { return this.getNotesForSemester(this.getActiveSemesterId()); },
    getActiveSyllabusCourses() { return this.getSyllabusCoursesForSemester(this.getActiveSemesterId()); },
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
    getSyllabusCourses() { return readKey(DB_KEYS.syllabusCourses, []); },
    saveSyllabusCourses(list) { return writeKey(DB_KEYS.syllabusCourses, list); },
    getSyllabusCourse(id) { return this.getSyllabusCourses().find(c => c.id === id); },
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
    getSemester() { return this.getActiveSemester() || readKey(DB_KEYS.semester, { name: '1st Semester', schoolYear: '2026-2027', startDate: ymdLocal(new Date()), endDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)), finalsDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)), totalWeeks: 15 }); },
    saveSemester(s) { return writeKey(DB_KEYS.semester, s); },
    getPomo() { return readKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] }); },
    savePomo(p) { return writeKey(DB_KEYS.pomodoro, p); },
    clearPrivateCacheOnSignOut() {
        Object.keys(DB_KEYS).forEach(k => {
            if (k === 'settings') return;
            localStorage.removeItem(DB_KEYS[k]);
        });
        ['sp_program_code', 'sp_cloud_last_user_id', 'sp_cloud_task_syllabus_week_map',
         'sp_cancelled_occurrences', 'sp_cloud_dirty_subjects', 'sp_cloud_dirty_attendance',
         'sp_cloud_dirty_grades', 'sp_cloud_dirty_semesters']
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

DB.init();

const PROGRAM_KEY = 'sp_program_code';

function getSelectedProgram() {
    try { return localStorage.getItem(PROGRAM_KEY) || ''; }
    catch (e) { return ''; }
}

function setSelectedProgram(code) {
    try { localStorage.setItem(PROGRAM_KEY, code); }
    catch (e) { /* storage unavailable: page falls back to the picker */ }
}

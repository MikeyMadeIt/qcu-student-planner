/* ============================================================
   STORAGE.JS — localStorage data layer (Multi-Semester Edition)
   ============================================================ */

const DB_KEYS = {
    subjects: 'sp_subjects',
    tasks: 'sp_tasks',
    notes: 'sp_notes',
    attendance: 'sp_attendance',
    grades: 'sp_grades',
    gwaCalc: 'sp_gwa_calc',
    settings: 'sp_settings',
    semester: 'sp_semester', // legacy single-semester (kept for migration)
    pomodoro: 'sp_pomodoro_stats',
    universityEvents: 'sp_university_events',
    calendarEvents: 'sp_calendar_events',
    syllabusCourses: 'sp_syllabus_courses',
    semesters: 'sp_semesters', // array of semester objects
    activeSemesterId: 'sp_active_semester_id',
};

/* ============================================================
   CURRENT EXPORT SCHEMA VERSION
   Bump when data shape changes incompatibly.
   ============================================================ */

const EXPORT_SCHEMA_VERSION = 1;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

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
        return true;
    }
    catch (e) {
        console.warn('DB write failed', key, e);
        return false;
    }
}

const DEFAULT_SETTINGS = {
    name: 'Student', studentNumber: '', course: '', yearLevel: '', section: '', school: '',
    theme: 'dark', accent: 'blue',
    notifications: { upcomingClass: true, assignmentDue: true, examReminder: true, pomodoroFinished: true, dailyReview: false },
};

const SUBJECT_COLORS = ['#2457D6', '#1F9254', '#B45309', '#D6433C', '#6D5BD6', '#0E8C8C', '#C2498A', '#4B5563'];
/* ============================================================
   SEMESTER HELPERS
   ============================================================ */

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

/* ============================================================
   DATA MIGRATION — run once safely
   ============================================================ */

function migrateLegacyData() {
    if (localStorage.getItem('sp_semester_migrated'))
        return;
    const legacySem = readKey(DB_KEYS.semester, null);
    let semesters = readKey(DB_KEYS.semesters, []);
    // If no semester list yet, build from legacy or create default
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
    // Migrate subjects — add semesterId if missing
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
    // Migrate attendance
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
    // Migrate grades
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
    // Migrate tasks
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
    // Migrate notes
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
    // Migrate syllabus courses
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

/* ============================================================
   FIRST-RUN INIT — creates a clean empty planner (no demo data)
   ============================================================ */

function initIfEmpty() {
    // Already initialized
    if (localStorage.getItem('sp_initialized'))
        return;
    // Build a default semester so the app is functional immediately
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
    writeKey(DB_KEYS.universityEvents, []);
    writeKey(DB_KEYS.calendarEvents, []);
    writeKey(DB_KEYS.syllabusCourses, []);
    writeKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] });
    writeKey(DB_KEYS.settings, DEFAULT_SETTINGS);
    // Keep legacy semester key for backward compat
    writeKey(DB_KEYS.semester, { name: '1st Semester', schoolYear: '2026-2027',
        startDate: ymdLocal(new Date()),
        endDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)),
        finalsDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)),
        totalWeeks: 15 });
    localStorage.setItem('sp_initialized', '1');
    localStorage.setItem('sp_semester_migrated', '1');
}

/* ============================================================
   IMPORT VALIDATION
   ============================================================ */

function validateImport(obj) {
    // Must be a plain object
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return { valid: false, error: 'File does not contain a valid backup object.' };
    }
    // Accept both new schema-versioned format and legacy raw format
    const isNewFormat = ('schemaVersion' in obj) && ('data' in obj);
    const isLegacyFormat = !isNewFormat && ('subjects' in obj || 'tasks' in obj || 'semesters' in obj);
    if (!isNewFormat && !isLegacyFormat) {
        return { valid: false, error: 'File does not appear to be a Student Planner backup.' };
    }
    // Schema version check (new format)
    if (isNewFormat) {
        const ver = obj.schemaVersion;
        if (typeof ver !== 'number' || ver < 1) {
            return { valid: false, error: `Unsupported backup schema version (${ver}). Please export a fresh backup.` };
        }
        if (ver > EXPORT_SCHEMA_VERSION) {
            return { valid: false, error: `Backup was created with a newer version of the app (schema v${ver}). Please update the app.` };
        }
        const data = obj.data;
        if (!data || typeof data !== 'object') {
            return { valid: false, error: 'Backup "data" section is missing or malformed.' };
        }
        // Check arrays
        const arrayFields = ['subjects', 'tasks', 'notes', 'attendance', 'grades', 'semesters', 'calendarEvents', 'syllabusCourses'];
        for (const f of arrayFields) {
            if (data[f] !== undefined && !Array.isArray(data[f])) {
                return { valid: false, error: `Field "${f}" must be an array but got ${typeof data[f]}.` };
            }
        }
    }
    // Legacy format: check that arrays are arrays
    if (isLegacyFormat) {
        const arrayFields = ['subjects', 'tasks', 'notes', 'attendance', 'grades', 'semesters', 'calendarEvents', 'syllabusCourses'];
        for (const f of arrayFields) {
            if (obj[f] !== undefined && !Array.isArray(obj[f])) {
                return { valid: false, error: `Field "${f}" must be an array but got ${typeof obj[f]}.` };
            }
        }
    }
    return { valid: true, isNewFormat, isLegacyFormat };
}

/* ============================================================
   DB OBJECT
   ============================================================ */

const DB = {
    init() {
        // If user has old 'sp_seeded' flag (pre-Phase1), treat as initialized
        if (localStorage.getItem('sp_seeded') && !localStorage.getItem('sp_initialized')) {
            localStorage.setItem('sp_initialized', '1');
        }
        initIfEmpty();
        migrateLegacyData();
    },
    uid,
    colors: SUBJECT_COLORS,
    EXPORT_SCHEMA_VERSION,
    // generic
    get(key, fallback) { return readKey(DB_KEYS[key], fallback); },
    set(key, value) { return writeKey(DB_KEYS[key], value); },
    /* ---- SEMESTER MANAGEMENT ---- */
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
        // Delete all data belonging to this semester
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
    /* ---- SEMESTER-FILTERED DATA HELPERS ---- */
    getSubjectsForSemester(semId) { return this.getSubjects().filter(s => s.semesterId === semId); },
    getAttendanceForSemester(semId) { return this.getAttendance().filter(r => r.semesterId === semId); },
    getGradesForSemester(semId) { return this.getGrades().filter(g => g.semesterId === semId); },
    getTasksForSemester(semId) { return this.getTasks().filter(t => t.semesterId === semId); },
    getNotesForSemester(semId) { return this.getNotes().filter(n => n.semesterId === semId); },
    getSyllabusCoursesForSemester(semId) { return this.getSyllabusCourses().filter(c => c.semesterId === semId); },
    getCalendarEventsForSemester(semId) { return this.getCalendarEvents().filter(e => e.semesterId === semId); },
    /* ---- ACTIVE SEMESTER SHORTCUTS ---- */
    getActiveSubjects() { return this.getSubjectsForSemester(this.getActiveSemesterId()); },
    getActiveAttendance() { return this.getAttendanceForSemester(this.getActiveSemesterId()); },
    getActiveGrades() { return this.getGradesForSemester(this.getActiveSemesterId()); },
    getActiveTasks() { return this.getTasksForSemester(this.getActiveSemesterId()); },
    getActiveNotes() { return this.getNotesForSemester(this.getActiveSemesterId()); },
    getActiveSyllabusCourses() { return this.getSyllabusCoursesForSemester(this.getActiveSemesterId()); },
    /* ---- RAW DATA (full arrays, all semesters) ---- */
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
    getUniversityEvents() { return readKey(DB_KEYS.universityEvents, []); },
    saveUniversityEvents(list) { return writeKey(DB_KEYS.universityEvents, list); },
    getCalendarEvents() { return readKey(DB_KEYS.calendarEvents, []); },
    saveCalendarEvents(list) { return writeKey(DB_KEYS.calendarEvents, list); },
    getSyllabusCourses() { return readKey(DB_KEYS.syllabusCourses, []); },
    saveSyllabusCourses(list) { return writeKey(DB_KEYS.syllabusCourses, list); },
    getSyllabusCourse(id) { return this.getSyllabusCourses().find(c => c.id === id); },
    getSettings() {
        const stored = readKey(DB_KEYS.settings, DEFAULT_SETTINGS);
        return {
            ...DEFAULT_SETTINGS,
            ...stored,
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications || {}) }
        };
    },
    saveSettings(s) { return writeKey(DB_KEYS.settings, s); },
    // Legacy single-semester support
    getSemester() { return this.getActiveSemester() || readKey(DB_KEYS.semester, { name: '1st Semester', schoolYear: '2026-2027', startDate: ymdLocal(new Date()), endDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 105)), finalsDate: ymdLocal(new Date(Date.now() + 1000 * 60 * 60 * 24 * 100)), totalWeeks: 15 }); },
    saveSemester(s) { return writeKey(DB_KEYS.semester, s); },
    getPomo() { return readKey(DB_KEYS.pomodoro, { sessionsToday: 0, totalFocusMinutes: 0, lastDate: new Date().toDateString(), history: [] }); },
    savePomo(p) { return writeKey(DB_KEYS.pomodoro, p); },
    /* ---- EXPORT / IMPORT (schema-versioned) ---- */
    exportAll() {
        return {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            appVersion: '2.1.0',
            data: {
                semesters: readKey(DB_KEYS.semesters, []),
                activeSemesterId: readKey(DB_KEYS.activeSemesterId, null),
                subjects: readKey(DB_KEYS.subjects, []),
                tasks: readKey(DB_KEYS.tasks, []),
                notes: readKey(DB_KEYS.notes, []),
                attendance: readKey(DB_KEYS.attendance, []),
                grades: readKey(DB_KEYS.grades, []),
                gwaCalc: readKey(DB_KEYS.gwaCalc, []),
                calendarEvents: readKey(DB_KEYS.calendarEvents, []),
                syllabusCourses: readKey(DB_KEYS.syllabusCourses, []),
                universityEvents: readKey(DB_KEYS.universityEvents, []),
                settings: readKey(DB_KEYS.settings, DEFAULT_SETTINGS),
                pomodoro: readKey(DB_KEYS.pomodoro, null),
            }
        };
    },
    importAll(obj) {
        // Determine data source
        let data;
        if (obj.schemaVersion && obj.data) {
            // New format
            data = obj.data;
        }
        else {
            // Legacy format — keys match DB_KEYS keys directly
            data = obj;
        }
        // Write each field if present and valid
        const arrayFields = ['subjects', 'tasks', 'notes', 'attendance', 'grades', 'gwaCalc', 'calendarEvents', 'syllabusCourses', 'universityEvents', 'semesters'];
        arrayFields.forEach(k => {
            if (Array.isArray(data[k]))
                writeKey(DB_KEYS[k], data[k]);
        });
        if (data.activeSemesterId !== undefined)
            writeKey(DB_KEYS.activeSemesterId, data.activeSemesterId);
        if (data.settings && typeof data.settings === 'object')
            writeKey(DB_KEYS.settings, data.settings);
        if (data.pomodoro && typeof data.pomodoro === 'object')
            writeKey(DB_KEYS.pomodoro, data.pomodoro);
        // Ensure semesters list is not empty after import
        const sems = readKey(DB_KEYS.semesters, []);
        if (!sems.length) {
            const fallbackSem = makeSemesterObject('2026-2027', '1st Semester', {});
            writeKey(DB_KEYS.semesters, [fallbackSem]);
            writeKey(DB_KEYS.activeSemesterId, fallbackSem.id);
        }
        localStorage.setItem('sp_initialized', '1');
        localStorage.setItem('sp_semester_migrated', '1');
        return true;
    },
    validateImport,
    /* ---- RESET — clears planner data, leaves app functional ---- */
    resetAll() {
        // Remove all planner data
        Object.values(DB_KEYS).forEach(k => localStorage.removeItem(k));
        // Remove init flags so initIfEmpty() runs fresh
        localStorage.removeItem('sp_seeded');
        localStorage.removeItem('sp_initialized');
        localStorage.removeItem('sp_semester_migrated');
        // Re-initialize with clean empty state (no demo data)
        initIfEmpty();
        migrateLegacyData();
    }
};

DB.init();

/* ============================================================
   SELECTED PROGRAM (set at registration, changeable on Curriculum page)
   ============================================================ */

const PROGRAM_KEY = 'sp_program_code';

function getSelectedProgram() {
    try { return localStorage.getItem(PROGRAM_KEY) || ''; }
    catch (e) { return ''; }
}

function setSelectedProgram(code) {
    try { localStorage.setItem(PROGRAM_KEY, code); }
    catch (e) { /* storage unavailable: page falls back to the picker */ }
}

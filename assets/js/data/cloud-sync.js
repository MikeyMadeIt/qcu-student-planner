/* ============================================================
   CLOUD-SYNC.JS — Supabase persistence for Subjects / Schedule /
   Calendar / Tasks / Notes / Attendance / Grades & GWA / Syllabus,
   layered on top of storage.js (DB.*) so that tasks.js / schedule.js /
   calendar.js / notes.js / attendance.js / grades.js / syllabus.js —
   and anything else that reads this data — keep working exactly as
   before. storage.js remains the synchronous read/write cache the UI
   talks to; this file is the thing that keeps it in sync with
   Postgres under the hood.

   Grades: `grades` + `grade_components` + `grade_assessments` are kept
   as real relational rows (the local nested shape maps onto them 1:1).
   Syllabus: the local course shape (course + weeks + topics + outcomes
   + activities + resources + assessments) has far more fields than
   `syllabus_courses`/`syllabus_weeks`/`syllabus_topics` have columns
   for, so the whole course object is stored as-is in a new
   `syllabus_courses.data jsonb` column (see migration 0015) with the
   handful of matching top-level columns kept in sync alongside it for
   future querying. `syllabus_weeks`/`syllabus_topics` are left unused
   rather than half-normalized — a true relational breakdown of that
   feature is a larger follow-up, noted in the summary.

   Pattern:
     1. On every app page, hydrate() pulls the signed-in user's
        subjects / tasks (+checklist items) / calendar_events and
        writes them into the same localStorage keys storage.js
        already uses (via DB.set, which does NOT re-trigger cloud
        sync), so DB.getSubjects()/getTasks()/getCalendarEvents()
        return live data straight out of Postgres.
     2. DB.saveSubjects / DB.saveTasks / DB.saveCalendarEvents are
        wrapped: the original localStorage write still happens
        first (so the UI updates instantly, unchanged), then the
        new list is diffed against the last known server list and
        the difference (insert/update/delete) is pushed to Supabase
        in the background.
     3. Semesters are a local-only concept (out of scope for this
        migration) — a small localStorage-side map remembers which
        semester each cloud record belongs to, so multi-semester
        filtering keeps working without needing a real semester_id.
   ============================================================ */

(function () {
    const MAP_KEY = 'sp_cloud_semester_map';

    /* MAJ-12: every push*() below is fired-and-forgotten by the DB.saveX wrappers
       (so the UI never blocks on the network) -- but that means signOut() could
       previously kill the Supabase session and wipe the local cache (see
       clearPrivateCacheOnSignOut) WHILE a save was still in flight. The save's
       getUserId() lookup would then come back empty (no session left), the push
       would silently no-op, and the edit the student just made -- most visibly a
       grade breakdown or a newly added semester -- would be gone for good on the
       next login, even though it looked saved right up until logout.
       trackPush() records every in-flight push promise; waitForPendingPushes()
       (exposed as window.CloudSync.waitForPendingSync) lets signOut() wait for
       them to actually land before it tears down the session/cache. A timeout
       keeps a stuck network call from blocking logout forever. */
    let _pending = [];
    function trackPush(p) {
        const entry = p.catch(() => {});
        _pending.push(entry);
        entry.finally(() => { _pending = _pending.filter(x => x !== entry); });
        return p;
    }
    function waitForPendingPushes(timeoutMs) {
        const all = Promise.all(_pending.slice());
        if (!timeoutMs) return all;
        return Promise.race([
            all,
            new Promise(resolve => setTimeout(resolve, timeoutMs)),
        ]);
    }
    window.CloudSync = window.CloudSync || {};
    window.CloudSync.waitForPendingSync = function (timeoutMs) {
        return waitForPendingPushes(timeoutMs != null ? timeoutMs : 8000);
    };
    // Lets a page (e.g. Settings > Sync Status) show the student the last sync
    // failure in plain language without needing a desktop browser's DevTools.
    window.CloudSync.getLastSyncError = function () { return getLastSyncError(); };

    function loadMap() {
        const empty = { subjects: {}, tasks: {}, calendarEvents: {}, notes: {}, attendance: {}, grades: {}, syllabusCourses: {} };
        try { return Object.assign(empty, JSON.parse(localStorage.getItem(MAP_KEY)) || {}); }
        catch (e) { return empty; }
    }
    function saveMap(m) {
        try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
    }
    function semFor(bucket, id) {
        const m = loadMap();
        return (m[bucket] && m[bucket][id]) || DB.getActiveSemesterId();
    }
    function setSemFor(bucket, id, semId) {
        const m = loadMap();
        if (!m[bucket]) m[bucket] = {};
        m[bucket][id] = semId;
        saveMap(m);
    }
    function dropSemFor(bucket, id) {
        const m = loadMap();
        if (m[bucket]) delete m[bucket][id];
        saveMap(m);
    }

    // Students on mobile have no DevTools console to see why a save failed --
    // the toast (see ui.js) was the only trace, and it auto-faded in 2.6s. Every
    // sync failure is now also written here so it can be read back later (e.g.
    // from Settings > Sync Status) instead of relying on having seen the toast
    // in time. Successes clear it so a stale error doesn't linger forever.
    const LAST_ERROR_KEY = 'sp_cloud_last_error';
    function recordSyncError(area, message) {
        try {
            localStorage.setItem(LAST_ERROR_KEY, JSON.stringify({ area, message: String(message || 'Unknown error'), at: Date.now() }));
        } catch (e) { /* ignore */ }
    }
    function clearSyncError() {
        try { localStorage.removeItem(LAST_ERROR_KEY); } catch (e) { /* ignore */ }
    }
    function getLastSyncError() {
        try { return JSON.parse(localStorage.getItem(LAST_ERROR_KEY)); } catch (e) { return null; }
    }

    function toast(msg, kind, area) {
        if (kind === 'high' || kind === 'danger') recordSyncError(area || 'sync', msg);
        if (window.Toast && typeof window.Toast.show === 'function') {
            window.Toast.show(msg, kind || 'high', 'bi-cloud-slash');
        }
    }

    const WEEK_LINK_KEY = 'sp_cloud_task_syllabus_week_map';
    function weekLinkFor(taskId) {
        try {
            const m = JSON.parse(localStorage.getItem(WEEK_LINK_KEY)) || {};
            return m[taskId] || null;
        } catch (e) { return null; }
    }
    function setWeekLink(taskId, weekId) {
        try {
            const m = JSON.parse(localStorage.getItem(WEEK_LINK_KEY)) || {};
            if (weekId) m[taskId] = weekId; else delete m[taskId];
            localStorage.setItem(WEEK_LINK_KEY, JSON.stringify(m));
        } catch (e) { /* ignore */ }
    }

    function hhmm(t) { return t ? String(t).slice(0, 5) : ''; }
    function isUuid(id) { return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); }

    const DIRTY_SUBJ_KEY = 'sp_cloud_dirty_subjects';
    function getDirty() {
        try { return new Set(JSON.parse(localStorage.getItem(DIRTY_SUBJ_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function setDirty(set) {
        try { localStorage.setItem(DIRTY_SUBJ_KEY, JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    const DIRTY_ATT_KEY = 'sp_cloud_dirty_attendance';
    function getDirtyAtt() {
        try { return new Set(JSON.parse(localStorage.getItem(DIRTY_ATT_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function setDirtyAtt(set) {
        try { localStorage.setItem(DIRTY_ATT_KEY, JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    /* MAJ-10: grades previously had no dirty-tracking at all, so a save that
       hadn't finished reaching Supabase yet (pushGrades runs in the
       background, un-awaited) could be silently clobbered by the very next
       hydrate() on the next page load -- the grading breakdown the student
       just saved would "disappear" the moment they navigated away and back.
       Mirrors the subjects/attendance dirty pattern above. */
    const DIRTY_GRADES_KEY = 'sp_cloud_dirty_grades';
    function getDirtyGrades() {
        try { return new Set(JSON.parse(localStorage.getItem(DIRTY_GRADES_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function setDirtyGrades(set) {
        try { localStorage.setItem(DIRTY_GRADES_KEY, JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    /* MAJ-11: semesters (Settings > Academic Semester Management) used to be
       purely local-only -- never pushed to Supabase at all -- so
       clearPrivateCacheOnSignOut() wiping the local cache on logout meant any
       semester the student added was permanently gone the next time they
       signed in. Synced the same write-through + dirty-tracking way as
       everything else now; see semesterRowToLocal/semesterLocalToRow below. */
    const DIRTY_SEM_KEY = 'sp_cloud_dirty_semesters';
    function getDirtySem() {
        try { return new Set(JSON.parse(localStorage.getItem(DIRTY_SEM_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function setDirtySem(set) {
        try { localStorage.setItem(DIRTY_SEM_KEY, JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    /* ---------- loading overlay ---------- */
    let overlayCount = 0;
    function showLoader() {
        overlayCount++;
        if (document.getElementById('cloudSyncLoader')) return;
        const el = document.createElement('div');
        el.id = 'cloudSyncLoader';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:var(--bg,#111318);opacity:.97;';
        el.innerHTML = '<div class="spinner-border" style="width:2.5rem;height:2.5rem;color:rgb(var(--accent,36,87,214))"></div>' +
            '<div style="color:var(--text-soft,#A1A8B5);font-size:.9rem">Loading your data…</div>';
        document.body.appendChild(el);
    }
    function hideLoader() {
        overlayCount = Math.max(0, overlayCount - 1);
        if (overlayCount > 0) return;
        const el = document.getElementById('cloudSyncLoader');
        if (el) el.remove();
    }

    /* ---------- supabase handle ---------- */
    let _supabasePromise = null;
    function getClient() {
        if (!_supabasePromise) {
            _supabasePromise = import('../core/supabase-client.js').then(m => m.getSupabase());
        }
        return _supabasePromise;
    }

    async function getUserId() {
        try {
            const supabase = await getClient();
            const { data } = await supabase.auth.getSession();
            return data && data.session ? data.session.user.id : null;
        } catch (e) {
            return null;
        }
    }

    /* ---------- row <-> local mappers ---------- */

    function subjectRowToLocal(row) {
        return {
            id: row.id,
            code: row.code || '',
            desc: row.description || '',
            type: row.type || '',
            units: row.units != null ? Number(row.units) : 0,
            section: row.section || '',
            days: Array.isArray(row.days) ? row.days : [],
            start: hhmm(row.start_time),
            end: hhmm(row.end_time),
            online: !!row.online,
            room: row.room || '',
            building: row.building || '',
            professor: row.professor || '',
            email: row.professor_email || '',
            color: row.color || '',
            notes: row.notes || '',
            absenceLimit: row.absence_limit != null ? row.absence_limit : null,
            archived: !!row.archived,
            semesterId: semFor('subjects', row.id),
        };
    }
    function subjectLocalToRow(s, userId) {
        return {
            id: s.id, user_id: userId,
            code: s.code || '', description: s.desc || '', type: s.type || '',
            units: s.units || 0, section: s.section || '',
            days: Array.isArray(s.days) ? s.days : [],
            start_time: s.start || null, end_time: s.end || null,
            online: !!s.online, room: s.room || '', building: s.building || '',
            professor: s.professor || '', professor_email: s.email || '',
            color: s.color || '', notes: s.notes || '',
            absence_limit: s.absenceLimit != null && s.absenceLimit !== '' ? s.absenceLimit : null,
            archived: !!s.archived,
        };
    }

    function taskRowToLocal(row, checklist) {
        return {
            id: row.id,
            title: row.title || '',
            description: row.description || '',
            subjectId: row.subject_id || null,
            // NOT read from row.syllabus_week_id -- see note in taskLocalToRow.
            syllabusWeekId: weekLinkFor(row.id),
            category: row.category || '',
            priority: row.priority || 'medium',
            dueDate: row.due_date || '',
            dueTime: hhmm(row.due_time),
            status: row.status || 'not-started',
            progress: row.progress || 0,
            reminder: !!row.reminder,
            remindBeforeMin: row.remind_before_min != null ? row.remind_before_min : null,
            repeat: row.repeat || 'none',
            timeEstimate: row.time_estimate_min || 0,
            score: row.score != null ? Number(row.score) : null,
            remarks: row.remarks || '',
            completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
            checklist: (checklist || []).map(c => ({ id: c.id, text: c.text, done: !!c.done })),
            semesterId: semFor('tasks', row.id),
        };
    }
    function taskLocalToRow(t, userId) {
        return {
            id: t.id, user_id: userId,
            title: t.title || '', description: t.description || '',
            subject_id: t.subjectId || null,
            // Deliberately NOT t.syllabusWeekId: a syllabus week's id (`w.id`) only
            // exists inside syllabus_courses.data (jsonb) -- the real syllabus_weeks
            // table is intentionally left unpopulated (see migration 0015), so there
            // is no row for this FK column to point at, and a security-audit
            // ownership trigger (0016, tasks_guard_fk) now also rejects a
            // syllabus_week_id that isn't a real owned row. The link is instead kept
            // client-side only, see weekLinkFor/setWeekLink below.
            syllabus_week_id: null,
            category: t.category || null, priority: t.priority || 'medium',
            due_date: t.dueDate || null, due_time: t.dueTime || null,
            status: t.status || 'not-started', progress: t.progress || 0,
            reminder: !!t.reminder, remind_before_min: t.remindBeforeMin || null,
            repeat: t.repeat || 'none', time_estimate_min: t.timeEstimate || null,
            score: t.score != null && t.score !== '' ? t.score : null,
            remarks: t.remarks || '',
            completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
            updated_at: new Date().toISOString(),
        };
    }

    function eventRowToLocal(row) {
        return {
            id: row.id, title: row.title || '', date: row.date,
            startTime: hhmm(row.start_time), endTime: hhmm(row.end_time),
            category: row.category || '', color: row.color || '',
            description: row.note || '',
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            semesterId: semFor('calendarEvents', row.id),
        };
    }
    function eventLocalToRow(e, userId) {
        return {
            id: e.id, user_id: userId, title: e.title || '', date: e.date,
            start_time: e.startTime || null, end_time: e.endTime || null,
            category: e.category || null, color: e.color || null, note: e.description || '',
        };
    }

    function notesRowToLocal(row) {
        return {
            id: row.id, title: row.title || '', content: row.content || '',
            category: row.category || '', pinned: !!row.pinned, favorite: !!row.favorite,
            subjectId: row.subject_id || null, taskId: row.task_id || null,
            tags: Array.isArray(row.tags) ? row.tags : [],
            checklist: [], // not persisted server-side; see notesLocalToRow note below
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
            semesterId: semFor('notes', row.id),
        };
    }
    function notesLocalToRow(n, userId) {
        // `checklist` has no column on `notes` (and nothing in notes.js ever populates
        // it today) -- everything else round-trips.
        return {
            id: n.id, user_id: userId, title: n.title || '', content: n.content || '',
            category: n.category || null, pinned: !!n.pinned, favorite: !!n.favorite,
            subject_id: n.subjectId || null, task_id: n.taskId || null,
            tags: Array.isArray(n.tags) ? n.tags : [],
            updated_at: new Date().toISOString(),
        };
    }

    function attendanceRowToLocal(row) {
        return {
            id: row.id, subjectId: row.subject_id, date: row.date, status: row.status || '',
            online: !!row.online, notes: row.notes || '',
            semesterId: semFor('attendance', row.id),
        };
    }
    function attendanceLocalToRow(r, userId) {
        return {
            id: r.id, user_id: userId, subject_id: r.subjectId, date: r.date,
            status: r.status || '', online: !!r.online, notes: r.notes || '',
            updated_at: new Date().toISOString(),
        };
    }

    function gwaRowToLocal(row) {
        return { id: row.id, label: row.label || '', units: row.units != null ? row.units : '', grade: row.grade != null ? row.grade : '' };
    }
    function gwaLocalToRow(r, userId) {
        return {
            id: r.id, user_id: userId, label: r.label || '',
            units: r.units === '' || r.units == null ? 0 : (+r.units || 0),
            grade: r.grade === '' || r.grade == null ? 0 : (+r.grade || 0),
            updated_at: new Date().toISOString(),
        };
    }

    function gradeRowToLocal(row, components, assessmentsByComponent) {
        return {
            id: row.id,
            subjectId: row.subject_id,
            semesterId: semFor('grades', row.id),
            components: (components || []).map(c => ({
                id: c.id, name: c.name || '', weight: c.weight != null ? Number(c.weight) : 0,
                assessments: (assessmentsByComponent[c.id] || []).map(a => ({
                    id: a.id, name: a.name || '',
                    score: a.score != null ? Number(a.score) : null,
                    totalItems: a.total_items != null ? Number(a.total_items) : null,
                })),
            })),
        };
    }

    /* ---------- server-side semester placeholder ----------
       `grades.semester_id` and `syllabus_courses.semester_id` are NOT NULL FKs to
       the real `semesters` table. This project's multi-semester feature is local-only
       (out of scope for this migration), so there's no real semester row to point at.
       We lazily create ONE small placeholder semester row per user the first time it's
       needed and reuse its id to satisfy that FK -- it is never shown in the app UI. */
    const SERVER_SEM_KEY = 'sp_cloud_server_semester_id';
    async function getServerSemesterId(userId) {
        let id = null;
        try { id = localStorage.getItem(SERVER_SEM_KEY); } catch (e) { /* ignore */ }
        if (id) return id;
        const supabase = await getClient();
        // Look for an already-existing placeholder row FIRST. SERVER_SEM_KEY can go
        // missing even though the server-side row still exists (cleared localStorage
        // for troubleshooting, a different browser/device, etc.) -- blindly inserting
        // in that case hits the table's own (user_id, school_year, name) unique
        // constraint and fails every single grade/semester push with "duplicate key
        // value violates unique constraint ... semesters_user_school_year_name_key".
        const { data: existing, error: selErr } = await supabase
            .from('semesters')
            .select('id')
            .eq('user_id', userId)
            .is('client_id', null)
            .limit(1)
            .maybeSingle();
        if (!selErr && existing && existing.id) {
            try { localStorage.setItem(SERVER_SEM_KEY, existing.id); } catch (e) { /* ignore */ }
            return existing.id;
        }
        const { data, error } = await supabase
            .from('semesters')
            .insert({ user_id: userId, name: 'My Planner Data', school_year: String(new Date().getFullYear()), total_weeks: 15, is_active: true })
            .select('id')
            .single();
        if (error) {
            // 23505 = unique_violation: another tab/request created the placeholder
            // between our select and this insert. Re-select instead of failing.
            if (error.code === '23505') {
                const { data: retry } = await supabase.from('semesters').select('id').eq('user_id', userId).is('client_id', null).limit(1).maybeSingle();
                if (retry && retry.id) {
                    try { localStorage.setItem(SERVER_SEM_KEY, retry.id); } catch (e) { /* ignore */ }
                    return retry.id;
                }
            }
            throw error;
        }
        if (!data) throw new Error('Could not create placeholder semester');
        try { localStorage.setItem(SERVER_SEM_KEY, data.id); } catch (e) { /* ignore */ }
        return data.id;
    }

    /* `semesters.client_id` holds the local deterministic id (e.g. "2026-2027-1",
       see makeSemesterId() in storage.js) so a row can be matched back up on
       the next hydrate without needing a separate id-mapping table. The
       pre-existing placeholder row created by getServerSemesterId() below has
       client_id = null on purpose, so it's never picked up as a real semester
       by semesterRowToLocal's caller (hydrate filters client_id is not null). */
    function semesterRowToLocal(row) {
        return {
            id: row.client_id,
            name: row.name || '',
            schoolYear: row.school_year || '',
            startDate: row.start_date || '',
            endDate: row.end_date || '',
            finalsDate: row.finals_date || '',
            totalWeeks: row.total_weeks != null ? Number(row.total_weeks) : 15,
        };
    }
    function semesterLocalToRow(s, userId, activeId) {
        return {
            user_id: userId, client_id: s.id,
            name: s.name || '', school_year: s.schoolYear || '',
            start_date: s.startDate || null, end_date: s.endDate || null,
            finals_date: s.finalsDate || null, total_weeks: s.totalWeeks || 15,
            // MAJ-13: which semester is "active" (the one the Settings > Academic
            // Semester Management picker currently has selected) was never synced
            // at all -- it only ever lived in localStorage's sp_active_semester_id,
            // which clearPrivateCacheOnSignOut() wipes on every logout. The real
            // semester objects (and their grades, tied to them via semesterId)
            // were still on the server after re-login, but getActiveSemesterId()
            // fell back to the chronologically-first semester, so the grade
            // breakdown and semester banner for whichever semester the student
            // had actually been using just silently stopped showing -- looking
            // exactly like the data had disappeared. Piggybacking this flag onto
            // the existing is_active column (previously only ever true on the
            // throwaway placeholder row) lets hydrate() below restore it.
            is_active: s.id === activeId,
        };
    }

    function syllabusRowToLocal(row) {
        const d = (row.data && typeof row.data === 'object') ? row.data : {};
        return Object.assign({
            courseTitle: row.course_title || '', courseCode: row.course_code || '',
            creditUnits: row.credit_units != null ? Number(row.credit_units) : 0,
            courseDescription: row.description || '', instructor: row.instructor || '',
            schedule: '', room: '', semester: '', academicYear: '', semesterId: semFor('syllabusCourses', row.id),
            courseOutcomes: [], gradingComponents: [], requirements: '', policies: '', references: '',
            weeks: [], createdAt: Date.now(), updatedAt: Date.now(),
        }, d, { id: row.id });
    }
    function syllabusLocalToRow(c, userId, serverSemId) {
        return {
            id: c.id, user_id: userId, semester_id: serverSemId,
            course_code: c.courseCode || '', course_title: c.courseTitle || '',
            credit_units: c.creditUnits || 0, description: c.courseDescription || null,
            instructor: c.instructor || null, data: c,
            updated_at: new Date().toISOString(),
        };
    }

    /* ---------- last-known-server snapshots (for diffing) ---------- */
    const last = {
        subjects: new Map(), tasks: new Map(), calendarEvents: new Map(),
        notes: new Map(), attendance: new Map(), grades: new Map(),
        gwaCalc: new Map(), syllabusCourses: new Map(), semesters: new Map(),
    };
    // AJ-08: cancelled occurrences snapshot (not diffed per-row; whole-blob replace)
    let _lastCancelledJson = '[]';

    /* ---------- hydrate (pull) ---------- */

    const LAST_USER_KEY = 'sp_cloud_last_user_id';

    async function hydrate() {
        const userId = await getUserId();
        if (!userId) return;
        await _subjQueue; // not signed in yet / auth guard will redirect
        await _attQueue;

        // Defense in depth against stale cross-student data on a shared device:
        // AuthService.signOut() already wipes this cache (see storage.js
        // clearPrivateCacheOnSignOut), but if a session ever changes to a
        // *different* user without going through that path (e.g. a stale tab,
        // or a session swapped in devtools), don't let that other student's
        // cached subjects/tasks/notes/etc. render even for the instant before
        // this hydrate's fetch resolves.
        let lastUserId = null;
        try { lastUserId = localStorage.getItem(LAST_USER_KEY); } catch (e) { /* ignore */ }
        if (lastUserId && lastUserId !== userId) {
            DB.clearPrivateCacheOnSignOut();
            // MAJ-14: clearPrivateCacheOnSignOut() deliberately leaves the semester
            // bookkeeping map/placeholder-id alone now (see storage.js) since a plain
            // logout needs them to survive for the SAME student's next login. This is
            // the one path that's actually a different student landing in this tab, so
            // scrub those two here instead, directly.
            try {
                localStorage.removeItem(MAP_KEY);
                localStorage.removeItem(SERVER_SEM_KEY);
            } catch (e) { /* ignore */ }
        }
        try { localStorage.setItem(LAST_USER_KEY, userId); } catch (e) { /* ignore */ }

        try {
            const supabase = await getClient();

            const [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes, gwaRes, sylRes, coRes, semRes] = await Promise.all([
                supabase.from('subjects').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
                supabase.from('tasks').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
                supabase.from('task_checklist_items').select('*').order('position', { ascending: true }),
                supabase.from('calendar_events').select('*').eq('user_id', userId).order('date', { ascending: true }),
                supabase.from('notes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('attendance').select('*').eq('user_id', userId).order('date', { ascending: true }),
                supabase.from('grades').select('*').eq('user_id', userId),
                supabase.from('grade_components').select('*').order('position', { ascending: true }),
                supabase.from('grade_assessments').select('*').order('position', { ascending: true }),
                supabase.from('gwa_calculator').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
                supabase.from('syllabus_courses').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
                // AJ-08: single-row blob storing cancelled class occurrences
                supabase.from('cancelled_occurrences').select('occurrences').eq('user_id', userId).maybeSingle(),
                // MAJ-11: real per-semester rows (client_id not null excludes the
                // one legacy placeholder row used only to satisfy grades/syllabus FKs)
                supabase.from('semesters').select('*').eq('user_id', userId).not('client_id', 'is', null).order('created_at', { ascending: true }),
            ]);

            const firstError = [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes, gwaRes, sylRes, coRes, semRes]
                .map(r => r.error).find(Boolean);
            if (firstError) throw firstError;

            const checklistByTask = {};
            (clRes.data || []).forEach(c => {
                (checklistByTask[c.task_id] = checklistByTask[c.task_id] || []).push(c);
            });
            const assessmentsByComponent = {};
            (gaRes.data || []).forEach(a => {
                (assessmentsByComponent[a.component_id] = assessmentsByComponent[a.component_id] || []).push(a);
            });
            const componentsByGrade = {};
            (gcRes.data || []).forEach(c => {
                (componentsByGrade[c.grade_id] = componentsByGrade[c.grade_id] || []).push(c);
            });

            const serverSubjects = (subjRes.data || []).map(subjectRowToLocal);
            const dirtyIds = getDirty();
            const localDirty = DB.getSubjects().filter(s => dirtyIds.has(s.id));
            const localDirtyMap = new Map(localDirty.map(s => [s.id, s]));
            const subjects = serverSubjects.map(s => localDirtyMap.get(s.id) || s);
            localDirty.forEach(s => { if (!serverSubjects.some(x => x.id === s.id)) subjects.push(s); });
            setDirty(new Set(localDirty.map(s => s.id)));
            const tasks = (taskRes.data || []).map(r => taskRowToLocal(r, checklistByTask[r.id]));
            const events = (evRes.data || []).map(eventRowToLocal);
            const notes = (noteRes.data || []).map(notesRowToLocal);
            const serverAtt = (attRes.data || []).map(attendanceRowToLocal);
            const dirtyAttIds = getDirtyAtt();
            const localDirtyAtt = DB.getAttendance().filter(r => dirtyAttIds.has(r.id));
            const dirtyAttMap = new Map(localDirtyAtt.map(r => [r.id, r]));
            const attendance = serverAtt.map(r => dirtyAttMap.get(r.id) || r);
            localDirtyAtt.forEach(r => { if (!serverAtt.some(x => x.id === r.id)) attendance.push(r); });
            setDirtyAtt(new Set(localDirtyAtt.map(r => r.id)));
            const serverGrades = (gradeRes.data || []).map(r => gradeRowToLocal(r, componentsByGrade[r.id], assessmentsByComponent));
            const dirtyGradeIds = getDirtyGrades();
            const localDirtyGrades = DB.getGrades().filter(g => g.id && dirtyGradeIds.has(g.id));
            const localDirtyGradesMap = new Map(localDirtyGrades.map(g => [g.id, g]));
            const grades = serverGrades.map(g => localDirtyGradesMap.get(g.id) || g);
            localDirtyGrades.forEach(g => { if (!serverGrades.some(x => x.id === g.id)) grades.push(g); });
            setDirtyGrades(new Set(localDirtyGrades.map(g => g.id)));

            const gwaRows = (gwaRes.data || []).map(gwaRowToLocal);
            const syllabusCourses = (sylRes.data || []).map(syllabusRowToLocal);

            // MAJ-11: merge in any local semester not yet seen on the server --
            // covers both a save still in flight (dirty) AND the one-time case
            // of an existing user's pre-this-fix local semesters that were
            // never pushed at all, so they get adopted (and pushed up below)
            // instead of being wiped back to a lone default.
            const serverSemesters = (semRes.data || []).map(semesterRowToLocal);
            const serverSemIds = new Set(serverSemesters.map(s => s.id));
            const localOnlySemesters = DB.getSemesters().filter(s => !serverSemIds.has(s.id));
            const semesters = [...serverSemesters, ...localOnlySemesters];
            setDirtySem(new Set(localOnlySemesters.map(s => s.id)));

            // MAJ-13: restore which semester was active. Only do this when nothing
            // local has it set yet (a fresh login, right after
            // clearPrivateCacheOnSignOut wiped sp_active_semester_id) -- never
            // clobber a choice already made this session, e.g. the student just
            // switched semesters and that push hasn't round-tripped yet.
            if (!DB.get('activeSemesterId', null)) {
                const serverActiveRow = (semRes.data || []).find(r => r.is_active && r.client_id);
                if (serverActiveRow && semesters.some(s => s.id === serverActiveRow.client_id)) {
                    DB.set('activeSemesterId', serverActiveRow.client_id);
                }
            }

            DB.set('subjects', subjects);
            DB.set('tasks', tasks);
            DB.set('calendarEvents', events);
            DB.set('notes', notes);
            DB.set('attendance', attendance);
            DB.set('grades', grades);
            DB.set('gwaCalc', gwaRows);
            DB.set('syllabusCourses', syllabusCourses);
            if (semesters.length) DB.set('semesters', semesters);

            // AJ-08: hydrate cancelled occurrences from Supabase blob
            if (coRes && coRes.data && Array.isArray(coRes.data.occurrences)) {
                DB.saveCancelledOccurrences(coRes.data.occurrences);
                _lastCancelledJson = JSON.stringify(coRes.data.occurrences);
            }

            last.subjects = new Map(serverSubjects.map(s => [s.id, true]));
            last.tasks = new Map(tasks.map(t => [t.id, true]));
            last.calendarEvents = new Map(events.map(e => [e.id, true]));
            last.notes = new Map(notes.map(n => [n.id, true]));
            last.attendance = new Map(serverAtt.map(a => [a.id, true]));
            last.grades = new Map(serverGrades.map(g => [g.id, true]));
            last.gwaCalc = new Map(gwaRows.map(r => [r.id, true]));
            last.syllabusCourses = new Map(syllabusCourses.map(c => [c.id, true]));
            last.semesters = new Map(serverSemesters.map(s => [s.id, true]));

            if (localDirty.length) pushSubjects(subjects.slice());
            if (localDirtyAtt.length) pushAttendance(attendance.slice());
            if (localDirtyGrades.length) pushGrades(grades.slice());
            if (localOnlySemesters.length) pushSemesters(semesters.slice());
            window.dispatchEvent(new CustomEvent('planner:cloud-synced'));
        } catch (err) {
            console.warn('Cloud sync hydrate failed', err);
            toast("Couldn't load your latest data from the server. Showing cached data.", 'high');
        }
    }

    /* ---------- push (write-through diffing) ---------- */

    let _subjQueue = Promise.resolve();
    function pushSubjects(newList) {
        _subjQueue = _subjQueue.then(() => doPushSubjects(newList)).catch(() => {});
        return _subjQueue;
    }

    async function doPushSubjects(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(s => s.id));
        const toDelete = [...last.subjects.keys()].filter(id => !newIds.has(id));
        const dirty = getDirty();
        let failure = null;
        try {
            if (toDelete.length) {
                const { error } = await supabase.from('subjects').delete().in('id', toDelete);
                if (error) failure = error;
                else toDelete.forEach(id => { dropSemFor('subjects', id); last.subjects.delete(id); });
            }
            for (const s of newList) {
                if (!isUuid(s.id)) {
                    failure = failure || new Error('Subject "' + (s.code || '?') + '" has an invalid id');
                    continue;
                }
                const { error } = await supabase.from('subjects').upsert(subjectLocalToRow(s, userId), { onConflict: 'id' });
                if (error) { failure = failure || error; continue; }
                setSemFor('subjects', s.id, s.semesterId);
                last.subjects.set(s.id, true);
                dirty.delete(s.id);
            }
        } catch (err) {
            failure = failure || err;
        }
        setDirty(dirty);
        if (failure) {
            console.warn('Cloud sync (subjects) failed', failure);
            toast("Couldn't save a subject to the server: " + (failure.message || 'unknown error'));
        }
    }

    async function pushTasks(newList, changedId) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(t => t.id));
        const toDelete = [...last.tasks.keys()].filter(id => !newIds.has(id));
        try {
            if (toDelete.length) {
                await supabase.from('task_checklist_items').delete().in('task_id', toDelete);
                await supabase.from('tasks').delete().in('id', toDelete);
                toDelete.forEach(id => { dropSemFor('tasks', id); setWeekLink(id, null); });
            }
            for (const t of newList) {
                if (!isUuid(t.id)) continue;
                const isNew = !last.tasks.has(t.id);
                const row = taskLocalToRow(t, userId);
                if (isNew) row.created_at = new Date(t.createdAt || Date.now()).toISOString();
                const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
                if (error) throw error;
                setSemFor('tasks', t.id, t.semesterId);
                setWeekLink(t.id, t.syllabusWeekId || null);
                // Checklist: replace-all is simplest and matches how tasks.js rebuilds
                // the checklist array from the modal on every save (no stable ids there).
                await supabase.from('task_checklist_items').delete().eq('task_id', t.id);
                const items = (t.checklist || []).map((c, i) => ({
                    id: (c.id && isUuid(c.id)) ? c.id : (window.crypto && crypto.randomUUID ? crypto.randomUUID() : undefined),
                    task_id: t.id, text: c.text, done: !!c.done, position: i,
                }));
                if (items.length) {
                    const { error: clErr } = await supabase.from('task_checklist_items').insert(items);
                    if (clErr) throw clErr;
                }
            }
            last.tasks = new Map(newList.map(t => [t.id, true]));
        } catch (err) {
            console.warn('Cloud sync (tasks) failed', err);
            toast("Couldn't save that task to the server. Please check your connection and try again.");
        }
    }

    async function pushCalendarEvents(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(e => e.id));
        const toDelete = [...last.calendarEvents.keys()].filter(id => !newIds.has(id));
        try {
            if (toDelete.length) {
                await supabase.from('calendar_events').delete().in('id', toDelete);
                toDelete.forEach(id => dropSemFor('calendarEvents', id));
            }
            for (const e of newList) {
                if (!isUuid(e.id)) continue;
                const row = eventLocalToRow(e, userId);
                const { error } = await supabase.from('calendar_events').upsert(row, { onConflict: 'id' });
                if (error) throw error;
                setSemFor('calendarEvents', e.id, e.semesterId);
            }
            last.calendarEvents = new Map(newList.map(e => [e.id, true]));
        } catch (err) {
            console.warn('Cloud sync (calendar events) failed', err);
            toast("Couldn't save that event to the server. Please check your connection and try again.");
        }
    }

    async function pushNotes(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(n => n.id));
        const toDelete = [...last.notes.keys()].filter(id => !newIds.has(id));
        try {
            if (toDelete.length) {
                await supabase.from('notes').delete().in('id', toDelete);
                toDelete.forEach(id => dropSemFor('notes', id));
            }
            for (const n of newList) {
                if (!isUuid(n.id)) continue;
                const { error } = await supabase.from('notes').upsert(notesLocalToRow(n, userId), { onConflict: 'id' });
                if (error) throw error;
                setSemFor('notes', n.id, n.semesterId);
            }
            last.notes = new Map(newList.map(n => [n.id, true]));
        } catch (err) {
            console.warn('Cloud sync (notes) failed', err);
            toast("Couldn't save that note to the server. Please check your connection and try again.");
        }
    }

        let _attQueue = Promise.resolve();
    function pushAttendance(newList) {
        _attQueue = _attQueue.then(() => doPushAttendance(newList)).catch(() => {});
        return _attQueue;
    }

    async function doPushAttendance(newList) {
        await _subjQueue; // subjects must exist on the server before attendance rows reference them
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(r => r.id));
        const toDelete = [...last.attendance.keys()].filter(id => !newIds.has(id));
        const dirty = getDirtyAtt();
        let failure = null;
        try {
            if (toDelete.length) {
                const { error } = await supabase.from('attendance').delete().in('id', toDelete);
                if (error) failure = error;
                else toDelete.forEach(id => { dropSemFor('attendance', id); last.attendance.delete(id); });
            }
            for (const r of newList) {
                if (!isUuid(r.id)) {
                    failure = failure || new Error('Attendance record has an invalid id');
                    continue;
                }
                const { error } = await supabase.from('attendance').upsert(attendanceLocalToRow(r, userId), { onConflict: 'id' });
                if (error) { failure = failure || error; continue; }
                setSemFor('attendance', r.id, r.semesterId);
                last.attendance.set(r.id, true);
                dirty.delete(r.id);
            }
        } catch (err) {
            failure = failure || err;
        }
        setDirtyAtt(dirty);
        if (failure) {
            console.warn('Cloud sync (attendance) failed', failure);
            toast("Couldn't save attendance to the server: " + (failure.message || 'unknown error'));
        }
    }
    async function pushGwaCalc(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(r => r.id));
        const toDelete = [...last.gwaCalc.keys()].filter(id => !newIds.has(id));
        try {
            if (toDelete.length) await supabase.from('gwa_calculator').delete().in('id', toDelete);
            for (const r of newList) {
                if (!isUuid(r.id)) continue;
                const { error } = await supabase.from('gwa_calculator').upsert(gwaLocalToRow(r, userId), { onConflict: 'id' });
                if (error) throw error;
            }
            last.gwaCalc = new Map(newList.map(r => [r.id, true]));
        } catch (err) {
            console.warn('Cloud sync (GWA calculator) failed', err);
            toast("Couldn't save the GWA calculator to the server. Please check your connection and try again.");
        }
    }

    /* AJ-08: cancelled occurrences — stored as a single JSONB row (upsert) keyed
       by user_id. The table schema is:
         CREATE TABLE cancelled_occurrences (
           user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
           occurrences jsonb NOT NULL DEFAULT '[]',
           updated_at timestamptz NOT NULL DEFAULT now()
         );
         ALTER TABLE cancelled_occurrences ENABLE ROW LEVEL SECURITY;
         CREATE POLICY "own rows" ON cancelled_occurrences
           USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
       No diffing needed: the whole array is upserted on every change. */
    async function pushCancelledOccurrences(list) {
        const userId = await getUserId();
        if (!userId) return;
        const json = JSON.stringify(list);
        if (json === _lastCancelledJson) return; // nothing changed
        try {
            const supabase = await getClient();
            const { error } = await supabase.from('cancelled_occurrences').upsert(
                { user_id: userId, occurrences: list, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );
            if (error) throw error;
            _lastCancelledJson = json;
        } catch (err) {
            console.warn('Cloud sync (cancelled occurrences) failed', err);
            toast(
                "Couldn't save cancelled class occurrences to the server. Please check your connection.",
                'high'
            );
        }
    }

    /* grades: each grade row owns its own components/assessments. Ids on components
       and assessments ARE stable across edits (grades.js keeps them via `c.id || DB.uid()`),
       so a straightforward delete-missing / upsert-rest pass works, scoped per grade row. */
    let _gradesQueue = Promise.resolve();
    function pushGrades(newList) {
        _gradesQueue = _gradesQueue.then(() => doPushGrades(newList)).catch(() => {});
        return _gradesQueue;
    }

    async function doPushGrades(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();

        // Local grade records are sometimes created without a top-level id
        // (grades.js keys them by subjectId); give each one a real id so it can
        // be a primary key, and persist that back into the local cache.
        let mutated = false;
        newList.forEach(g => { if (!g.id) { g.id = DB.uid(); mutated = true; } });
        if (mutated) DB.set('grades', newList);

        const newIds = new Set(newList.map(g => g.id));
        const toDelete = [...last.grades.keys()].filter(id => !newIds.has(id));
        const dirty = getDirtyGrades();
        let failure = null;
        try {
            const serverSemId = await getServerSemesterId(userId);

            for (const gradeId of toDelete) {
                const { data: comps } = await supabase.from('grade_components').select('id').eq('grade_id', gradeId);
                const compIds = (comps || []).map(c => c.id);
                if (compIds.length) await supabase.from('grade_assessments').delete().in('component_id', compIds);
                await supabase.from('grade_components').delete().eq('grade_id', gradeId);
                await supabase.from('grades').delete().eq('id', gradeId);
                dropSemFor('grades', gradeId);
                last.grades.delete(gradeId);
            }

            for (const g of newList) {
                if (!isUuid(g.id)) {
                    failure = failure || new Error('A grade record has an invalid id');
                    continue;
                }
                let gradeFailed = false;
                const { error: gErr } = await supabase.from('grades').upsert({
                    id: g.id, user_id: userId, semester_id: serverSemId, subject_id: g.subjectId,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
                if (gErr) { failure = failure || gErr; continue; }
                setSemFor('grades', g.id, g.semesterId);

                const { data: existingComps } = await supabase.from('grade_components').select('id').eq('grade_id', g.id);
                const keepCompIds = new Set((g.components || []).map(c => c.id));
                const removedComps = (existingComps || []).map(c => c.id).filter(id => !keepCompIds.has(id));
                if (removedComps.length) {
                    await supabase.from('grade_assessments').delete().in('component_id', removedComps);
                    await supabase.from('grade_components').delete().in('id', removedComps);
                }

                for (let ci = 0; ci < (g.components || []).length; ci++) {
                    const c = g.components[ci];
                    if (!isUuid(c.id)) { gradeFailed = true; continue; }
                    const { error: cErr } = await supabase.from('grade_components').upsert({
                        id: c.id, grade_id: g.id, name: c.name || '', weight: c.weight || 0, position: ci,
                    }, { onConflict: 'id' });
                    if (cErr) { failure = failure || cErr; gradeFailed = true; continue; }

                    const { data: existingAss } = await supabase.from('grade_assessments').select('id').eq('component_id', c.id);
                    const keepAssIds = new Set((c.assessments || []).map(a => a.id));
                    const removedAss = (existingAss || []).map(a => a.id).filter(id => !keepAssIds.has(id));
                    if (removedAss.length) await supabase.from('grade_assessments').delete().in('id', removedAss);

                    for (let ai = 0; ai < (c.assessments || []).length; ai++) {
                        const a = c.assessments[ai];
                        if (!isUuid(a.id)) { gradeFailed = true; continue; }
                        // score / total_items are NOT NULL on this table -- an assessment
                        // can exist locally with a name but no numbers typed in yet, so
                        // default those to 0 ("not scored") rather than fail the insert.
                        const { error: aErr } = await supabase.from('grade_assessments').upsert({
                            id: a.id, component_id: c.id, name: a.name || '',
                            score: a.score != null ? a.score : 0,
                            total_items: a.totalItems != null ? a.totalItems : 0,
                            position: ai,
                        }, { onConflict: 'id' });
                        if (aErr) { failure = failure || aErr; gradeFailed = true; }
                    }
                }
                last.grades.set(g.id, true);
                if (!gradeFailed) dirty.delete(g.id);
            }
        } catch (err) {
            failure = failure || err;
        }
        setDirtyGrades(dirty);
        if (failure) {
            console.warn('Cloud sync (grades) failed', failure);
            toast("Couldn't save that grade to the server: " + (failure.message || 'unknown error'), 'high', 'grades');
        } else {
            clearSyncError();
        }
    }

    /* MAJ-11: pushes the real semester list (Settings > Academic Semester
       Management) to the `semesters` table, keyed by client_id (the local
       deterministic id) rather than the row's own uuid -- see
       semesterLocalToRow above and migration 0020. */
    let _semQueue = Promise.resolve();
    function pushSemesters(newList) {
        _semQueue = _semQueue.then(() => doPushSemesters(newList)).catch(() => {});
        return _semQueue;
    }

    async function doPushSemesters(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(s => s.id));
        const toDelete = [...last.semesters.keys()].filter(id => !newIds.has(id));
        const dirty = getDirtySem();
        let failure = null;
        try {
            if (toDelete.length) {
                const { error } = await supabase.from('semesters').delete().eq('user_id', userId).in('client_id', toDelete);
                if (error) failure = error;
                else toDelete.forEach(id => last.semesters.delete(id));
            }
            // MAJ-13: whichever semester is locally active right now gets
            // is_active=true on its row; every other real semester row gets
            // false, so the flag always matches exactly one row server-side.
            const activeId = DB.get('activeSemesterId', null) || (newList[0] && newList[0].id) || null;
            for (const s of newList) {
                const { error } = await supabase.from('semesters')
                    .upsert(semesterLocalToRow(s, userId, activeId), { onConflict: 'user_id,client_id' });
                if (error) { failure = failure || error; continue; }
                last.semesters.set(s.id, true);
                dirty.delete(s.id);
            }
        } catch (err) {
            failure = failure || err;
        }
        setDirtySem(dirty);
        if (failure) {
            console.warn('Cloud sync (semesters) failed', failure);
            toast("Couldn't save that semester to the server: " + (failure.message || 'unknown error'), 'high', 'semesters');
        } else {
            clearSyncError();
        }
    }

    async function pushSyllabusCourses(newList) {
        const userId = await getUserId();
        if (!userId) return;
        const supabase = await getClient();
        const newIds = new Set(newList.map(c => c.id));
        const toDelete = [...last.syllabusCourses.keys()].filter(id => !newIds.has(id));
        try {
            const serverSemId = await getServerSemesterId(userId);
            if (toDelete.length) {
                await supabase.from('syllabus_courses').delete().in('id', toDelete);
                toDelete.forEach(id => dropSemFor('syllabusCourses', id));
            }
            for (const c of newList) {
                if (!isUuid(c.id)) continue;
                const { error } = await supabase.from('syllabus_courses').upsert(syllabusLocalToRow(c, userId, serverSemId), { onConflict: 'id' });
                if (error) throw error;
                setSemFor('syllabusCourses', c.id, c.semesterId);
            }
            last.syllabusCourses = new Map(newList.map(c => [c.id, true]));
        } catch (err) {
            console.warn('Cloud sync (syllabus) failed', err);
            toast("Couldn't save that syllabus to the server. Please check your connection and try again.");
        }
    }

    /* ---------- wire into DB ---------- */

    const _saveSubjects = DB.saveSubjects.bind(DB);
    DB.saveSubjects = function (list) {
        const prev = new Map(DB.getSubjects().map(s => [s.id, JSON.stringify(s)]));
        const r = _saveSubjects(list);
        const dirty = getDirty();
        list.forEach(s => { if (prev.get(s.id) !== JSON.stringify(s)) dirty.add(s.id); });
        setDirty(dirty);
        trackPush(pushSubjects(list.slice()));
        return r;
    };
    const _saveTasks = DB.saveTasks.bind(DB);
    DB.saveTasks = function (list) {
        const r = _saveTasks(list);
        trackPush(pushTasks(list.slice()));
        return r;
    };
    const _saveCalendarEvents = DB.saveCalendarEvents.bind(DB);
    DB.saveCalendarEvents = function (list) {
        const r = _saveCalendarEvents(list);
        trackPush(pushCalendarEvents(list.slice()));
        return r;
    };
    const _saveNotes = DB.saveNotes.bind(DB);
    DB.saveNotes = function (list) {
        const r = _saveNotes(list);
        trackPush(pushNotes(list.slice()));
        return r;
    };
    const _saveAttendance = DB.saveAttendance.bind(DB);
    DB.saveAttendance = function (list) {
        const prev = new Map(DB.getAttendance().map(r => [r.id, JSON.stringify(r)]));
        const r = _saveAttendance(list);
        const dirty = getDirtyAtt();
        list.forEach(x => { if (prev.get(x.id) !== JSON.stringify(x)) dirty.add(x.id); });
        setDirtyAtt(dirty);
        trackPush(pushAttendance(list.slice()));
        return r;
    };
    const _saveGrades = DB.saveGrades.bind(DB);
    DB.saveGrades = function (list) {
        // Assign ids up front (not just inside the push) so dirty-tracking has
        // a stable key to compare against from the very first save.
        list.forEach(g => { if (!g.id) g.id = DB.uid(); });
        const prev = new Map(DB.getGrades().map(g => [g.id, JSON.stringify(g)]));
        const r = _saveGrades(list);
        const dirty = getDirtyGrades();
        list.forEach(g => { if (prev.get(g.id) !== JSON.stringify(g)) dirty.add(g.id); });
        setDirtyGrades(dirty);
        trackPush(pushGrades(list.slice()));
        return r;
    };
    const _saveGwaCalcRows = DB.saveGwaCalcRows.bind(DB);
    DB.saveGwaCalcRows = function (list) {
        const r = _saveGwaCalcRows(list);
        trackPush(pushGwaCalc(list.slice()));
        return r;
    };
    const _saveSemesters = DB.saveSemesters.bind(DB);
    DB.saveSemesters = function (list) {
        const prev = new Map(DB.getSemesters().map(s => [s.id, JSON.stringify(s)]));
        const r = _saveSemesters(list);
        const dirty = getDirtySem();
        list.forEach(s => { if (prev.get(s.id) !== JSON.stringify(s)) dirty.add(s.id); });
        setDirtySem(dirty);
        trackPush(pushSemesters(list.slice()));
        return r;
    };
    // MAJ-13: picking a different semester (Settings > Academic Semester
    // Management) only ever wrote sp_active_semester_id locally. Re-push the
    // semester rows so the server's is_active flag follows along -- see
    // semesterLocalToRow/doPushSemesters above and the hydrate restore logic.
    const _setActiveSemester = DB.setActiveSemester.bind(DB);
    DB.setActiveSemester = function (id) {
        const r = _setActiveSemester(id);
        trackPush(pushSemesters(DB.getSemesters().slice()));
        return r;
    };
    const _saveSyllabusCourses = DB.saveSyllabusCourses.bind(DB);
    DB.saveSyllabusCourses = function (list) {
        const r = _saveSyllabusCourses(list);
        trackPush(pushSyllabusCourses(list.slice()));
        return r;
    };
    // AJ-08: intercept cancelled occurrences saves so they propagate to Supabase
    const _saveCancelledOccurrences = DB.saveCancelledOccurrences.bind(DB);
    DB.saveCancelledOccurrences = function (list) {
        const r = _saveCancelledOccurrences(list);
        trackPush(pushCancelledOccurrences(Array.isArray(list) ? list.slice() : []));
        return r;
    };

    /* ---------- public: boot + ready gate ---------- */

    showLoader();
    DB.cloudReady = hydrate().finally(hideLoader);

    /* Call once the DOM-ready init() for a page is defined. Runs it immediately
       if the initial hydrate is already done; otherwise waits for it (showing the
       loader above) so pages never render against an empty-but-not-yet-loaded cache. */
    DB.whenCloudReady = function (fn) {
        if (typeof fn !== 'function') return;
        DB.cloudReady.then(fn, fn);
    };

    /* ---------- Settings page: Reset Data / Import Backup ----------
       Both bypass the DB.saveX wrappers above (they write the localStorage
       keys directly), so they need their own explicit cloud sync. */

    async function wipeCloudData(userId) {
        const supabase = await getClient();
        // Children first (no ON DELETE CASCADE assumed), then the owning rows.
        const { data: myGrades } = await supabase.from('grades').select('id').eq('user_id', userId);
        const gradeIds = (myGrades || []).map(g => g.id);
        if (gradeIds.length) {
            const { data: comps } = await supabase.from('grade_components').select('id').in('grade_id', gradeIds);
            const compIds = (comps || []).map(c => c.id);
            if (compIds.length) await supabase.from('grade_assessments').delete().in('component_id', compIds);
            await supabase.from('grade_components').delete().in('grade_id', gradeIds);
        }
        const { data: myTasks } = await supabase.from('tasks').select('id').eq('user_id', userId);
        const taskIds = (myTasks || []).map(t => t.id);
        if (taskIds.length) await supabase.from('task_checklist_items').delete().in('task_id', taskIds);

        await Promise.all([
            supabase.from('subjects').delete().eq('user_id', userId),
            supabase.from('tasks').delete().eq('user_id', userId),
            supabase.from('calendar_events').delete().eq('user_id', userId),
            supabase.from('notes').delete().eq('user_id', userId),
            supabase.from('attendance').delete().eq('user_id', userId),
            supabase.from('grades').delete().eq('user_id', userId),
            supabase.from('gwa_calculator').delete().eq('user_id', userId),
            supabase.from('syllabus_courses').delete().eq('user_id', userId),
            // AJ-08: wipe cancelled occurrences blob
            supabase.from('cancelled_occurrences').delete().eq('user_id', userId),
            // MAJ-11: wipe the real semester rows too (but leave the one
            // placeholder row with client_id = null alone -- it's reused below).
            supabase.from('semesters').delete().eq('user_id', userId).not('client_id', 'is', null),
        ]);
        try { localStorage.removeItem(DIRTY_SEM_KEY); localStorage.removeItem(DIRTY_GRADES_KEY); } catch (e) { /* ignore */ }
        Object.keys(last).forEach(k => last[k] = new Map());
        _lastCancelledJson = '[]';
        try {
            localStorage.removeItem(MAP_KEY);
            localStorage.removeItem(SERVER_SEM_KEY);
        } catch (e) { /* ignore */ }
    }

    const _resetAll = DB.resetAll.bind(DB);
    DB.resetAll = function () {
        const r = _resetAll();
        getUserId().then(userId => {
            if (!userId) return;
            wipeCloudData(userId).catch(err => {
                console.warn('Cloud sync (reset) failed', err);
                toast("Local data was reset, but the server copy could not be cleared. Please check your connection.");
            });
        });
        return r;
    };

    const _importAll = DB.importAll.bind(DB);
    DB.importAll = function (obj) {
        const r = _importAll(obj);
        // Push every imported list through the normal save wrappers so each one
        // gets diffed against the server and synced the same way a manual edit would.
        pushSubjects(DB.getSubjects());
        pushTasks(DB.getTasks());
        pushCalendarEvents(DB.getCalendarEvents());
        pushNotes(DB.getNotes());
        pushAttendance(DB.getAttendance());
        pushGrades(DB.getGrades());
        pushGwaCalc(DB.getGwaCalcRows());
        pushSyllabusCourses(DB.getSyllabusCourses());
        pushSemesters(DB.getSemesters());
        // AJ-08: also sync cancelled occurrences on import
        pushCancelledOccurrences(DB.getCancelledOccurrences());
        return r;
    };
})();

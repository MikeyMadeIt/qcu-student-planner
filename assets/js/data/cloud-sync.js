// CLOUD-SYNC.JS — Supabase persistence for Subjects / Schedule /

(function () {
    const MAP_KEY = 'sp_cloud_semester_map';

    let _pending = [];
    function trackPush(p) {
        const entry = p.catch(() => {});
        _pending.push(entry);
        notifySyncStatusChanged();
        entry.finally(() => { _pending = _pending.filter(x => x !== entry); });
        entry.finally(notifySyncStatusChanged);
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
    window.CloudSync.getLastSyncError = function () { return getLastSyncError(); };
    window.CloudSync.getSyncStatus = function () {
        let lastSuccessfulAt = null;
        try { lastSuccessfulAt = Number(localStorage.getItem('sp_cloud_last_success')) || null; } catch (e) { /* ignore */ }
        return { pending: _pending.length > 0, error: getLastSyncError(), lastSuccessfulAt };
    };
    window.CloudSync.retryFailedSync = async function () {
        const retryTasks = new Map(DB.getTasks().map(t => [t.id, t]));
        Object.entries(getDirtyTasks()).forEach(([id, task]) => task ? retryTasks.set(id, task) : retryTasks.delete(id));
        const taskRows = [...retryTasks.values()];
        const dirtyCollections = getDirtyCollections();
        const retrySubjects = mergeDirtyCollection('subjects', DB.getSubjects());
        const retryEvents = mergeDirtyCollection('calendarEvents', DB.getCalendarEvents());
        const retryNotes = mergeDirtyCollection('notes', DB.getNotes());
        const jobs = [
            pushSubjects(retrySubjects), pushTasks(taskRows),
            pushCalendarEvents(retryEvents), pushNotes(retryNotes),
            pushAttendance(DB.getAttendance().slice()), pushGrades(DB.getGrades().slice()),
            queueGwaCalcSync(DB.getGwaCalcRows().slice()),
        ];
        await Promise.all(jobs.map(job => trackPush(Promise.resolve(job))));
        if (!getLastSyncError() && taskRows.length) _saveTasks(taskRows);
        if (!getLastSyncError()) {
            if (dirtyCollections.subjects) _saveSubjects(retrySubjects);
            if (dirtyCollections.calendarEvents) _saveCalendarEvents(retryEvents);
            if (dirtyCollections.notes) _saveNotes(retryNotes);
        }
        return { ok: !getLastSyncError(), error: getLastSyncError() };
    };
    let _calendarRefreshPromise = null;
    window.CloudSync.refreshAcademicCalendar = function () {
        if (_calendarRefreshPromise) return _calendarRefreshPromise;
        _calendarRefreshPromise = import('../services/academic-calendar-service.js')
            .then(module => module.AcademicCalendarService.getCalendar())
            .then(result => {
                if (result && result.ok) DB.setUniversityCalendar(result.data);
                else if (result && result.message) console.warn('University academic calendar could not be refreshed.', result.message);
                return result;
            })
            .catch(error => { console.warn('University academic calendar could not be refreshed.', error); return { ok: false }; })
            .finally(() => { _calendarRefreshPromise = null; });
        return _calendarRefreshPromise;
    };

    function loadMap() {
        const empty = { subjects: {}, tasks: {}, calendarEvents: {}, notes: {}, attendance: {}, grades: {} };
        try { return Object.assign(empty, JSON.parse(localStorage.getItem(MAP_KEY)) || {}); }
        catch (e) { return empty; }
    }
    function saveMap(m) {
        try { localStorage.setItem(MAP_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
    }
    function semFor(bucket, id) {
        const m = loadMap();
        return (m[bucket] && m[bucket][id]) || null;
    }
    let semesterServerToLocal = new Map();
    let semesterLocalToServer = new Map();
    function semForRow(bucket, row) {
        if (row.semester_id && semesterServerToLocal.has(row.semester_id)) return semesterServerToLocal.get(row.semester_id);
        return semFor(bucket, row.id) || row.semester_id || null;
    }
    function serverSemesterId(localId) {
        if (!localId) return null;
        return semesterLocalToServer.get(localId) || (isUuid(localId) ? localId : null);
    }
    function requireServerSemesterId(localId, area) {
        const serverId = serverSemesterId(localId);
        if (!serverId) throw new Error('Select a valid semester before saving ' + area + '.');
        return serverId;
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

    const LAST_ERROR_KEY = 'sp_cloud_last_error';
    function notifySyncStatusChanged() {
        try { window.dispatchEvent(new CustomEvent('planner:sync-status-changed')); } catch (e) { /* ignore */ }
    }
    function recordSyncError(area, message) {
        try {
            localStorage.setItem(LAST_ERROR_KEY, JSON.stringify({ area, message: String(message || 'Unknown error'), at: Date.now() }));
        } catch (e) { /* ignore */ }
        notifySyncStatusChanged();
    }
    function clearSyncError(area) {
        try {
            if (area) {
                const cur = getLastSyncError();
                if (cur && cur.area !== area) return;
            }
            localStorage.removeItem(LAST_ERROR_KEY);
            localStorage.setItem('sp_cloud_last_success', String(Date.now()));
        } catch (e) { /* ignore */ }
        notifySyncStatusChanged();
    }
    function getLastSyncError() {
        try { return JSON.parse(localStorage.getItem(LAST_ERROR_KEY)); } catch (e) { return null; }
    }

    function toast(msg, kind, area) {
        if (kind === 'high' || kind === 'danger') recordSyncError(area || 'sync', msg);
        if (window.Toast && typeof window.Toast.show === 'function') {
            window.Toast.show(msg, kind || 'high', 'icon-lucide-cloud-off');
        }
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

    const DIRTY_GRADES_KEY = 'sp_cloud_dirty_grades';
    function getDirtyGrades() {
        try { return new Set(JSON.parse(localStorage.getItem(DIRTY_GRADES_KEY)) || []); }
        catch (e) { return new Set(); }
    }
    function setDirtyGrades(set) {
        try { localStorage.setItem(DIRTY_GRADES_KEY, JSON.stringify([...set])); } catch (e) { /* ignore */ }
    }

    const DIRTY_TASKS_KEY = 'sp_cloud_dirty_tasks';
    function getDirtyTasks() {
        try { return JSON.parse(localStorage.getItem(DIRTY_TASKS_KEY)) || {}; } catch (e) { return {}; }
    }
    function setDirtyTasks(value) {
        try {
            if (Object.keys(value).length) localStorage.setItem(DIRTY_TASKS_KEY, JSON.stringify(value));
            else localStorage.removeItem(DIRTY_TASKS_KEY);
        } catch (e) { /* keep local records available even if metadata storage fails */ }
    }
    function markTasksDirty(list) {
        const dirty = {};
        const ids = new Set((list || []).map(t => t.id));
        last.tasks.forEach((_, id) => { if (!ids.has(id)) dirty[id] = null; });
        (list || []).forEach(t => { dirty[t.id] = t; });
        setDirtyTasks(dirty);
    }
    const DIRTY_COLLECTIONS_KEY = 'sp_cloud_dirty_collections';
    function getDirtyCollections() {
        try { return JSON.parse(localStorage.getItem(DIRTY_COLLECTIONS_KEY)) || {}; } catch (e) { return {}; }
    }
    function setDirtyCollection(bucket, value) {
        const all = getDirtyCollections();
        if (Object.keys(value).length) all[bucket] = value;
        else delete all[bucket];
        try {
            if (Object.keys(all).length) localStorage.setItem(DIRTY_COLLECTIONS_KEY, JSON.stringify(all));
            else localStorage.removeItem(DIRTY_COLLECTIONS_KEY);
        } catch (e) { /* preserve local rows */ }
    }
    function markCollectionDirty(bucket, rows) {
        const dirty = {};
        const ids = new Set((rows || []).map(r => r.id));
        (last[bucket] || new Map()).forEach((_, id) => { if (!ids.has(id)) dirty[id] = null; });
        (rows || []).forEach(r => { dirty[r.id] = r; });
        setDirtyCollection(bucket, dirty);
    }
    function markChangedCollectionDirty(bucket, previousRows, nextRows) {
        const pending = Object.assign({}, getDirtyCollections()[bucket] || {});
        const previous = new Map((previousRows || []).map(row => [row.id, row]));
        const next = new Map((nextRows || []).map(row => [row.id, row]));
        previous.forEach((row, id) => {
            if (!next.has(id)) pending[id] = null;
            else if (JSON.stringify(row) !== JSON.stringify(next.get(id))) pending[id] = next.get(id);
        });
        next.forEach((row, id) => {
            if (!previous.has(id)) pending[id] = row;
            else if (JSON.stringify(previous.get(id)) === JSON.stringify(row) && !serverSemesterId(row.semesterId)) delete pending[id];
        });
        (last[bucket] || new Map()).forEach((_, id) => {
            if (!next.has(id)) pending[id] = null;
        });
        setDirtyCollection(bucket, pending);
    }
    function mergeDirtyCollection(bucket, serverRows) {
        const rows = new Map((serverRows || []).map(r => [r.id, r]));
        const pending = getDirtyCollections()[bucket] || {};
        Object.entries(pending).forEach(([id, row]) => row ? rows.set(id, row) : rows.delete(id));
        return [...rows.values()];
    }

    let overlayCount = 0;
    function showLoader() {
        overlayCount++;
        if (document.getElementById('cloudSyncLoader')) return;
        const el = document.createElement('div');
        el.id = 'cloudSyncLoader';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.style.cssText = 'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:var(--bg,#111318);opacity:.97;';
        el.innerHTML = '<i class="icon-lucide-graduation-cap" aria-hidden="true" style="font-size:1.9rem;color:rgb(var(--accent,36,87,214))"></i>' +
            '<div class="ld-typing" aria-hidden="true"><span></span><span></span><span></span></div>' +
            '<div style="color:var(--text-soft,#A1A8B5);font-size:.9rem">Loading your data…</div>';
        document.body.appendChild(el);
    }
    function hideLoader() {
        overlayCount = Math.max(0, overlayCount - 1);
        if (overlayCount > 0) return;
        const el = document.getElementById('cloudSyncLoader');
        if (el) el.remove();
    }

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

    // row <-> local mappers

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
            source: row.source || 'manual',
            setupStatus: row.setup_status || 'completed',
            curriculumKey: row.curriculum_key || '',
            semesterId: semForRow('subjects', row),
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
            source: s.source || 'manual',
            setup_status: s.setupStatus || 'completed',
            curriculum_key: s.curriculumKey || null,
            semester_id: requireServerSemesterId(s.semesterId, 'this subject'),
        };
    }

    function taskRowToLocal(row, checklist) {
        return {
            id: row.id,
            title: row.title || '',
            description: row.description || '',
            subjectId: row.subject_id || null,
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
            semesterId: semForRow('tasks', row),
        };
    }
    function taskLocalToRow(t, userId) {
        return {
            id: t.id, user_id: userId,
            title: t.title || '', description: t.description || '',
            subject_id: t.subjectId || null,
            category: t.category || null, priority: t.priority || 'medium',
            due_date: t.dueDate || null, due_time: t.dueTime || null,
            status: t.status || 'not-started', progress: t.progress || 0,
            reminder: !!t.reminder, remind_before_min: t.remindBeforeMin || null,
            repeat: t.repeat || 'none', time_estimate_min: t.timeEstimate || null,
            score: t.score != null && t.score !== '' ? t.score : null,
            remarks: t.remarks || '',
            completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
            updated_at: new Date().toISOString(),
            semester_id: requireServerSemesterId(t.semesterId, 'this task'),
        };
    }

    function eventRowToLocal(row) {
        return {
            id: row.id, title: row.title || '', date: row.date,
            startTime: hhmm(row.start_time), endTime: hhmm(row.end_time),
            category: row.category || '', color: row.color || '',
            description: row.note || '',
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            semesterId: semForRow('calendarEvents', row),
        };
    }
    function eventLocalToRow(e, userId) {
        return {
            id: e.id, user_id: userId, title: e.title || '', date: e.date,
            start_time: e.startTime || null, end_time: e.endTime || null,
            category: e.category || null, color: e.color || null, note: e.description || '',
            semester_id: serverSemesterId(e.semesterId),
        };
    }

    function notesRowToLocal(row) {
        return {
            id: row.id, title: row.title || '', content: row.content || '',
            category: row.category || '', pinned: !!row.pinned, favorite: !!row.favorite,
            subjectId: row.subject_id || null, taskId: row.task_id || null,
            tags: Array.isArray(row.tags) ? row.tags : [],
            checklist: [],
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
            semesterId: semForRow('notes', row),
        };
    }
    function notesLocalToRow(n, userId) {
        return {
            id: n.id, user_id: userId, title: n.title || '', content: n.content || '',
            category: n.category || null, pinned: !!n.pinned, favorite: !!n.favorite,
            subject_id: n.subjectId || null, task_id: n.taskId || null,
            tags: Array.isArray(n.tags) ? n.tags : [],
            updated_at: new Date().toISOString(), semester_id: serverSemesterId(n.semesterId),
        };
    }

    function attendanceRowToLocal(row) {
        return {
            id: row.id, subjectId: row.subject_id, date: row.date, status: row.status || '',
            online: !!row.online, notes: row.notes || '',
            semesterId: semForRow('attendance', row),
        };
    }
    function attendanceLocalToRow(r, userId) {
        return {
            id: r.id, user_id: userId, subject_id: r.subjectId, date: r.date,
            status: r.status || '', online: !!r.online, notes: r.notes || '',
            updated_at: new Date().toISOString(), semester_id: serverSemesterId(r.semesterId),
        };
    }

    function gwaRowToLocal(row) {
        return { id: row.id, label: row.label || '', units: row.units != null ? row.units : '', grade: row.grade != null ? row.grade : '', semesterId: semForRow('gwaCalc', row) };
    }
    function gwaLocalToRow(r, userId) {
        return {
            id: r.id, user_id: userId, label: r.label || '',
            units: r.units === '' || r.units == null ? 0 : (+r.units || 0),
            grade: r.grade === '' || r.grade == null ? 0 : (+r.grade || 0),
            updated_at: new Date().toISOString(), semester_id: requireServerSemesterId(r.semesterId, 'the GWA calculator entry'),
        };
    }

    function gradeRowToLocal(row, components, assessmentsByComponent) {
        return {
            id: row.id,
            subjectId: row.subject_id,
            semesterId: semForRow('grades', row),
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

    // `semesters.client_id` holds the local deterministic id (e.g. "2026-2027-1")
    function semesterRowToLocal(row) {
        return {
            id: row.client_id,
            name: row.name || '',
            schoolYear: row.school_year || '',
            startDate: row.start_date || '',
            endDate: row.end_date || '',
            finalsDate: row.finals_date || '',
            totalWeeks: row.total_weeks != null ? Number(row.total_weeks) : 15,
            status: row.status || 'archived',
        };
    }

    const last = {
        subjects: new Map(), tasks: new Map(), calendarEvents: new Map(),
        notes: new Map(), attendance: new Map(), grades: new Map(),
        gwaCalc: new Map(),
    };
    let gwaSyncQueue = null;
    let gwaSyncQueuedRows = null;
    let gwaSyncTimer = null;
    let gwaSyncWaiters = [];
    function queueGwaCalcSync(rows) {
        gwaSyncQueuedRows = Array.isArray(rows) ? rows.map(row => ({ ...row })) : [];
        if (gwaSyncTimer) clearTimeout(gwaSyncTimer);
        const completion = new Promise(resolve => gwaSyncWaiters.push(resolve));
        gwaSyncTimer = setTimeout(runGwaCalcSyncQueue, 180);
        return completion;
    }
    function runGwaCalcSyncQueue() {
        if (gwaSyncTimer) clearTimeout(gwaSyncTimer);
        gwaSyncTimer = null;
        if (gwaSyncQueue) return gwaSyncQueue;
        gwaSyncQueue = (async () => {
            while (gwaSyncQueuedRows) {
                const rows = gwaSyncQueuedRows;
                gwaSyncQueuedRows = null;
                await pushGwaCalc(rows);
            }
        })().finally(() => {
            gwaSyncQueue = null;
            if (gwaSyncQueuedRows) {
                gwaSyncTimer = setTimeout(runGwaCalcSyncQueue, 0);
            } else {
                gwaSyncWaiters.splice(0).forEach(resolve => resolve());
            }
        });
        return gwaSyncQueue;
    }
    let _lastCancelledJson = '[]';

    const LAST_USER_KEY = 'sp_cloud_last_user_id';
    // A local preference edit must survive a reload while its debounced
    // server write is pending. Otherwise hydrate() can restore the older
    // server value and erase the user's most recent theme choice.
    const LOCAL_PREFS_DIRTY_KEY = 'sp_cloud_local_prefs_dirty';
    // Theme/accent picked on the landing or login page (before DB/cloud-sync
    // exist) is queued here by theme.js so it survives the first hydrate().
    const PENDING_APPEARANCE_KEY = 'sp_pending_appearance';

    // The dirty flag is stamped with the id of the user who made the edit,
    // so one person's unsynced settings can never be pushed into (or
    // override the saved settings of) a different account that signs in on
    // the same device. sign-out wipes LAST_USER_KEY, so the stamp has to
    // live on the flag itself.
    let _sessionUserId = null;
    function markPrefsDirty() {
        let owner = _sessionUserId;
        if (!owner) { try { owner = localStorage.getItem(LAST_USER_KEY); } catch (e) { /* ignore */ } }
        try { localStorage.setItem(LOCAL_PREFS_DIRTY_KEY, owner || '1'); } catch (e) { /* ignore */ }
    }
    // previousUserId = the last user recorded on this device BEFORE this
    // hydrate. An unowned legacy '1' flag is only trusted when it provably
    // belongs to the same person.
    function prefsDirtyFor(userId, previousUserId) {
        let flag = null;
        try { flag = localStorage.getItem(LOCAL_PREFS_DIRTY_KEY); } catch (e) { /* ignore */ }
        if (!flag) return false;
        if (flag === userId) return true;
        return flag === '1' && previousUserId === userId;
    }

    async function hydrate() {
        const userId = await getUserId();
        DB.setSemesterContextUser(userId);
        if (!userId) return;
        _sessionUserId = userId;
        await _subjQueue;
        await _attQueue;

        let lastUserId = null;
        try { lastUserId = localStorage.getItem(LAST_USER_KEY); } catch (e) { /* ignore */ }
        if (lastUserId && lastUserId !== userId) {
            DB.clearPrivateCacheOnSignOut();
            try {
                localStorage.removeItem(MAP_KEY);
            } catch (e) { /* ignore */ }
        }
        try { localStorage.setItem(LAST_USER_KEY, userId); } catch (e) { /* ignore */ }

        try {
            const supabase = await getClient();

            const calendarPromise = import('../services/academic-calendar-service.js')
                .then(module => module.AcademicCalendarService.getCalendar())
                .catch(error => ({ ok: false, message: error.message }));
            const [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes, gwaRes, coRes, semRes, prefRes, calendarResult] = await Promise.all([
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
                supabase.from('cancelled_occurrences').select('occurrences').eq('user_id', userId).maybeSingle(),
                supabase.from('semesters').select('*').eq('user_id', userId).not('client_id', 'is', null).order('created_at', { ascending: true }),
                supabase.from('user_preferences').select('prefs').eq('user_id', userId).maybeSingle(),
                calendarPromise,
            ]);

            // user_preferences is new (migration 0026): on a project where it
            // hasn't been applied yet, Supabase returns a 42P01 "relation
            // does not exist" error for that one query. Don't let a missing
            // table block the whole hydrate — everything else still loads,
            // settings just stay local-only (same as before this feature).
            const prefsTableMissing = prefRes && prefRes.error && /relation .* does not exist/i.test(prefRes.error.message || '');
            // Any OTHER failure fetching the row (RLS, network blip, ...)
            // means we don't know what the server holds. Treating that as
            // "nothing saved yet" would push this device's settings over a
            // perfectly good saved copy, so leave settings alone this time.
            const prefsFetchFailed = !!(prefRes && prefRes.error) && !prefsTableMissing;
            if (prefsFetchFailed) console.warn('Cloud sync (settings) could not be loaded; keeping local settings', prefRes.error);
            const firstError = [subjRes, taskRes, clRes, evRes, noteRes, attRes, gradeRes, gcRes, gaRes, gwaRes, coRes, semRes]
                .map(r => r.error).find(Boolean);
            if (firstError) throw firstError;

            const serverSemesters = (semRes.data || []).map(semesterRowToLocal);
            const serverSemIds = new Set(serverSemesters.map(s => s.id));
            const localOnlySemesters = readKey(DB_KEYS.semesters, []).filter(s => !serverSemIds.has(s.id));
            const semesters = [...serverSemesters, ...localOnlySemesters];
            semesterServerToLocal = new Map();
            semesterLocalToServer = new Map();
            (semRes.data || []).forEach(row => {
                if (row.client_id) {
                    semesterServerToLocal.set(row.id, row.client_id);
                    semesterLocalToServer.set(row.client_id, row.id);
                }
            });
            if (calendarResult && calendarResult.ok && calendarResult.data.available) {
                const calendar = calendarResult.data;
                calendar.semesters.forEach(semester => {
                    semesterServerToLocal.set(semester.id, semester.id);
                    semesterLocalToServer.set(semester.id, semester.id);
                });
                DB.setUniversityCalendar(calendar);
            } else if (calendarResult && !calendarResult.ok) {
                console.warn('University academic calendar could not be refreshed; keeping the cached calendar.', calendarResult.message);
            } else {
                DB.setUniversityCalendar({ available: false, academicYears: [], semesters: [], activeSemester: null, updatedAt: null });
            }

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
            const persistedSubjects = mergeDirtyCollection('subjects', serverSubjects);
            const dirtyIds = getDirty();
            const localDirty = persistedSubjects.filter(s => dirtyIds.has(s.id));
            const localDirtyMap = new Map(localDirty.map(s => [s.id, s]));
            const subjects = persistedSubjects.map(s => localDirtyMap.get(s.id) || s);
            localDirty.forEach(s => { if (!persistedSubjects.some(x => x.id === s.id)) subjects.push(s); });
            setDirty(new Set(localDirty.map(s => s.id)));
            const serverTasks = (taskRes.data || []).map(r => taskRowToLocal(r, checklistByTask[r.id]));
            const pendingTasks = getDirtyTasks();
            const tasksById = new Map(serverTasks.map(t => [t.id, t]));
            Object.entries(pendingTasks).forEach(([id, task]) => {
                if (task) tasksById.set(id, task);
                else tasksById.delete(id);
            });
            const tasks = [...tasksById.values()];
            const events = mergeDirtyCollection('calendarEvents', (evRes.data || []).map(eventRowToLocal));
            const notes = mergeDirtyCollection('notes', (noteRes.data || []).map(notesRowToLocal));
            const serverAtt = (attRes.data || []).map(attendanceRowToLocal);
            const persistedAttendance = mergeDirtyCollection('attendance', serverAtt);
            const dirtyAttIds = getDirtyAtt();
            const localDirtyAtt = persistedAttendance.filter(r => dirtyAttIds.has(r.id));
            const dirtyAttMap = new Map(localDirtyAtt.map(r => [r.id, r]));
            const attendance = persistedAttendance.map(r => dirtyAttMap.get(r.id) || r);
            localDirtyAtt.forEach(r => { if (!persistedAttendance.some(x => x.id === r.id)) attendance.push(r); });
            setDirtyAtt(new Set(localDirtyAtt.map(r => r.id)));
            const serverGrades = (gradeRes.data || []).map(r => gradeRowToLocal(r, componentsByGrade[r.id], assessmentsByComponent));
            const persistedGrades = mergeDirtyCollection('grades', serverGrades);
            const dirtyGradeIds = getDirtyGrades();
            const localDirtyGrades = persistedGrades.filter(g => g.id && dirtyGradeIds.has(g.id));
            const localDirtyGradesMap = new Map(localDirtyGrades.map(g => [g.id, g]));
            const grades = persistedGrades.map(g => localDirtyGradesMap.get(g.id) || g);
            localDirtyGrades.forEach(g => { if (!persistedGrades.some(x => x.id === g.id)) grades.push(g); });
            setDirtyGrades(new Set(localDirtyGrades.map(g => g.id)));

            const serverGwaRows = (gwaRes.data || []).map(gwaRowToLocal);
            const gwaRows = mergeDirtyCollection('gwaCalc', serverGwaRows);

            DB.set('subjects', subjects);
            DB.set('tasks', tasks);
            DB.set('calendarEvents', events);
            DB.set('notes', notes);
            DB.set('attendance', attendance);
            DB.set('grades', grades);
            DB.set('gwaCalc', gwaRows);
            DB.set('semesters', semesters);

            if (coRes && coRes.data && Array.isArray(coRes.data.occurrences)) {
                DB.saveCancelledOccurrences(coRes.data.occurrences);
                _lastCancelledJson = JSON.stringify(coRes.data.occurrences);
            }

            if (!prefsTableMissing && !prefsFetchFailed) {
                let localPrefsDirty = false;
                localPrefsDirty = prefsDirtyFor(userId, lastUserId);
                // A flag left by someone else is stale for this account: drop
                // it so it can't later be mistaken for this user's edit.
                if (!localPrefsDirty) { try { localStorage.removeItem(LOCAL_PREFS_DIRTY_KEY); } catch (e) { /* ignore */ } }
                let pendingAppearance = null;
                try {
                    const rawPending = JSON.parse(localStorage.getItem(PENDING_APPEARANCE_KEY));
                    if (rawPending && typeof rawPending === 'object') {
                        pendingAppearance = {};
                        if (['dark', 'light', 'amoled'].indexOf(rawPending.theme) > -1) pendingAppearance.theme = rawPending.theme;
                        if (typeof rawPending.accent === 'string') pendingAppearance.accent = rawPending.accent;
                        if (!Object.keys(pendingAppearance).length) pendingAppearance = null;
                    }
                } catch (e) { /* ignore */ }
                if (prefRes && prefRes.data && prefRes.data.prefs && typeof prefRes.data.prefs === 'object') {
                    // Server has a saved copy: it wins (same last-write-wins
                    // rule as cancelled occurrences) since settings are a
                    // single blob with no per-field conflict tracking.
                    // Sanitize to the known schema so a row saved before
                    // legacy fields (name/studentNumber/course/yearLevel/
                    // school) were removed doesn't bring them back into
                    // the local cache.
                    const rawMerged = { ...DEFAULT_SETTINGS, ...prefRes.data.prefs, notifications: { ...DEFAULT_SETTINGS.notifications, ...(prefRes.data.prefs.notifications || {}) } };
                    const merged = {};
                    Object.keys(DEFAULT_SETTINGS).forEach(k => { merged[k] = rawMerged[k]; });
                    if (localPrefsDirty) {
                        const localPrefs = DB.getSettings();
                        DB.set('settings', localPrefs);
                        _lastPrefsJson = JSON.stringify(merged);
                        pushSettings(localPrefs);
                    } else if (pendingAppearance) {
                        // The person picked a theme/accent before signing in.
                        // Keep it on top of the server copy (per-field, so the
                        // rest of their saved settings are untouched) and sync
                        // it up, instead of letting the older saved theme win.
                        const withPending = { ...merged, ...pendingAppearance };
                        DB.set('settings', withPending);
                        _lastPrefsJson = JSON.stringify(merged);
                        pushSettings(withPending);
                    } else {
                        DB.set('settings', merged);
                        _lastPrefsJson = JSON.stringify(merged);
                    }
                } else {
                    // Nothing saved for this user yet — push what's on this
                    // device now so the row exists for next time.
                    pushSettings(DB.getSettings());
                }
                try { localStorage.removeItem(PENDING_APPEARANCE_KEY); } catch (e) { /* ignore */ }
                // Keep the live page in step with what is now stored, so the
                // DOM never disagrees with the theme the next page will load.
                try {
                    if (typeof window.applyTheme === 'function') window.applyTheme();
                    document.dispatchEvent(new CustomEvent('sp:themechange'));
                } catch (e) { /* ignore */ }
            }

            last.subjects = new Map(serverSubjects.map(s => [s.id, true]));
            last.tasks = new Map(serverTasks.map(t => [t.id, true]));
            last.calendarEvents = new Map((evRes.data || []).map(r => [r.id, true]));
            last.notes = new Map((noteRes.data || []).map(r => [r.id, true]));
            last.attendance = new Map(serverAtt.map(a => [a.id, true]));
            last.grades = new Map(serverGrades.map(g => [g.id, true]));
            // Legacy rows without a semester remain locally preserved, but
            // are not managed by semester-scoped synchronization.
            last.gwaCalc = new Map(serverGwaRows.filter(r => r.semesterId && isSyncableGwaRow(r)).map(r => [r.id, true]));

            clearSyncError('load');

            const pendingCollections = getDirtyCollections();
            if (localDirty.length || (pendingCollections.subjects && Object.keys(pendingCollections.subjects).length)) pushSubjects(subjects.slice());
            const hasMappableSemester = (rows, bucket) => (rows || []).some(row => {
                const localId = semForRow(bucket, row);
                const serverId = serverSemesterId(localId);
                return !!serverId && row.semester_id !== serverId;
            });
            // Persist only associations that can be reconstructed from the
            // old per-record local map or an existing database relation.
            // Unmapped/ambiguous records stay unassigned for later review.
            if (hasMappableSemester(subjRes.data, 'subjects')) pushSubjects(subjects.slice());
            if (hasMappableSemester(taskRes.data, 'tasks')) pushTasks(tasks.slice());
            if (Object.keys(pendingTasks).length) pushTasks(tasks.slice());
            if ((getDirtyCollections().calendarEvents && Object.keys(getDirtyCollections().calendarEvents).length) || hasMappableSemester(evRes.data, 'calendarEvents')) pushCalendarEvents(events.slice());
            if ((getDirtyCollections().notes && Object.keys(getDirtyCollections().notes).length) || hasMappableSemester(noteRes.data, 'notes')) pushNotes(notes.slice());
            if (hasMappableSemester(attRes.data, 'attendance')) pushAttendance(attendance.slice());
            if (hasMappableSemester(gradeRes.data, 'grades')) pushGrades(grades.slice());
            if (localDirtyAtt.length || (pendingCollections.attendance && Object.keys(pendingCollections.attendance).length)) pushAttendance(attendance.slice());
            if (localDirtyGrades.length || (pendingCollections.grades && Object.keys(pendingCollections.grades).length)) pushGrades(grades.slice());
            // Re-validate the GWA calculator on every load. A push only ever
            // runs when a row is edited, so a past failure (e.g. a blank row
            // that used to violate gwa_calculator_grade_check) stayed stuck
            // in the Settings "Sync Status" card forever, even after the
            // code that caused it was fixed — it only cleared once you
            // happened to touch the calculator again. Pushing the
            // already-valid, already-synced rows here is a harmless no-op
            // when nothing is actually wrong, but it means a resolved error
            // clears itself instead of waiting on the user.
            queueGwaCalcSync(gwaRows.slice());
            window.dispatchEvent(new CustomEvent('planner:cloud-synced'));
        } catch (err) {
            console.warn('Cloud sync hydrate failed', err);
            toast("Couldn't load your latest data from the server. Showing cached data.", 'high', 'load');
        }
    }

    let _subjQueue = Promise.resolve();
    function pushSubjects(newList, silentFailure) {
        _subjQueue = _subjQueue.then(() => doPushSubjects(newList, silentFailure)).catch(error => ({ ok: false, error }));
        return _subjQueue;
    }

    async function doPushSubjects(newList, silentFailure) {
        const userId = await getUserId();
        if (!userId) return { ok: false, error: new Error('Sign in before syncing subjects.') };
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
                const mappedSemesterId = serverSemesterId(s.semesterId);
                if (!mappedSemesterId) {
                    // Leave an unchanged legacy row alone; a changed row must
                    // never be written without its selected semester.
                    if (dirty.has(s.id)) {
                        failure = failure || new Error('Select a valid semester before saving subject ' + (s.code || '') + '.');
                    }
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
            const message = "Couldn't save a subject to the server: " + (failure.message || 'unknown error');
            recordSyncError('subjects', message);
            if (!silentFailure) toast(message, 'high', 'subjects');
            return { ok: false, error: failure };
        } else {
            setDirtyCollection('subjects', {});
            clearSyncError('subjects');
            return { ok: true };
        }
    }

    async function pushTasks(newList, changedId, silentFailure) {
        const userId = await getUserId();
        if (!userId) return { ok: false, error: new Error('Sign in before syncing tasks.') };
        const supabase = await getClient();
        const newIds = new Set(newList.map(t => t.id));
        const toDelete = [...last.tasks.keys()].filter(id => !newIds.has(id));
        try {
            if (toDelete.length) {
                const { error: checklistDeleteError } = await supabase.from('task_checklist_items').delete().in('task_id', toDelete);
                if (checklistDeleteError) throw checklistDeleteError;
                const { error: taskDeleteError } = await supabase.from('tasks').delete().in('id', toDelete);
                if (taskDeleteError) throw taskDeleteError;
                toDelete.forEach(id => dropSemFor('tasks', id));
            }
            for (const t of newList) {
                if (!isUuid(t.id)) continue;
                const isNew = !last.tasks.has(t.id);
                const row = taskLocalToRow(t, userId);
                if (isNew) row.created_at = new Date(t.createdAt || Date.now()).toISOString();
        if (!row.semester_id) throw new Error('Select a valid semester before saving this task.');
        const { error } = await supabase.from('tasks').upsert(row, { onConflict: 'id' });
                if (error) throw error;
                setSemFor('tasks', t.id, t.semesterId);
                const { error: checklistDeleteError } = await supabase.from('task_checklist_items').delete().eq('task_id', t.id);
                if (checklistDeleteError) throw checklistDeleteError;
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
            setDirtyTasks({});
            clearSyncError('tasks');
            return { ok: true };
        } catch (err) {
            console.warn('Cloud sync (tasks) failed', err);
            const message = "Couldn't save that task to the server: " + ((err && err.message) || 'please check your connection and try again.');
            recordSyncError('tasks', message);
            if (!silentFailure) toast(message, 'high', 'tasks');
            return { ok: false, error: err };
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
                const { error } = await supabase.from('calendar_events').delete().in('id', toDelete);
                if (error) throw error;
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
            setDirtyCollection('calendarEvents', {});
            clearSyncError('calendar');
        } catch (err) {
            console.warn('Cloud sync (calendar events) failed', err);
            toast("Couldn't save that event to the server: " + ((err && err.message) || 'please check your connection and try again.'), 'high', 'calendar');
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
                const { error } = await supabase.from('notes').delete().in('id', toDelete);
                if (error) throw error;
                toDelete.forEach(id => dropSemFor('notes', id));
            }
            for (const n of newList) {
                if (!isUuid(n.id)) continue;
                const { error } = await supabase.from('notes').upsert(notesLocalToRow(n, userId), { onConflict: 'id' });
                if (error) throw error;
                setSemFor('notes', n.id, n.semesterId);
            }
            last.notes = new Map(newList.map(n => [n.id, true]));
            setDirtyCollection('notes', {});
            clearSyncError('notes');
        } catch (err) {
            console.warn('Cloud sync (notes) failed', err);
            toast("Couldn't save that note to the server: " + ((err && err.message) || 'please check your connection and try again.'), 'high', 'notes');
        }
    }

    let _attQueue = Promise.resolve();
    function pushAttendance(newList) {
        _attQueue = _attQueue.then(() => doPushAttendance(newList)).catch(() => {});
        return _attQueue;
    }

    async function doPushAttendance(newList) {
        await _subjQueue;
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
            toast("Couldn't save attendance to the server: " + (failure.message || 'unknown error'), 'high', 'attendance');
        } else {
            setDirtyCollection('attendance', {});
            clearSyncError('attendance');
        }
    }

    // Drafts and incomplete entries stay local until they have a valid
    // semester, positive units, and a 1.00–5.00 grade. These rows are not
    // academic records yet and must not be sent to the database trigger.
    function isSyncableGwaRow(r) {
        if (!r.semesterId || r.units === '' || r.units == null || r.grade === '' || r.grade == null) return false;
        const units = +r.units;
        const n = +r.grade;
        return Number.isFinite(units) && units > 0 && Number.isFinite(n) && n >= 1 && n <= 5;
    }

    async function pushGwaCalc(newList) {
        const syncable = newList.filter(isSyncableGwaRow);
        try {
            const userId = await getUserId();
            if (!userId) return;
            const supabase = await getClient();
            const newIds = new Set(syncable.map(r => r.id));
            const toDelete = [...last.gwaCalc.keys()].filter(id => !newIds.has(id));
            if (toDelete.length) {
                const { error } = await supabase.from('gwa_calculator').delete().eq('user_id', userId).in('id', toDelete);
                if (error) throw error;
            }
            for (const r of syncable) {
                if (!isUuid(r.id)) throw new Error('This calculator entry has an invalid record ID. Keep the entry open and contact support.');
                const { error } = await supabase.from('gwa_calculator').upsert(gwaLocalToRow(r, userId), { onConflict: 'id' });
                if (error) throw error;
            }
            last.gwaCalc = new Map(syncable.map(r => [r.id, true]));
            setDirtyCollection('gwaCalc', {});
            clearSyncError('gwa');
        } catch (err) {
            console.warn('Cloud sync (GWA calculator) failed', err);
            const message = (err && err.message) || 'please check your connection and try again.';
            recordSyncError('gwa', message);
            toast("Couldn't save the GWA calculator to the server: " + message, 'high', 'gwa');
        }
    }

    // Settings (Appearance + Notifications, incl. reminder timing) —
    // single JSONB row (upsert) keyed by user_id, same shape as
    // cancelled occurrences below. Debounced: toggles/selects in the
    // Settings UI can fire several saves in quick succession.
    let _lastPrefsJson = null;
    let _prefsPushTimer = null;
    function pushSettings(settings) {
        if (_prefsPushTimer) clearTimeout(_prefsPushTimer);
        _prefsPushTimer = setTimeout(() => { doPushSettings(settings); }, 400);
    }
    async function doPushSettings(settings) {
        const userId = await getUserId();
        if (!userId) return;
        const json = JSON.stringify(settings);
        if (json === _lastPrefsJson) return;
        try {
            const supabase = await getClient();
            const { error } = await supabase.from('user_preferences').upsert(
                { user_id: userId, prefs: settings, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );
            if (error) throw error;
            _lastPrefsJson = json;
            try {
                const dirtyOwner = localStorage.getItem(LOCAL_PREFS_DIRTY_KEY);
                if ((dirtyOwner === userId || dirtyOwner === '1') && JSON.stringify(DB.getSettings()) === json)
                    localStorage.removeItem(LOCAL_PREFS_DIRTY_KEY);
            } catch (e) { /* ignore */ }
            clearSyncError('settings');
        } catch (err) {
            console.warn('Cloud sync (settings) failed', err);
            // Don't alarm the user over a migration that just hasn't been
            // applied to this Supabase project yet (see hydrate()) — settings
            // simply stay local-only until it is.
            if (err && /relation .* does not exist/i.test(err.message || '')) return;
            toast("Couldn't save your settings to the server: " + ((err && err.message) || 'please check your connection.'), 'high', 'settings');
        }
    }

    // AJ-08: cancelled occurrences — single JSONB row (upsert) keyed by user_id.
    async function pushCancelledOccurrences(list) {
        const userId = await getUserId();
        if (!userId) return;
        const json = JSON.stringify(list);
        if (json === _lastCancelledJson) return;
        try {
            const supabase = await getClient();
            const { error } = await supabase.from('cancelled_occurrences').upsert(
                { user_id: userId, occurrences: list, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            );
            if (error) throw error;
            _lastCancelledJson = json;
            clearSyncError('cancelled');
        } catch (err) {
            console.warn('Cloud sync (cancelled occurrences) failed', err);
            toast(
                "Couldn't save cancelled class occurrences to the server: " + ((err && err.message) || 'please check your connection.'),
                'high', 'cancelled'
            );
        }
    }

    let _gradesQueue = Promise.resolve();
    function pushGrades(newList, silentFailure) {
        _gradesQueue = _gradesQueue
            .then(() => doPushGrades(newList, silentFailure))
            .catch(error => {
                const message = "Couldn't save that grade to the server: " + (error && error.message || 'unknown error');
                recordSyncError('grades', message);
                if (!silentFailure) toast(message, 'high', 'grades');
                return { ok: false, error };
            });
        return _gradesQueue;
    }

    async function doPushGrades(newList, silentFailure) {
        const userId = await getUserId();
        if (!userId) throw new Error('Sign in before syncing grades.');
        const supabase = await getClient();

        let mutated = false;
        newList.forEach(g => { if (!g.id) { g.id = DB.uid(); mutated = true; } });
        if (mutated) DB.set('grades', newList);

        const newIds = new Set(newList.map(g => g.id));
        const toDelete = [...last.grades.keys()].filter(id => !newIds.has(id));
        const dirty = getDirtyGrades();
        let failure = null;
        try {
            for (const gradeId of toDelete) {
                const { data: comps, error: compsError } = await supabase.from('grade_components').select('id').eq('grade_id', gradeId);
                if (compsError) throw compsError;
                const compIds = (comps || []).map(c => c.id);
                if (compIds.length) { const { error } = await supabase.from('grade_assessments').delete().in('component_id', compIds); if (error) throw error; }
                { const { error } = await supabase.from('grade_components').delete().eq('grade_id', gradeId); if (error) throw error; }
                { const { error } = await supabase.from('grades').delete().eq('id', gradeId); if (error) throw error; }
                dropSemFor('grades', gradeId);
                last.grades.delete(gradeId);
            }

            for (const g of newList) {
                if (!isUuid(g.id)) {
                    failure = failure || new Error('A grade record has an invalid id');
                    continue;
                }
                if (last.grades.has(g.id) && !dirty.has(g.id)) continue;
                let gradeFailed = false;
                const serverSemester = serverSemesterId(g.semesterId);
                if (!serverSemester) {
                    failure = failure || new Error('Select a valid semester before saving this grade.');
                    continue;
                }
                const { error: gErr } = await supabase.from('grades').upsert({
                    id: g.id, user_id: userId, semester_id: serverSemester, subject_id: g.subjectId,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });
                if (gErr) { failure = failure || gErr; continue; }
                setSemFor('grades', g.id, g.semesterId);

                const { data: existingComps, error: existingCompsError } = await supabase.from('grade_components').select('id').eq('grade_id', g.id);
                if (existingCompsError) throw existingCompsError;
                const keepCompIds = new Set((g.components || []).map(c => c.id));
                const removedComps = (existingComps || []).map(c => c.id).filter(id => !keepCompIds.has(id));
                if (removedComps.length) {
                    const { error: assessmentDeleteError } = await supabase.from('grade_assessments').delete().in('component_id', removedComps);
                    if (assessmentDeleteError) throw assessmentDeleteError;
                    const { error: componentDeleteError } = await supabase.from('grade_components').delete().in('id', removedComps);
                    if (componentDeleteError) throw componentDeleteError;
                }

                for (let ci = 0; ci < (g.components || []).length; ci++) {
                    const c = g.components[ci];
                    if (!isUuid(c.id)) { failure = failure || new Error('A grading component has an invalid id.'); gradeFailed = true; continue; }
                    const { error: cErr } = await supabase.from('grade_components').upsert({
                        id: c.id, grade_id: g.id, name: c.name || '', weight: c.weight || 0, position: ci,
                    }, { onConflict: 'id' });
                    if (cErr) { failure = failure || cErr; gradeFailed = true; continue; }

                    const { data: existingAss, error: existingAssessmentsError } = await supabase.from('grade_assessments').select('id').eq('component_id', c.id);
                    if (existingAssessmentsError) throw existingAssessmentsError;
                    const keepAssIds = new Set((c.assessments || []).map(a => a.id));
                    const removedAss = (existingAss || []).map(a => a.id).filter(id => !keepAssIds.has(id));
                    if (removedAss.length) { const { error } = await supabase.from('grade_assessments').delete().in('id', removedAss); if (error) throw error; }

                    for (let ai = 0; ai < (c.assessments || []).length; ai++) {
                        const a = c.assessments[ai];
                        if (!isUuid(a.id)) { failure = failure || new Error('An assessment has an invalid id.'); gradeFailed = true; continue; }
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
            const message = "Couldn't save that grade to the server: " + (failure.message || 'unknown error');
            if (silentFailure) recordSyncError('grades', message);
            else toast(message, 'high', 'grades');
            return { ok: false, error: failure };
        } else {
            setDirtyCollection('grades', {});
            clearSyncError('grades');
            return { ok: true };
        }
    }

    const _saveSubjects = DB.saveSubjects.bind(DB);
    DB.saveSubjects = function (list) {
        const previous = DB.getSubjects().slice();
        const prev = new Map(previous.map(s => [s.id, JSON.stringify(s)]));
        const r = _saveSubjects(list);
        markChangedCollectionDirty('subjects', previous, list);
        const dirty = getDirty();
        list.forEach(s => { if (prev.get(s.id) !== JSON.stringify(s)) dirty.add(s.id); });
        list.forEach(s => { if (prev.get(s.id) === JSON.stringify(s) && !serverSemesterId(s.semesterId)) dirty.delete(s.id); });
        setDirty(dirty);
        trackPush(pushSubjects(list.slice()));
        return r;
    };
    DB.saveSubjectsAndSync = async function (list) {
        const previous = DB.getSubjects().slice();
        markChangedCollectionDirty('subjects', previous, list);
        const dirty = getDirty();
        const previousById = new Map(previous.map(s => [s.id, JSON.stringify(s)]));
        list.forEach(s => { if (previousById.get(s.id) !== JSON.stringify(s)) dirty.add(s.id); });
        list.forEach(s => { if (previousById.get(s.id) === JSON.stringify(s) && !serverSemesterId(s.semesterId)) dirty.delete(s.id); });
        setDirty(dirty);
        const result = await trackPush(pushSubjects(list.slice(), true));
        if (!result || !result.ok) return result || { ok: false, error: new Error('Subject synchronization did not complete.') };
        if (_saveSubjects(list) === false) return { ok: false, error: new Error('Subject was saved to the server, but could not be cached on this device.') };
        return { ok: true };
    };
    const _saveTasks = DB.saveTasks.bind(DB);
    DB.saveTasks = function (list) {
        const r = _saveTasks(list);
        markTasksDirty(list);
        trackPush(pushTasks(list.slice()));
        return r;
    };
    DB.saveTasksAndSync = async function (list) {
        markTasksDirty(list);
        const result = await trackPush(pushTasks(list.slice(), null, true));
        if (!result || !result.ok) return result || { ok: false, error: new Error('Task sync did not complete.') };
        if (_saveTasks(list) === false) return { ok: false, error: new Error('Task was saved to the server, but could not be cached on this device.') };
        setDirtyTasks({});
        return { ok: true };
    };
    const _saveCalendarEvents = DB.saveCalendarEvents.bind(DB);
    DB.saveCalendarEvents = function (list) {
        const r = _saveCalendarEvents(list);
        markCollectionDirty('calendarEvents', list);
        trackPush(pushCalendarEvents(list.slice()));
        return r;
    };
    const _saveNotes = DB.saveNotes.bind(DB);
    DB.saveNotes = function (list) {
        const r = _saveNotes(list);
        markCollectionDirty('notes', list);
        trackPush(pushNotes(list.slice()));
        return r;
    };
    const _saveAttendance = DB.saveAttendance.bind(DB);
    DB.saveAttendance = function (list) {
        const prev = new Map(DB.getAttendance().map(r => [r.id, JSON.stringify(r)]));
        const r = _saveAttendance(list);
        markCollectionDirty('attendance', list);
        const dirty = getDirtyAtt();
        list.forEach(x => { if (prev.get(x.id) !== JSON.stringify(x)) dirty.add(x.id); });
        setDirtyAtt(dirty);
        trackPush(pushAttendance(list.slice()));
        return r;
    };
    const _saveGrades = DB.saveGrades.bind(DB);
    DB.saveGrades = function (list) {
        const previous = DB.getGrades().slice();
        list.forEach(g => { if (!g.id) g.id = DB.uid(); });
        const prev = new Map(previous.map(g => [g.id, JSON.stringify(g)]));
        const r = _saveGrades(list);
        markChangedCollectionDirty('grades', previous, list);
        const dirty = getDirtyGrades();
        list.forEach(g => { if (prev.get(g.id) !== JSON.stringify(g)) dirty.add(g.id); });
        setDirtyGrades(dirty);
        trackPush(pushGrades(list.slice()));
        return r;
    };
    DB.saveGradesAndSync = async function (list) {
        const previous = DB.getGrades().slice();
        list.forEach(g => { if (!g.id) g.id = DB.uid(); });
        markChangedCollectionDirty('grades', previous, list);
        const previousById = new Map(previous.map(g => [g.id, JSON.stringify(g)]));
        const dirty = getDirtyGrades();
        list.forEach(g => {
            if (previousById.get(g.id) !== JSON.stringify(g)) dirty.add(g.id);
        });
        setDirtyGrades(dirty);
        const result = await trackPush(pushGrades(list.slice(), true));
        if (!result || !result.ok) return result || { ok: false, error: new Error('Grade synchronization did not complete.') };
        if (_saveGrades(list) === false) return { ok: false, error: new Error('Grade was saved to the server, but could not be cached on this device.') };
        setDirtyGrades(new Set());
        return { ok: true };
    };
    const _saveGwaCalcRows = DB.saveGwaCalcRows.bind(DB);
    DB.saveGwaCalcRows = function (list) {
        const r = _saveGwaCalcRows(list);
        markCollectionDirty('gwaCalc', list);
        trackPush(queueGwaCalcSync(list.slice()));
        return r;
    };
    const _saveCancelledOccurrences = DB.saveCancelledOccurrences.bind(DB);
    DB.saveCancelledOccurrences = function (list) {
        const r = _saveCancelledOccurrences(list);
        trackPush(pushCancelledOccurrences(Array.isArray(list) ? list.slice() : []));
        return r;
    };
    const _saveSettings = DB.saveSettings.bind(DB);
    DB.saveSettings = function (s) {
        const r = _saveSettings(s);
        markPrefsDirty();
        pushSettings(DB.getSettings());
        return r;
    };

    showLoader();
    DB.cloudReady = hydrate().finally(hideLoader);
    window.setInterval(() => {
        if (document.visibilityState === 'visible') window.CloudSync.refreshAcademicCalendar();
    }, 60000);
    window.addEventListener('focus', () => window.CloudSync.refreshAcademicCalendar());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') window.CloudSync.refreshAcademicCalendar();
    });

    DB.whenCloudReady = function (fn) {
        if (typeof fn !== 'function') return;
        DB.cloudReady.then(fn, fn);
    };

    // Settings page: Reset All Data.
    //
    // Primary path is the atomic `reset_my_planner_data()` Postgres
    // function (supabase/migrations/0027_reset_my_planner_data.sql) run
    // under the signed-in user's own privileges — one transaction, all
    // or nothing, authorized by auth.uid() inside the function rather
    // than any id the client sends. If that migration hasn't been
    // applied yet to a given project (function missing: Postgres error
    // 42883), this falls back to the same per-table deletes the RPC
    // itself runs, same order, still scoped to this user's id and still
    // subject to every table's own RLS policy — just not wrapped in a
    // single transaction.
    async function checkedResetQuery(query) {
        const result = await query;
        if (result && result.error) throw result.error;
        return result || {};
    }

    async function wipeCloudDataFallback(supabase, userId) {
        const { data: myQuizzes } = await checkedResetQuery(supabase.from('ai_quizzes').select('id').eq('user_id', userId));
        if ((myQuizzes || []).length) {
            await checkedResetQuery(supabase.from('ai_quiz_questions').delete().eq('user_id', userId));
            await checkedResetQuery(supabase.from('ai_quiz_attempts').delete().eq('user_id', userId));
        }
        await checkedResetQuery(supabase.from('ai_quizzes').delete().eq('user_id', userId));
        await checkedResetQuery(supabase.from('ai_flashcards').delete().eq('user_id', userId));
        await checkedResetQuery(supabase.from('ai_flashcard_decks').delete().eq('user_id', userId));
        await checkedResetQuery(supabase.from('ai_chat_messages').delete().eq('user_id', userId));
        await checkedResetQuery(supabase.from('ai_chat_conversations').delete().eq('user_id', userId));

        const { data: myTasks } = await checkedResetQuery(supabase.from('tasks').select('id').eq('user_id', userId));
        const taskIds = (myTasks || []).map(t => t.id);
        if (taskIds.length) await checkedResetQuery(supabase.from('task_checklist_items').delete().in('task_id', taskIds));
        await checkedResetQuery(supabase.from('tasks').delete().eq('user_id', userId));

        const { data: myGrades } = await checkedResetQuery(supabase.from('grades').select('id').eq('user_id', userId));
        const gradeIds = (myGrades || []).map(g => g.id);
        if (gradeIds.length) {
            const { data: comps } = await checkedResetQuery(supabase.from('grade_components').select('id').in('grade_id', gradeIds));
            const compIds = (comps || []).map(c => c.id);
            if (compIds.length) await checkedResetQuery(supabase.from('grade_assessments').delete().in('component_id', compIds));
            await checkedResetQuery(supabase.from('grade_components').delete().in('grade_id', gradeIds));
        }
        await checkedResetQuery(supabase.from('grades').delete().eq('user_id', userId));

        await Promise.all([
            supabase.from('notes').delete().eq('user_id', userId),
            supabase.from('calendar_events').delete().eq('user_id', userId),
            supabase.from('attendance').delete().eq('user_id', userId),
            supabase.from('gwa_calculator').delete().eq('user_id', userId),
            supabase.from('cancelled_occurrences').delete().eq('user_id', userId),
            supabase.from('cancelled_class_occurrences').delete().eq('user_id', userId),
            supabase.from('subjects').delete().eq('user_id', userId),
            supabase.from('user_preferences').delete().eq('user_id', userId),
            supabase.from('semesters').delete().eq('user_id', userId),
        ].map(checkedResetQuery));
    }

    async function wipeCloudData(userId) {
        const supabase = await getClient();
        const { error: rpcError } = await supabase.rpc('reset_my_planner_data');
        if (rpcError) {
            // 42883: function does not exist yet (migration not applied).
            // Anything else is a real failure (e.g. not signed in,
            // network) and should surface rather than be papered over.
            const fnMissing = rpcError.code === '42883' || /function .* does not exist/i.test(rpcError.message || '');
            if (!fnMissing) throw rpcError;
            await wipeCloudDataFallback(supabase, userId);
        }
        try { localStorage.removeItem(DIRTY_GRADES_KEY); } catch (e) { /* ignore */ }
        Object.keys(last).forEach(k => last[k] = new Map());
        _lastCancelledJson = '[]';
        try {
            localStorage.removeItem(MAP_KEY);
        } catch (e) { /* ignore */ }
        clearSyncError();
    }

    // Exposed so Settings can actually await the server-side deletion
    // and show a real success/error state instead of firing it and
    // hoping.
    window.CloudSync.resetAllData = async function () {
        const userId = await getUserId();
        if (!userId) throw new Error('You need to be signed in to reset your data.');
        await wipeCloudData(userId);
        DB.resetAll();
    };

})();

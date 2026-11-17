// NOTIFICATION-ENGINE.JS — checks the user's Settings > Notifications
// preferences against their real data (schedule, tasks, attendance) and
// fires a browser Notification() at the right moment.
//
// Architecture note (read before changing this file): this project has no
// server-side push (no VAPID keys, no push_subscriptions table, no Edge
// Function sending at a scheduled time). So this engine runs *in the
// foreground*, on a timer, from whichever app page happens to be open —
// it is started once from layout.js's renderShell(), which every signed-in
// app page calls, so it keeps running as the user moves between pages
// without depending on any one page's own script. It genuinely cannot
// fire once every app tab is closed; that would require Web Push and a
// backend scheduler, which is future work, not something to fake here.
//
// De-duping: every reminder that fires is recorded (by a stable id) in
// localStorage so the same moment never notifies twice, including across
// a reload, and the record is pruned after 48h so it never grows forever.
(function () {
    const CHECK_INTERVAL_MS = 30 * 1000;
    const FIRED_KEY = 'sp_fired_reminders';
    const FIRED_TTL_MS = 1000 * 60 * 60 * 48;
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DEFAULT_ABSENCE_LIMIT = 3; // mirrors attendance.js

    let timer = null;

    function getFired() {
        try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function markFired(id) {
        const map = getFired();
        map[id] = Date.now();
        Object.keys(map).forEach(k => { if (Date.now() - map[k] > FIRED_TTL_MS) delete map[k]; });
        try { localStorage.setItem(FIRED_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
    }
    function alreadyFired(id) {
        return !!getFired()[id];
    }

    function notify(title, body, tag) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const options = { body: body || '', tag, icon: '/assets/icons/icon-192.png' };
        // Once a service worker controls the page (it does here — see
        // pwa.js/service-worker.js), browsers like Chrome on Android refuse
        // the page-context `new Notification()` constructor outright
        // ("Illegal constructor. Use ServiceWorkerRegistration.showNotification()
        // instead.") and the old code silently swallowed that error, so
        // nothing ever showed up even with permission granted. Go through
        // the service worker whenever one is controlling the page; fall
        // back to the plain constructor only when there isn't one yet.
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready
                .then((reg) => reg.showNotification(title, options))
                .catch((e) => console.warn('Reminder notification failed (service worker)', e));
            return;
        }
        try {
            new Notification(title, options);
        } catch (e) {
            console.warn('Reminder notification failed', e);
        }
    }

    function minutesLabel(min) {
        if (!min) return null;
        if (min < 60) return min + ' min';
        return (min % 60 === 0 ? min / 60 : (min / 60).toFixed(1)) + ' hr';
    }

    function todayStrLocal() {
        return (typeof todayKey === 'function') ? todayKey() : (new Date()).toISOString().slice(0, 10);
    }

    // --- Upcoming classes, from each subject's saved days/start time -------
    function checkUpcomingClasses(n) {
        if (!n.upcomingClass || typeof DB === 'undefined') return;
        const offset = Number(n.upcomingClassMinutes || 0);
        const semId = DB.getActiveSemesterId();
        const now = new Date();
        const dayName = DAY_NAMES[now.getDay()];
        const todayStr = todayStrLocal();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        let cancelled = [];
        try { cancelled = DB.getCancelledOccurrences(); } catch (e) { /* ignore */ }

        DB.getSubjects()
            .filter(s => s.semesterId === semId && !s.archived && Array.isArray(s.days) && s.days.includes(dayName) && s.start)
            .forEach(s => {
                if (cancelled.some(c => c.subjectId === s.id && c.date === todayStr)) return;
                const parts = String(s.start).split(':').map(Number);
                if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return;
                const startMin = parts[0] * 60 + parts[1];
                const fireAt = startMin - offset;
                // With offset 0 ("At the scheduled time"), fireAt === startMin,
                // so the old exclusive-upper-bound window (fireAt <= now <
                // startMin) was empty and this could never fire. Give the
                // zero-offset case its own one-minute window right at the
                // start time instead.
                const windowEndExclusive = offset === 0 ? startMin + 1 : startMin;
                if (nowMin >= fireAt && nowMin < windowEndExclusive) {
                    const id = `class-${s.id}-${todayStr}-${offset}`;
                    if (alreadyFired(id)) return;
                    const label = minutesLabel(offset);
                    const title = label ? `${s.code || 'Class'} starts in ${label}` : `${s.code || 'Class'} is starting now`;
                    const body = (s.room || '') + (s.building ? (s.room ? ' \u00B7 ' : '') + s.building : '');
                    notify(title, body, id);
                    markFired(id);
                }
            });
    }

    // --- Task reminders, from real due dates/times on the Tasks page -------
    function checkTaskReminders(n) {
        if (!n.taskReminders || typeof DB === 'undefined') return;
        const offset = Number(n.taskReminderMinutes || 0);
        const semId = DB.getActiveSemesterId();
        const now = new Date();

        DB.getTasksForSemester(semId).forEach(t => {
            if (!t || !t.dueDate) return;
            // computeStatus (task-stats.js) is loaded on every app page and
            // is the single source of truth for what "completed" means —
            // deleted tasks never reach here at all since DB.getTasks()
            // only ever holds tasks that still exist.
            const status = (typeof computeStatus === 'function') ? computeStatus(t) : t.status;
            if (status === 'completed') return;
            const due = new Date(t.dueDate + 'T' + (t.dueTime || '23:59') + ':00');
            if (isNaN(due.getTime())) return;
            const fireAt = new Date(due.getTime() - offset * 60000);
            // Same fix as checkUpcomingClasses: offset 0 made fireAt === due,
            // so "now < due" could never be true at the same time as
            // "now >= fireAt" and the reminder could never fire. Give the
            // zero-offset case a one-minute grace window right after due.
            const windowEnd = offset === 0 ? new Date(due.getTime() + 60000) : due;
            if (now >= fireAt && now < windowEnd) {
                const id = `task-${t.id}-${t.dueDate}-${t.dueTime || ''}-${offset}`;
                if (alreadyFired(id)) return;
                const label = minutesLabel(offset);
                const title = label ? `"${t.title || 'Untitled task'}" is due in ${label}` : `"${t.title || 'Untitled task'}" is due now`;
                notify(title, t.description || '', id);
                markFired(id);
            }
        });
    }

    // --- Low attendance warning, from the same absence-limit logic the ----
    // --- Attendance page already uses (settings.absenceLimits), fired
    // --- once per subject per day it's at/over the limit.
    function checkLowAttendance(n) {
        if (!n.lowAttendance || typeof DB === 'undefined') return;
        const settings = DB.getSettings();
        const limitsMap = settings.absenceLimits || {};
        const defaultLimit = (limitsMap && settings.defaultAbsenceLimit != null && settings.defaultAbsenceLimit !== '' && isFinite(+settings.defaultAbsenceLimit))
            ? +settings.defaultAbsenceLimit : DEFAULT_ABSENCE_LIMIT;
        const semId = DB.getActiveSemesterId();
        const todayStr = todayStrLocal();
        const records = DB.getAttendanceForSemester(semId);

        DB.getSubjects()
            .filter(s => s.semesterId === semId && !s.archived)
            .forEach(s => {
                const raw = limitsMap[s.id];
                const limit = (raw != null && raw !== '' && isFinite(+raw) && +raw >= 0) ? +raw : defaultLimit;
                if (!limit) return;
                const absences = records.filter(r => r.subjectId === s.id && r.status === 'Absent').length;
                if (absences < limit) return;
                const id = `attendance-${s.id}-${todayStr}-${absences}`;
                if (alreadyFired(id)) return;
                notify(`${s.code || 'A subject'}: absence limit reached`, `${absences} of ${limit} allowed absences used.`, id);
                markFired(id);
            });
    }

    function runChecks() {
        if (typeof DB === 'undefined') return;
        try {
            const n = (DB.getSettings().notifications) || {};
            checkUpcomingClasses(n);
            checkTaskReminders(n);
            checkLowAttendance(n);
        } catch (e) {
            console.warn('Reminder check failed', e);
        }
    }

    function start() {
        if (timer) return; // already running on this page
        runChecks();
        timer = setInterval(runChecks, CHECK_INTERVAL_MS);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) runChecks();
        });
    }

    window.ReminderEngine = { start: start, runChecks: runChecks };
})();

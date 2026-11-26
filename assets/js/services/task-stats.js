// Task status / progress / counts (pure logic, no DOM). Shared by Tasks, Dashboard and Calendar
// so the same task is always classified the same way.

function computeProgress(t) {
    if (!t.checklist || t.checklist.length === 0)
        return t.progress || 0;
    var done = t.checklist.filter(function (c) { return c.done; }).length;
    return Math.round((done / t.checklist.length) * 100);
}

function computeStatus(t) {
    if (t.status === 'completed')
        return 'completed';
    var prog = computeProgress(t);
    var now = new Date();
    var due = t.dueDate ? new Date(t.dueDate + 'T' + (t.dueTime || '23:59') + ':00') : null;
    var isOverdue = due && !isNaN(due.getTime()) && due < now;
    if (t.status === 'not-started') {
        if (isOverdue)
            return 'overdue';
        return 'not-started';
    }
    if (isOverdue && prog < 100)
        return 'overdue';
    if (prog === 100)
        return 'completed';
    if (prog > 0)
        return 'in-progress';
    return 'not-started';
}

// Counts for a list of tasks (already filtered to the semester). Single definition of
// total / completed / overdue / active used by the Tasks page and the Dashboard.
function computeTaskCounts(tasks) {
    var list = tasks || [];
    var completed = 0, overdue = 0;
    list.forEach(function (t) {
        var s = computeStatus(t);
        if (s === 'completed')
            completed++;
        else if (s === 'overdue')
            overdue++;
    });
    return { total: list.length, completed: completed, overdue: overdue, active: list.length - completed };
}
// The `task-stats.js` file is responsible for automatically calculating task statistics across the dashboard and other pages.
// It helps determine:
// - **Total Tasks** – The total number of tasks.
// - **Completed Tasks** – The number of finished tasks.
// - **Pending Tasks** – The number of unfinished tasks.
// - **Progress** – The percentage of completed tasks.
// **Example:**
// If a student has 10 tasks:
// - 6 completed
// - 4 pending
// - Overall progress: 60%
// //**Why does it need to be loaded in the HTML?**
// Other JavaScript files use the functions provided by `task-stats.js`. Therefore, it must be loaded before `layout.js` so those functions are available when needed. jc pogi123
// Bugs fixed

// Dashboard used a different grading scale from the Grades page. It had its own table (99/96/93…) and ignored weight normalisation, so the dashboard GWA could differ from the Grades page. It now uses the shared gwa.js, the same table and formula as Grades. The grade bars now show the real grade percentage instead of a value derived from the GWA point.
// Schedule page grades were off by a factor of 100. A component with 100% weight averaging 90% showed as 0.9%. It also treated totalItems: 0 as 100 and judged pass/fail at 75% instead of the app’s 64.5%. It now uses the shared formula and PASSING_PCT.
// Dashboard attendance excluded “Late”, while the Attendance page, subject breakdown and Schedule all count Late as attended. All screens now share one helper, and the printed report uses it too.
// Orphaned and archived attendance records were counted in the overall rate but not in the per-subject figures. Records of deleted or archived subjects are now ignored.
// Auto-completed tasks were never saved. Tasks Page marked a task done when its checklist hit 100%, but DB.saveTasks(DB.getTasks()) re-read storage and wrote back the unmodified data. This is fixed. Task status now comes from one shared task-stats.js, used by Tasks, Dashboard, Calendar and the notification badge.
// Tasks due today appeared in neither Dashboard list. The Overdue list only checked the date, and Upcoming required a date after today. Both now use the same status rules as the Tasks page.
// Weights not summing to 100 were not actually normalised, although the UI says “normalised automatically”. Weights of 80 with everything scored gave a maximum of 80%. It is now normalised over the scored weight. Results are identical when weights total 100.
// Smaller fixes:
// Percent-to-GWA now rounds to 2 decimals before lookup, so float noise like 14.499999999999998 can’t flip a boundary.
// NaN and negative scores are rejected.
// The GWA target planner no longer divides by zero when the ungraded subjects have 0 units.
// The manual GWA calculator no longer counts blank rows as courses after a cloud sync.
// The absence limit falls back to the default if the stored value is invalid.
// The semester progress bar no longer hits 100% before the last day ends.

// Not changed — needs your decision

// Cloud sync stores unscored assessments as score: 0. An assessment with a name and total but no score, like an upcoming quiz, comes back from Supabase as 0%. Your migrations don’t define the grade_assessments columns, so I can’t tell whether they allow NULL. If they do, cloud-sync.js should push null instead of 0.
// Deleting a subject leaves its grades, attendance and tasks behind. The calculations now ignore these leftovers. Cascading the delete would be destructive, so I left that to you.
// The manual GWA calculator marks “PASSED” at ≤ 3.00. That is a rule I couldn’t verify, so I left it. The same goes for labelling an average like 4.0 “Fair”.

// I rounded 96.499 up to 96.50, i.e. 1.00, because the table is defined to 2 decimals (96.49 / 96.50). Say if you want strict truncation instead.

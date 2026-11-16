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
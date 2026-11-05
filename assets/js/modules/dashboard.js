/* ============================================================
   DASHBOARD.JS — Enhanced Command Center
   ============================================================ */

function initDashboard() {
    renderSemesterOverview();
    renderStatCards();
    renderGradePerformance();
    renderAttendanceDonut();
    renderTodaySchedule();
    renderUpcomingTasks();
    // Refresh schedule every minute
    setInterval(renderTodaySchedule, 60000);
}

/* ============================================================
   1. SEMESTER OVERVIEW
   ============================================================ */

function renderSemesterOverview() {
    const sem = DB.getActiveSemester();
    if (!sem)
        return;
    const labelEl = document.getElementById('dashSemLabel');
    if (labelEl)
        labelEl.textContent = sem.schoolYear + ' \u00B7 ' + sem.name;
    const start = new Date(sem.startDate + 'T00:00:00');
    const end = new Date(sem.endDate + 'T00:00:00');
    const now = new Date();
    const totalMs = end - start;
    const elapsedMs = Math.min(Math.max(now - start, 0), totalMs);
    const pct = totalMs > 0 ? Math.round(elapsedMs / totalMs * 100) : 0;
    const totalWeeks = sem.totalWeeks || 15;
    const weekNum = Math.min(totalWeeks, Math.max(1, Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 7))));
    const weeksLeft = Math.max(0, totalWeeks - weekNum);
    var wiEl = document.getElementById('dashWeekInfo');
    if (wiEl)
        wiEl.innerHTML = '<i class="bi bi-calendar3-week me-1"></i>Week ' + weekNum + ' of ' + totalWeeks;
    var wlEl = document.getElementById('dashWeeksLeft');
    if (wlEl)
        wlEl.textContent = weeksLeft + ' week' + (weeksLeft !== 1 ? 's' : '') + ' remaining';
    var spEl = document.getElementById('dashSemPct');
    if (spEl)
        spEl.textContent = pct + '%';
    const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    const startStr = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    var sdEl = document.getElementById('dashSemDates');
    if (sdEl)
        sdEl.textContent = startStr + ' \u2013 ' + endStr + ' \u00B7 ' + daysLeft + ' day' + (daysLeft !== 1 ? 's' : '') + ' to end';
    setTimeout(function () {
        var bar = document.getElementById('dashSemBar');
        if (bar)
            bar.style.width = pct + '%';
    }, 120);
}

/* ============================================================
   2. STAT CARDS
   ============================================================ */

function computeSyllabusCoverage(semId) {
    var courses = DB.getSyllabusCourses().filter(function (c) { return c.semesterId === semId; });
    if (!courses.length)
        return null;
    var sem = DB.getActiveSemester();
    var totalWks = sem ? (sem.totalWeeks || 15) : 15;
    var totalTopics = 0;
    var coveredTopics = 0;
    var hasTopicData = false;
    courses.forEach(function (c) {
        if (Array.isArray(c.topics) && c.topics.length) {
            hasTopicData = true;
            c.topics.forEach(function (t) {
                totalTopics++;
                if (t.completed)
                    coveredTopics++;
            });
        }
    });
    if (hasTopicData && totalTopics > 0)
        return Math.round(coveredTopics / totalTopics * 100);
    var covered = courses.reduce(function (sum, course) { return sum + ((course.weeks || []).length); }, 0);
    var expected = courses.length * totalWks;
    return expected > 0 ? Math.min(100, Math.round(covered / expected * 100)) : 0;
}

function renderStatCards() {
    const semId = DB.getActiveSemesterId();
    const subjects = DB.getSubjects().filter(function (s) { return s.semesterId === semId && !s.archived; });
    const tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    const done = tasks.filter(function (t) { return t.status === 'completed'; }).length;
    const syllabusCoverage = computeSyllabusCoverage(semId);
    animateCountUp('statSubjects', 0, subjects.length, 700, function (v) { return String(Math.round(v)); });
    var subjectsHint = document.getElementById('statSubjectsHint');
    if (subjectsHint)
        subjectsHint.textContent = !subjects.length ? 'No data yet'
            : syllabusCoverage !== null ? 'Syllabus ' + syllabusCoverage + '% covered'
                : 'Active this semester';
    const gwa = computeDashGWA(semId, subjects);
    if (gwa !== null) {
        animateCountUp('statGwa', 0, gwa, 900, function (v) { return v.toFixed(2); });
        var gwaHint = document.getElementById('statGwaHint');
        if (gwaHint)
            gwaHint.textContent = 'Based on entered grades';
    }
    else {
        var el = document.getElementById('statGwa');
        if (el)
            el.textContent = '\u2013';
        var gwaHintEmpty = document.getElementById('statGwaHint');
        if (gwaHintEmpty)
            gwaHintEmpty.textContent = 'No data yet';
    }
    const attRate = computeAttendanceRate(semId);
    if (attRate !== null) {
        animateCountUp('statAtt', 0, attRate, 900, function (v) { return Math.round(v) + '%'; });
        var attHint = document.getElementById('statAttHint');
        if (attHint)
            attHint.textContent = attRate >= 75 ? 'On track' : 'Needs attention';
    }
    else {
        var el2 = document.getElementById('statAtt');
        if (el2)
            el2.textContent = '\u2013';
        var attHintEmpty = document.getElementById('statAttHint');
        if (attHintEmpty)
            attHintEmpty.textContent = 'No data yet';
    }
    var tel = document.getElementById('statTasks');
    if (tel)
        tel.textContent = done + '/' + tasks.length;
    var tasksHint = document.getElementById('statTasksHint');
    if (tasksHint)
        tasksHint.textContent = !tasks.length ? 'No data yet' : done === tasks.length ? 'All complete' : (tasks.length - done) + ' remaining';
}

function animateCountUp(id, from, to, duration, fmt) {
    var el = document.getElementById(id);
    if (!el)
        return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = fmt(to);
        return;
    }
    var start = performance.now();
    function step(now) {
        var t = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (to - from) * eased);
        if (t < 1)
            requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* ============================================================
   3. GRADE PERFORMANCE
   ============================================================ */

var GRADE_TABLE_DASH = [
    { point: 1.00, min: 99 }, { point: 1.25, min: 96 }, { point: 1.50, min: 93 },
    { point: 1.75, min: 90 }, { point: 2.00, min: 87 }, { point: 2.25, min: 84 },
    { point: 2.50, min: 81 }, { point: 2.75, min: 78 }, { point: 3.00, min: 75 },
    { point: 5.00, min: 0 },
];

function pctToGWAPoint(pct) {
    if (pct === null || isNaN(pct))
        return null;
    for (var i = 0; i < GRADE_TABLE_DASH.length; i++) {
        if (pct >= GRADE_TABLE_DASH[i].min)
            return GRADE_TABLE_DASH[i].point;
    }
    return 5.00;
}

function compAvgDash(c) {
    if (Array.isArray(c.assessments) && c.assessments.length) {
        var valid = c.assessments.filter(function (a) { return a.score !== null && a.score !== undefined && a.totalItems; });
        if (!valid.length)
            return null;
        return valid.reduce(function (s, a) { return s + (a.score / a.totalItems * 100); }, 0) / valid.length;
    }
    if (c.score !== null && c.score !== undefined && c.score !== '')
        return +c.score;
    return null;
}

function computeDashSubjectGrades(semId, subjects) {
    var allGrades = DB.getGrades();
    return subjects.map(function (s) {
        var g = allGrades.find(function (x) { return x.subjectId === s.id; });
        if (!g || !Array.isArray(g.components) || !g.components.length)
            return { subject: s, pct: null, point: null };
        var scored = g.components.filter(function (c) { return compAvgDash(c) !== null && c.weight; });
        if (!scored.length)
            return { subject: s, pct: null, point: null };
        var pct = scored.reduce(function (sum, c) { return sum + (compAvgDash(c) * (+c.weight || 0) / 100); }, 0);
        return { subject: s, pct: pct, point: pctToGWAPoint(pct) };
    });
}

function computeDashGWA(semId, subjects) {
    var rows = computeDashSubjectGrades(semId, subjects).filter(function (r) { return r.point !== null; });
    if (!rows.length)
        return null;
    var tu = rows.reduce(function (s, r) { return s + (+r.subject.units || 0); }, 0);
    if (!tu)
        return null;
    return rows.reduce(function (s, r) { return s + r.point * (+r.subject.units || 0); }, 0) / tu;
}

function gwaToPerformancePct(gwaPoint) {
    if (gwaPoint === null)
        return null;
    return Math.max(0, Math.round(((5 - gwaPoint) / 4) * 100));
}

function renderGradePerformance() {
    var semId = DB.getActiveSemesterId();
    var subjects = DB.getSubjects().filter(function (s) { return s.semesterId === semId && !s.archived; });
    var wrap = document.getElementById('dashGradeChart');
    if (!wrap)
        return;
    if (!subjects.length) {
        wrap.innerHTML = dashEmpty('bi-mortarboard', 'No subjects yet', 'Add subjects in Schedule.');
        return;
    }
    var rows = computeDashSubjectGrades(semId, subjects);
    var withGrades = rows.filter(function (r) { return r.pct !== null; });
    if (!withGrades.length) {
        wrap.innerHTML = dashEmpty('bi-bar-chart', 'No grades yet', 'Enter grades on the Grades page.');
        return;
    }
    var display = withGrades.slice(0, 7);
    var html = display.map(function (r, i) {
        var perfPct = gwaToPerformancePct(r.point);
        var barColor = perfPct >= 90 ? 'linear-gradient(90deg,#34d399,#22d3ee)'
            : perfPct >= 80 ? 'linear-gradient(90deg,rgb(var(--accent)),rgb(var(--accent-2)))'
                : perfPct >= 75 ? 'linear-gradient(90deg,#b45309,#f472b6)'
                    : 'linear-gradient(90deg,#fb7185,#92400e)';
        var tooltip = escHtml(r.subject.desc || r.subject.code) + ' — ' + (r.pct !== null ? r.pct.toFixed(1) + '% raw · GWA ' + (r.point !== null ? r.point.toFixed(2) : '–') : '–');
        return '<div class="grade-bar-row" title="' + tooltip + '">' +
            '<div class="grade-bar-label" title="' + escHtml(r.subject.desc) + '">' + escHtml(r.subject.code) + '</div>' +
            '<div class="grade-bar-track"><div class="grade-bar-fill" id="gbar' + i + '" style="width:0%;background:' + barColor + '"></div></div>' +
            '<div class="grade-bar-val-wrap">' +
            '<span class="grade-bar-pct" id="gbarpct' + i + '">0%</span>' +
            '<span class="grade-bar-gwa" title="GWA point">(' + (r.point !== null ? r.point.toFixed(2) : '\u2013') + ')</span>' +
            '</div>' +
            '</div>';
    }).join('');
    wrap.innerHTML = html;
    setTimeout(function () {
        display.forEach(function (r, i) {
            var perfPct = gwaToPerformancePct(r.point);
            var el = document.getElementById('gbar' + i);
            var pctEl = document.getElementById('gbarpct' + i);
            if (el)
                el.style.width = perfPct + '%';
            if (pctEl)
                pctEl.textContent = perfPct + '%';
        });
    }, 180);
}

/* ============================================================
   4. ATTENDANCE DONUT
   ============================================================ */

function computeAttendanceRate(semId) {
    var records = DB.getAttendance().filter(function (r) { return r.semesterId === semId && r.status !== 'No Classes'; });
    if (!records.length)
        return null;
    var present = records.filter(function (r) { return r.status === 'Present' || r.status === 'Excused'; }).length;
    return Math.round(present / records.length * 100);
}

function renderAttendanceDonut() {
    var semId = DB.getActiveSemesterId();
    var all = DB.getAttendance().filter(function (r) { return r.semesterId === semId; });
    var recs = all.filter(function (r) { return r.status !== 'No Classes'; });
    var counts = {
        Present: all.filter(function (r) { return r.status === 'Present'; }).length,
        Late: all.filter(function (r) { return r.status === 'Late'; }).length,
        Excused: all.filter(function (r) { return r.status === 'Excused'; }).length,
        Absent: all.filter(function (r) { return r.status === 'Absent'; }).length,
    };
    var total = recs.length;
    var pctNum = total ? Math.round((counts.Present + counts.Excused) / total * 100) : null;
    var pctEl = document.getElementById('donutPct');
    if (pctEl)
        pctEl.textContent = pctNum !== null ? pctNum + '%' : '\u2013';
    // Keep the legend scannable; the donut center carries the overall rate.
    var presEl = document.getElementById('attPresent');
    if (presEl)
        presEl.textContent = counts.Present;
    var lateEl = document.getElementById('attLate');
    if (lateEl)
        lateEl.textContent = counts.Late;
    var excEl = document.getElementById('attExcused');
    if (excEl)
        excEl.textContent = counts.Excused;
    var absEl = document.getElementById('attAbsent');
    if (absEl)
        absEl.textContent = counts.Absent;
    var circ = 314.16; // 2 * PI * 50
    var order = [
        { id: 'donutPresent', count: counts.Present },
        { id: 'donutLate', count: counts.Late },
        { id: 'donutExcused', count: counts.Excused },
        { id: 'donutAbsent', count: counts.Absent },
    ];
    if (!total) {
        order.forEach(function (seg) {
            var el = document.getElementById(seg.id);
            if (el) {
                el.setAttribute('stroke-dasharray', '0 ' + circ);
                el.setAttribute('stroke-dashoffset', circ);
            }
        });
        return;
    }
    var cumAngle = 0;
    order.forEach(function (seg) {
        var el = document.getElementById(seg.id);
        if (!el)
            return;
        var slice = (seg.count / total) * circ;
        var gap = circ - slice;
        el.setAttribute('stroke-dasharray', slice + ' ' + gap);
        el.setAttribute('stroke-dashoffset', circ - cumAngle + '');
        cumAngle += slice;
    });
}

/* ============================================================
   5. TODAY'S SCHEDULE
   ============================================================ */

function renderTodaySchedule() {
    var wrap = document.getElementById('dashTodaySchedule');
    if (!wrap)
        return;
    var semId = DB.getActiveSemesterId();
    var dayName = DAY_NAMES[new Date().getDay()];
    var list = DB.getSubjects()
        .filter(function (s) { return s.semesterId === semId && !s.archived && s.days && s.days.includes(dayName); })
        .sort(function (a, b) { return a.start.localeCompare(b.start); });
    if (!list.length) {
        wrap.innerHTML = dashEmpty('bi-calendar-x', 'No classes today', 'Enjoy the free day!');
        return;
    }
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    wrap.innerHTML = list.map(function (s) {
        var parts = s.start.split(':').map(Number);
        var eParts = s.end.split(':').map(Number);
        var startM = parts[0] * 60 + parts[1];
        var endM = eParts[0] * 60 + eParts[1];
        var isNow = nowMin >= startM && nowMin <= endM;
        var isDone = nowMin > endM;
        var badge = isNow
            ? '<span class="now-badge">Now</span>'
            : isDone
                ? '<span class="done-badge">Done</span>'
                : '';
        var room = (s.room || '') + (s.building ? ' \u00B7 ' + s.building : '');
        return '<div class="sched-row">' +
            '<div class="sched-dot" style="background:' + (s.color || 'rgb(var(--accent))') + '"></div>' +
            '<div class="flex-grow-1">' +
            '<div class="sched-code">' + escHtml(s.code) + '</div>' +
            '<div class="sched-room">' + escHtml(room) + '</div>' +
            '</div>' +
            '<div class="text-end">' +
            '<div class="sched-time">' + fmtTime(s.start) + '</div>' +
            badge +
            '</div>' +
            '</div>';
    }).join('');
}

/* ============================================================
   6. UPCOMING TASKS
   ============================================================ */

function renderUpcomingTasks() {
    var wrap = document.getElementById('dashUpcomingTasks');
    if (!wrap)
        return;
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var today = todayKey();
    // Overdue tasks (show up to 2)
    var overdueTasks = DB.getTasks()
        .filter(function (t) { return t.semesterId === semId && t.status !== 'completed' && t.dueDate < today; })
        .sort(function (a, b) { return b.dueDate.localeCompare(a.dueDate); })
        .slice(0, 2);
    // Upcoming tasks (after today)
    var upcomingTasks = DB.getTasks()
        .filter(function (t) { return t.semesterId === semId && t.status !== 'completed' && t.dueDate > today; })
        .sort(function (a, b) { return (a.dueDate + (a.dueTime || '')).localeCompare(b.dueDate + (b.dueTime || '')); })
        .slice(0, 3);
    if (!overdueTasks.length && !upcomingTasks.length) {
        wrap.innerHTML = dashEmpty('bi-emoji-smile', 'No upcoming tasks', 'You\'re all caught up!');
        return;
    }
    var html = '';
    if (overdueTasks.length) {
        html += '<div class="upcoming-section-label upcoming-overdue-label"><i class="bi bi-exclamation-triangle-fill me-1"></i>Overdue</div>';
        html += overdueTasks.map(function (t) {
            var sub = subs.find(function (s) { return s.id === t.subjectId; });
            var dateStr = new Date(t.dueDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
            var catIcon = taskCatIcon(t.category);
            return '<div class="task-row-dash task-row-overdue">' +
                '<div class="task-row-icon task-row-icon-overdue"><i class="bi ' + catIcon + '"></i></div>' +
                '<div class="flex-grow-1">' +
                '<div class="task-title-dash">' + escHtml(t.title) + '</div>' +
                '<div class="task-meta-dash">' + (sub ? escHtml(sub.code) + ' \u00B7 ' : '') + dateStr + '</div>' +
                '</div>' +
                '<div class="task-days-left days-urgent">Overdue</div>' +
                '</div>';
        }).join('');
    }
    if (upcomingTasks.length) {
        if (overdueTasks.length)
            html += '<div class="upcoming-section-label mt-2"><i class="bi bi-clock me-1"></i>Upcoming</div>';
        html += upcomingTasks.map(function (t) {
            var sub = subs.find(function (s) { return s.id === t.subjectId; });
            var daysLeft = Math.ceil((new Date(t.dueDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
            var dayClass = daysLeft <= 1 ? 'days-urgent' : daysLeft <= 3 ? 'days-soon' : 'days-ok';
            var dayLabel = daysLeft === 1 ? '1 day left' : daysLeft + ' days left';
            var dateStr = new Date(t.dueDate + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
            var catIcon = taskCatIcon(t.category);
            return '<div class="task-row-dash">' +
                '<div class="task-row-icon"><i class="bi ' + catIcon + '"></i></div>' +
                '<div class="flex-grow-1">' +
                '<div class="task-title-dash">' + escHtml(t.title) + '</div>' +
                '<div class="task-meta-dash">' + (sub ? escHtml(sub.code) + ' \u00B7 ' : '') + dateStr + '</div>' +
                '</div>' +
                '<div class="task-days-left ' + dayClass + '">' + dayLabel + '</div>' +
                '</div>';
        }).join('');
    }
    wrap.innerHTML = html;
}

function taskCatIcon(cat) {
    var map = {
        Homework: 'bi-pencil-square', Project: 'bi-kanban', Quiz: 'bi-patch-question',
        Exam: 'bi-journal-text', Personal: 'bi-person', Organization: 'bi-folder',
        Academic: 'bi-book', Assignment: 'bi-pencil', Other: 'bi-check2-square'
    };
    return map[cat] || 'bi-check2-square';
}

/* ============================================================
   HELPERS
   ============================================================ */

function dashEmpty(icon, title, sub) {
    return '<div class="dash-empty">' +
        '<i class="bi ' + icon + '"></i>' +
        '<div class="dash-empty-title">' + title + '</div>' +
        (sub ? '<div class="dash-empty-sub">' + sub + '</div>' : '') +
        '</div>';
}

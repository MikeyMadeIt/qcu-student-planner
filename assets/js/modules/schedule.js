// SCHEDULE.JS — Advanced Academic Command Center

let schedView = 'day';
let showArchived = false;
const TT_ZOOM_LEVELS = [50, 75, 100, 125, 150];
const TT_BASE_HOUR_PX = 52;
let ttZoomPct = 100;
let ttHourHeight = TT_BASE_HOUR_PX;
let _selectedDate = new Date();
let _weekOffset = 0;
let _tickTimer = null;
let _pinchStartDist = 0;
let _pinchStartZoom = 100;
// Helpers

function esc(s) { return escHtml(s); }

function toMins(t) { if (!t)
    return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; }

function fromMins(m) { const h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }

function minsDiff(a, b) { return toMins(b) - toMins(a); }

function nowMins() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }

function isoDate(d) { return ymdLocal(d); }

function dateAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function weekStart(d) { const r = new Date(d); r.setDate(r.getDate() - (r.getDay() === 0 ? 6 : r.getDay() - 1)); return r; }

function sameDay(a, b) { return isoDate(a) === isoDate(b); }
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// AJ-08: Route through DB so cloud-sync.js can intercept saves/hydrate.
function getCancelledOccurrences() {
    return DB.getCancelledOccurrences();
}

function saveCancelledOccurrences(arr) {
    DB.saveCancelledOccurrences(arr);
}

function isOccurrenceCancelled(subjectId, dateStr) {
    return getCancelledOccurrences().some(c => c.subjectId === subjectId && c.date === dateStr);
}

function getCancellationInfo(subjectId, dateStr) {
    return getCancelledOccurrences().find(c => c.subjectId === subjectId && c.date === dateStr) || null;
}

function cancelOccurrence(subjectId, dateStr, reason = '') {
    const arr = getCancelledOccurrences();
    const existing = arr.find(c => c.subjectId === subjectId && c.date === dateStr);
    if (existing) {
        existing.reason = reason;
    }
    else
        arr.push({ subjectId, date: dateStr, reason, cancelledAt: Date.now() });
    saveCancelledOccurrences(arr);
}

function restoreOccurrence(subjectId, dateStr) {
    const arr = getCancelledOccurrences().filter(c => !(c.subjectId === subjectId && c.date === dateStr));
    saveCancelledOccurrences(arr);
}

// Attendance helpers

function getAttendanceRecord(subjectId, dateStr) {
    const semId = DB.getActiveSemesterId();
    return DB.getAttendance().find(r => r.subjectId === subjectId && r.date === dateStr && r.semesterId === semId) || null;
}

function logQuickAttendance(subjectId, dateStr, status) {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance();
    const existing = records.find(r => r.subjectId === subjectId && r.date === dateStr && r.semesterId === semId);
    if (existing) {
        existing.status = status;
    }
    else {
        records.push({ id: DB.uid(), subjectId, date: dateStr, status, online: false, notes: '', semesterId: semId });
    }
    DB.saveAttendance(records);
}

// Grade helpers

function getSubjectGradeAvg(subjectId) {
    const grades = DB.getGrades();
    const g = grades.find(x => x.subjectId === subjectId);
    if (!g || !g.components || !g.components.length)
        return null;
    let totalWeight = 0, weightedSum = 0;
    g.components.forEach(c => {
        const w = parseFloat(c.weight) || 0;
        let score = null;
        if (Array.isArray(c.assessments) && c.assessments.length) {
            const scored = c.assessments.filter(a => a.score != null);
            if (scored.length) {
                const avg = scored.reduce((s, a) => {
                    const maxItems = a.totalItems || 100;
                    return s + (a.score / maxItems * 100);
                }, 0) / scored.length;
                score = avg;
            }
        }
        else if (c.score != null && c.score !== '') {
            score = parseFloat(c.score);
        }
        if (score != null && w > 0) {
            weightedSum += score * (w / 100);
            totalWeight += w;
        }
    });
    if (totalWeight === 0)
        return null;
    return Math.round((weightedSum / totalWeight) * 100) / 100;
}

function getSubjectAttendanceRate(subjectId) {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance().filter(r => r.subjectId === subjectId && r.semesterId === semId && r.status !== 'No Classes');
    if (!records.length)
        return null;
    const present = records.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
    return Math.round(present / records.length * 100);
}

// Init

function initSchedule() {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1')
        openSubjectModal();
    setSchedView('day');
    renderNav();
    renderAllViews();
    startTick();
    setupPinchZoom();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            renderNextCard();
            renderDaySummary();
        }
    });
}

// Tick

function startTick() {
    clearInterval(_tickTimer);
    _tickTimer = setInterval(() => { renderNextCard(); renderDaySummary(); }, 30000);
}

// View switching

function setSchedView(v) {
    schedView = v;
    syncViewButton();
    document.getElementById('schDayView').classList.toggle('d-none', v !== 'day');
    document.getElementById('schTimetableView').classList.toggle('d-none', v !== 'timetable');
    document.getElementById('schListView').classList.toggle('d-none', v !== 'list');
    document.getElementById('schTasksPanel').classList.toggle('d-none', v !== 'day');
    renderAllViews();
}

const SCHED_VIEWS = [
    { id: 'day', label: 'Day', icon: 'bi-calendar-day', desc: 'Classes for the selected day' },
    { id: 'timetable', label: 'Week', icon: 'bi-calendar2-week', desc: 'Weekly timetable grid' },
    { id: 'list', label: 'Subject List', icon: 'bi-list-ul', desc: 'All subjects in this semester' }
];

function renderViewMenu() {
    const menu = document.getElementById('schViewMenu');
    if (!menu)
        return;
    menu.innerHTML = SCHED_VIEWS.map(v => `<button type="button" class="dropdown-item sch-view-option ${v.id === schedView ? 'active' : ''}" data-view="${v.id}" role="radio" aria-checked="${v.id === schedView ? 'true' : 'false'}" onclick="chooseView('${v.id}')">
      <i class="bi ${v.icon} sch-view-option-icon" aria-hidden="true"></i>
      <span class="sch-view-option-text"><span class="sch-view-option-title">${v.label}</span><span class="sch-view-option-desc">${v.desc}</span></span>
      <i class="bi bi-check2 sch-view-option-check" aria-hidden="true"></i>
    </button>`).join('');
}

function syncViewButton() {
    const cur = SCHED_VIEWS.find(x => x.id === schedView) || SCHED_VIEWS[0];
    const icon = document.getElementById('schViewBtnIcon');
    const label = document.getElementById('schViewBtnLabel');
    if (icon)
        icon.className = 'bi ' + cur.icon;
    if (label)
        label.textContent = cur.label;
    renderViewMenu();
}

function chooseView(v) {
    const btn = document.getElementById('schViewBtn');
    const dd = btn && bootstrap.Dropdown.getInstance(btn);
    if (dd)
        dd.hide();
    setSchedView(v);
}

// Week / day navigation

function shiftWeek(dir) {
    _weekOffset += dir;
    _selectedDate = dateAddDays(new Date(), _weekOffset * 7);
    const ws = weekStart(_selectedDate);
    _selectedDate = ws;
    renderNav();
    renderAllViews();
}

function shiftDay(dir) {
    _selectedDate = dateAddDays(_selectedDate, dir);
    renderNav();
    renderAllViews();
}

function goToday() {
    _weekOffset = 0;
    _selectedDate = new Date();
    renderNav();
    renderAllViews();
}

function selectDay(d) {
    _selectedDate = d;
    renderNav();
    renderAllViews();
}

// Navigation bar render

function renderNav() {
    const ws = weekStart(_selectedDate);
    const we = dateAddDays(ws, 6);
    const wsMonth = MONTH_NAMES[ws.getMonth()].slice(0, 3);
    const weMonth = MONTH_NAMES[we.getMonth()].slice(0, 3);
    const label = wsMonth === weMonth
        ? `${wsMonth} ${ws.getDate()}–${we.getDate()}, ${ws.getFullYear()}`
        : `${wsMonth} ${ws.getDate()} – ${weMonth} ${we.getDate()}, ${ws.getFullYear()}`;
    document.getElementById('schWeekLabel').textContent = label;
    const strip = document.getElementById('schDayStrip');
    const today = new Date();
    strip.innerHTML = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = dateAddDays(ws, i);
        const isToday = sameDay(d, today);
        const isSel = sameDay(d, _selectedDate);
        const dayName = DAY_SHORT[d.getDay()];
        const dateStr = isoDate(d);
        const inSemester = isDateInSemester(d);
        return `<button class="sch-day-btn ${isSel ? 'selected' : ''} ${isToday ? 'today' : ''}" style="${inSemester ? '' : 'opacity:.45'}" onclick="selectDay(new Date('${dateStr}T00:00:00'))" aria-label="${DAY_LONG[d.getDay()]} ${d.getDate()}${inSemester ? '' : ', outside semester'}" aria-pressed="${isSel ? 'true' : 'false'}">
      <span class="sch-day-name">${dayName.toUpperCase()}</span>
      <span class="sch-day-num">${d.getDate()}</span>
    </button>`;
    }).join('');
}

// Get subjects for a day

function getSubjectsForDay(date) {
    const semId = DB.getActiveSemesterId();
    if (!isDateInSemester(date))
        return [];
    const dayName = DAY_SHORT[date.getDay()];
    return DB.getSubjects()
        .filter(s => s.semesterId === semId && !s.archived && s.days && s.days.includes(dayName))
        .sort((a, b) => toMins(a.start) - toMins(b.start));
}

function getSemesterEmptyState(date) {
    const semester = DB.getActiveSemester();
    if (!semester)
        return null;
    const dateKey = isoDate(date);
    if (semester.startDate && dateKey < semester.startDate) {
        const startDate = new Date(semester.startDate + 'T00:00:00');
        if (!isNaN(startDate.getTime())) {
            return {
                title: "Semester hasn't started yet",
                detail: `Classes begin ${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
            };
        }
    }
    if (semester.endDate && dateKey > semester.endDate)
        return { title: 'Semester has ended', detail: '' };
    return null;
}

// All semester subjects

function getSemesterSubjects() {
    const semId = DB.getActiveSemesterId();
    return DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
}

// Tasks helpers

function getTasksDueToday(subjectId) {
    const today = isoDate(new Date());
    const semId = DB.getActiveSemesterId();
    return DB.getTasks().filter(t => t.semesterId === semId && t.subjectId === subjectId && t.dueDate === today);
}

function getAllTasksDueToday() {
    const today = isoDate(new Date());
    const semId = DB.getActiveSemesterId();
    return DB.getTasks().filter(t => t.semesterId === semId && t.dueDate === today);
}

// Next/current class logic (skips cancelled)

function getNextOrCurrentClass(date) {
    const dateStr = isoDate(date);
    const classes = getSubjectsForDay(date).filter(s => !isOccurrenceCancelled(s.id, dateStr));
    if (!classes.length)
        return null;
    const nm = nowMins();
    const current = classes.find(s => toMins(s.start) <= nm && toMins(s.end) > nm);
    if (current)
        return { type: 'now', subject: current };
    const next = classes.find(s => toMins(s.start) > nm);
    if (next)
        return { type: 'next', subject: next };
    return null;
}

// Conflict detection

function detectConflicts(classes) {
    const conflicts = [];
    const seen = new Set();
    for (let i = 0; i < classes.length; i++) {
        for (let j = i + 1; j < classes.length; j++) {
            const a = classes[i], b = classes[j];
            const aStart = toMins(a.start), aEnd = toMins(a.end);
            const bStart = toMins(b.start), bEnd = toMins(b.end);
            if (aStart < bEnd && aEnd > bStart) {
                const key = [a.id, b.id].sort().join('|');
                if (!seen.has(key)) {
                    seen.add(key);
                    const overlapMins = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
                    conflicts.push({ a, b, overlapMins });
                }
            }
        }
    }
    return conflicts;
}

// Detect conflicts for all days (for week view)

function detectAllWeekConflicts() {
    const semId = DB.getActiveSemesterId();
    const allSubs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const conflictSubjectIds = new Set();
    DAY_SHORT.forEach(dayName => {
        const daySubs = allSubs.filter(s => s.days && s.days.includes(dayName));
        const conflicts = detectConflicts(daySubs);
        conflicts.forEach(c => { conflictSubjectIds.add(c.a.id); conflictSubjectIds.add(c.b.id); });
    });
    return conflictSubjectIds;
}

// Check conflict for save (returns array of conflicting subjects)

function checkSaveConflict(data, excludeId) {
    const semId = DB.getActiveSemesterId();
    const allSubs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived && s.id !== excludeId);
    const conflicts = [];
    const newStart = toMins(data.start), newEnd = toMins(data.end);
    allSubs.forEach(s => {
        if (!s.days || !data.days)
            return;
        const sharedDays = s.days.filter(d => data.days.includes(d));
        if (!sharedDays.length)
            return;
        const sStart = toMins(s.start), sEnd = toMins(s.end);
        if (newStart < sEnd && newEnd > sStart) {
            conflicts.push(s);
        }
    });
    return conflicts;
}

// Free time blocks

function buildTimeline(classes) {
    const MIN_FREE = 15;
    const items = [];
    let prev = null;
    classes.forEach(s => {
        if (prev) {
            const gap = toMins(s.start) - toMins(prev.end);
            if (gap >= MIN_FREE)
                items.push({ type: 'free', start: prev.end, end: s.start, mins: gap });
        }
        items.push({ type: 'class', subject: s });
        prev = s;
    });
    return items;
}

// Render all views

function renderAllViews() {
    renderNextCard();
    if (schedView === 'day') {
        renderDaySummary();
        renderTasksPanel();
    }
    else if (schedView === 'timetable')
        renderTimetable();
    else
        renderListView();
}

// Next / Current class card (improved)

function renderNextCard() {
    const host = document.getElementById('schNextCard');
    const today = new Date();
    const isToday = sameDay(_selectedDate, today);
    if (!isToday) {
        host.innerHTML = '';
        return;
    }
    const todayStr = isoDate(today);
    const info = getNextOrCurrentClass(today);
    if (!info) {
        const semesterState = getSemesterEmptyState(today);
        if (semesterState) {
            host.innerHTML = `<div class="glass card-pad sch-next-card sch-done fade-in">
      <div class="sch-next-badge done" aria-hidden="true"><i class="bi bi-calendar-x"></i></div>
      <div class="sch-next-body">
        <div class="sch-next-label">${semesterState.title.toUpperCase()}</div>
        ${semesterState.detail ? `<div class="sch-next-subject">${semesterState.detail}</div>` : ''}
      </div>
    </div>`;
            return;
        }
        const classes = getSubjectsForDay(today);
        const hadClasses = classes.length > 0;
        host.innerHTML = `<div class="glass card-pad sch-next-card sch-done fade-in">
      <div class="sch-next-badge done" aria-hidden="true"><i class="bi bi-check2-circle"></i></div>
      <div class="sch-next-body">
        <div class="sch-next-label">${hadClasses ? 'NO MORE CLASSES TODAY' : 'NO CLASSES TODAY'}</div>
        <div class="sch-next-subject">${hadClasses ? 'All done for today!' : 'No scheduled classes.'}</div>
      </div>
    </div>`;
        return;
    }
    const s = info.subject;
    const nm = nowMins();
    const location = buildLocation(s);
    const timeStr = `${fmtTime(s.start)} – ${fmtTime(s.end)}`;
    const attRecord = getAttendanceRecord(s.id, todayStr);
    const attStatus = attRecord ? attRecord.status : null;
    const onlineChip = s.online ? `<span class="sch-online-chip" aria-label="Online class"><i class="bi bi-wifi"></i> ONLINE</span>` : '';
    const attBtn = buildAttendanceBtn(s.id, todayStr, attStatus, 'small');
    if (info.type === 'now') {
        const elapsed = nm - toMins(s.start);
        const total = toMins(s.end) - toMins(s.start);
        const pct = Math.min(100, Math.round((elapsed / total) * 100));
        const remaining = toMins(s.end) - nm;
        host.innerHTML = `<div class="glass card-pad sch-next-card sch-now fade-in" style="--sc-color:${s.color}">
      <div class="sch-next-badge now" aria-hidden="true"><i class="bi bi-broadcast"></i></div>
      <div class="sch-next-body">
        <div class="sch-next-label">NOW IN SESSION</div>
        <div class="sch-next-subject">${esc(s.desc)}</div>
        <div class="sch-next-meta"><span class="text-faint">${esc(s.code)}</span><span class="sch-dot-sep" aria-hidden="true">·</span><span class="text-faint">${timeStr}</span>${onlineChip}</div>
        ${location ? `<div class="sch-next-loc"><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(location)}</div>` : ''}
        <div class="sch-now-progress-wrap mt-2">
          <div class="d-flex justify-content-between mb-1" style="font-size:.7rem;color:var(--text-faint)">
            <span>${pct}% through</span><span>${remaining}m remaining</span>
          </div>
          <div class="sch-now-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="sch-now-fill" style="width:${pct}%;background:${s.color}"></div></div>
        </div>
      </div>
      <div class="sch-next-actions">
        ${buildAttendanceIconBtn(s.id, todayStr, attStatus)}
        <button class="btn btn-ghost btn-sm sch-next-edit" onclick="openSubjectModal('${s.id}')" title="Edit subject" aria-label="Edit ${esc(s.code)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
      </div>
    </div>`;
    }
    else {
        const minsAway = toMins(s.start) - nm;
        const awayStr = minsAway < 60 ? `In ${minsAway}m` : `In ${Math.floor(minsAway / 60)}h ${minsAway % 60}m`;
        host.innerHTML = `<div class="glass card-pad sch-next-card sch-upcoming fade-in" style="--sc-color:${s.color}">
      <div class="sch-next-badge next" aria-hidden="true"><i class="bi bi-arrow-right-circle"></i></div>
      <div class="sch-next-body">
        <div class="sch-next-label">NEXT CLASS</div>
        <div class="sch-next-subject">${esc(s.desc)}</div>
        <div class="sch-next-meta"><span class="text-faint">${esc(s.code)}</span><span class="sch-dot-sep" aria-hidden="true">·</span><span class="text-faint">${timeStr}</span>${onlineChip}</div>
        ${location ? `<div class="sch-next-loc"><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(location)}</div>` : ''}
        <div class="sch-next-away">${awayStr}</div>
      </div>
      <div class="sch-next-actions">
        ${buildAttendanceIconBtn(s.id, todayStr, attStatus)}
        <button class="btn btn-ghost btn-sm sch-next-edit" onclick="openSubjectModal('${s.id}')" title="Edit subject" aria-label="Edit ${esc(s.code)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
      </div>
    </div>`;
    }
}

// Build location string

function buildLocation(s) {
    if (s.online)
        return null;
    const parts = [];
    if (s.building)
        parts.push(s.building);
    if (s.room)
        parts.push('Room ' + s.room);
    return parts.join(' · ') || (s.room || s.building || '');
}

// Attendance button builder

function buildAttendanceBtn(subjectId, dateStr, existingStatus, size = 'normal') {
    const isSmall = size === 'small';
    if (existingStatus && existingStatus !== 'No Classes') {
        const icons = { Present: 'bi-check-circle-fill', Late: 'bi-clock-fill', Absent: 'bi-x-circle-fill', Excused: 'bi-shield-check' };
        const colors = { Present: '#34d399', Late: '#b45309', Absent: '#fb7185', Excused: '#60a5fa' };
        const ic = icons[existingStatus] || 'bi-check-circle-fill';
        const col = colors[existingStatus] || 'var(--text-faint)';
        return `<div class="sch-att-logged" style="color:${col}"><i class="bi ${ic}" aria-hidden="true"></i> ${existingStatus}</div>`;
    }
    const btnClass = isSmall ? 'btn btn-ghost btn-sm sch-att-btn' : 'btn btn-ghost btn-sm sch-att-btn';
    return `<button class="${btnClass}" onclick="openQuickAttModal('${subjectId}','${dateStr}')" aria-label="Log attendance for this class"><i class="bi bi-person-check" aria-hidden="true"></i> Attendance</button>`;
}

// Attendance icon button (compact, for card header)

function buildAttendanceIconBtn(subjectId, dateStr, existingStatus) {
    if (existingStatus && existingStatus !== 'No Classes') {
        const icons = { Present: 'bi-check-circle-fill', Late: 'bi-clock-fill', Absent: 'bi-x-circle-fill', Excused: 'bi-shield-check' };
        const colors = { Present: '#34d399', Late: '#b45309', Absent: '#fb7185', Excused: '#60a5fa' };
        const ic = icons[existingStatus] || 'bi-check-circle-fill';
        const col = colors[existingStatus] || 'var(--text-faint)';
        return `<button class="btn-icon sched-icon-btn sch-att-icon-logged" style="color:${col}" onclick="openQuickAttModal('${subjectId}','${dateStr}')" title="Attendance: ${existingStatus}" aria-label="Attendance logged: ${existingStatus}"><i class="bi ${ic}" aria-hidden="true"></i></button>`;
    }
    return `<button class="btn-icon sched-icon-btn" onclick="openQuickAttModal('${subjectId}','${dateStr}')" title="Log attendance" aria-label="Log attendance"><i class="bi bi-person-check" aria-hidden="true"></i></button>`;
}

// Quick Attendance Modal

function openQuickAttModal(subjectId, dateStr) {
    const s = DB.getSubject(subjectId);
    if (!s)
        return;
    if (isOccurrenceCancelled(subjectId, dateStr)) {
        Toast.show('This class was cancelled — attendance not applicable', 'high', 'bi-ban');
        return;
    }
    const existing = getAttendanceRecord(subjectId, dateStr);
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const displayDate = `${months[+m - 1]} ${+d}, ${y}`;
    ensureQuickAttModal();
    const body = document.getElementById('quickAttModalBody');
    const statuses = ['Present', 'Late', 'Excused', 'Absent'];
    const currentStatus = existing ? existing.status : '';
    body.innerHTML = `
    <div class="d-flex align-items-center gap-2 mb-3">
      <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
      <div>
        <div class="fw-bold" style="font-size:.9rem">${esc(s.code)}</div>
        <div class="text-faint" style="font-size:.78rem">${esc(s.desc)}</div>
      </div>
    </div>
    <div class="sch-att-date-info mb-3">
      <i class="bi bi-calendar3" aria-hidden="true"></i>
      <span>${displayDate} · ${fmtTime(s.start)} – ${fmtTime(s.end)}</span>
    </div>
    <div class="sch-att-status-grid mb-3" role="group" aria-label="Attendance status">
      ${statuses.map(st => {
        const icons = { Present: 'bi-check-circle', Late: 'bi-clock', Absent: 'bi-x-circle', Excused: 'bi-shield-check' };
        const colors = { Present: '34d399', Late: 'b45309', Absent: 'fb7185', Excused: '60a5fa' };
        const isActive = currentStatus === st;
        return `<button class="sch-att-status-btn ${isActive ? 'active' : ''}" data-status="${st}" style="--att-color:#${colors[st]}" onclick="selectQuickAtt('${st}')" aria-pressed="${isActive ? 'true' : 'false'}">
          <i class="bi ${icons[st]}" aria-hidden="true"></i>
          <span>${st}</span>
        </button>`;
    }).join('')}
    </div>
    <input type="hidden" id="quickAttSubjectId" value="${subjectId}">
    <input type="hidden" id="quickAttDate" value="${dateStr}">
    <div class="d-flex gap-2">
      <button class="btn btn-accent flex-grow-1" onclick="saveQuickAtt()" aria-label="Save attendance"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Save</button>
      ${existing ? `<button class="btn btn-ghost" onclick="clearQuickAtt('${subjectId}','${dateStr}')" aria-label="Clear attendance record"><i class="bi bi-trash3" aria-hidden="true"></i></button>` : ''}
    </div>`;
    new bootstrap.Modal(document.getElementById('quickAttModal')).show();
}

function ensureQuickAttModal() {
    if (document.getElementById('quickAttModal'))
        return;
    const el = document.createElement('div');
    el.innerHTML = `<div class="modal fade" id="quickAttModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="quickAttModalLabel">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad">
        <div class="modal-header" style="border:none;padding-bottom:8px">
          <h5 class="modal-title" id="quickAttModalLabel"><i class="bi bi-person-check me-2" aria-hidden="true"></i>Log Attendance</h5>
          <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div id="quickAttModalBody"></div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(el.firstElementChild);
}

function selectQuickAtt(status) {
    document.querySelectorAll('.sch-att-status-btn').forEach(b => {
        const isActive = b.dataset.status === status;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function saveQuickAtt() {
    const subjectId = document.getElementById('quickAttSubjectId').value;
    const dateStr = document.getElementById('quickAttDate').value;
    const statusBtn = document.querySelector('.sch-att-status-btn.active');
    if (!statusBtn) {
        Toast.show('Select an attendance status', 'high', 'bi-exclamation-triangle');
        return;
    }
    const status = statusBtn.dataset.status;
    logQuickAttendance(subjectId, dateStr, status);
    const modal = bootstrap.Modal.getInstance(document.getElementById('quickAttModal'));
    if (modal)
        modal.hide();
    Toast.show('Attendance saved');
    renderAllViews();
}

function clearQuickAtt(subjectId, dateStr) {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance().filter(r => !(r.subjectId === subjectId && r.date === dateStr && r.semesterId === semId));
    DB.saveAttendance(records);
    const modal = bootstrap.Modal.getInstance(document.getElementById('quickAttModal'));
    if (modal)
        modal.hide();
    Toast.show('Attendance cleared');
    renderAllViews();
}

// Cancel Occurrence Modal

function openCancelModal(subjectId, dateStr) {
    const s = DB.getSubject(subjectId);
    if (!s)
        return;
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const displayDate = `${months[+m - 1]} ${+d}, ${y}`;
    const isCancelled = isOccurrenceCancelled(subjectId, dateStr);
    ensureCancelModal();
    const body = document.getElementById('cancelModalBody');
    if (isCancelled) {
        const info = getCancellationInfo(subjectId, dateStr);
        body.innerHTML = `
      <div class="sch-cancel-info">
        <i class="bi bi-ban" aria-hidden="true"></i>
        <div>
          <div class="fw-bold">${displayDate} — ${esc(s.code)} is cancelled</div>
          ${info && info.reason ? `<div class="text-faint" style="font-size:.8rem">${esc(info.reason)}</div>` : ''}
        </div>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-accent flex-grow-1" onclick="doRestoreOccurrence('${subjectId}','${dateStr}')"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restore Class</button>
        <button class="btn btn-ghost" data-bs-dismiss="modal">Close</button>
      </div>`;
    }
    else {
        body.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-3">
        <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
        <div>
          <div class="fw-bold" style="font-size:.9rem">${esc(s.code)}</div>
          <div class="text-faint" style="font-size:.78rem">${esc(s.desc)}</div>
        </div>
      </div>
      <div class="sch-att-date-info mb-3">
        <i class="bi bi-calendar3" aria-hidden="true"></i>
        <span>${displayDate}</span>
      </div>
      <div class="mb-3">
        <label class="form-label" style="font-size:.82rem">Reason (optional)</label>
        <input class="form-control" id="cancelReason" placeholder="e.g. Faculty meeting" style="font-size:.84rem">
      </div>
      <input type="hidden" id="cancelSubjectId" value="${subjectId}">
      <input type="hidden" id="cancelDate" value="${dateStr}">
      <div class="d-flex gap-2">
        <button class="btn btn-ghost flex-grow-1" data-bs-dismiss="modal">Keep Class</button>
        <button class="btn sch-cancel-btn flex-grow-1" onclick="doCancel()"><i class="bi bi-ban me-1" aria-hidden="true"></i>Cancel Class</button>
      </div>`;
    }
    new bootstrap.Modal(document.getElementById('cancelModal')).show();
}

function ensureCancelModal() {
    if (document.getElementById('cancelModal'))
        return;
    const el = document.createElement('div');
    el.innerHTML = `<div class="modal fade" id="cancelModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="cancelModalLabel">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad">
        <div class="modal-header" style="border:none;padding-bottom:8px">
          <h5 class="modal-title" id="cancelModalLabel"><i class="bi bi-calendar-x me-2" aria-hidden="true"></i>Cancel Class</h5>
          <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div id="cancelModalBody"></div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(el.firstElementChild);
}

function doCancel() {
    const subjectId = document.getElementById('cancelSubjectId').value;
    const dateStr = document.getElementById('cancelDate').value;
    const reason = (document.getElementById('cancelReason')?.value || '').trim();
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance();
    const existing = records.find(r => r.subjectId === subjectId && r.date === dateStr && r.semesterId === semId);
    if (existing) {
        existing.status = 'No Classes';
    }
    else
        records.push({ id: DB.uid(), subjectId, date: dateStr, status: 'No Classes', online: false, notes: reason || 'Class cancelled', semesterId: semId });
    DB.saveAttendance(records);
    cancelOccurrence(subjectId, dateStr, reason);
    const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
    if (modal)
        modal.hide();
    Toast.show('Class cancelled for this date');
    renderAllViews();
}

function doRestoreOccurrence(subjectId, dateStr) {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance().filter(r => !(r.subjectId === subjectId && r.date === dateStr && r.semesterId === semId && r.status === 'No Classes'));
    DB.saveAttendance(records);
    restoreOccurrence(subjectId, dateStr);
    const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
    if (modal)
        modal.hide();
    Toast.show('Class restored');
    renderAllViews();
}

// Day view: summary + timeline

function renderDaySummary() {
    const host = document.getElementById('schDayView');
    const allClasses = getSubjectsForDay(_selectedDate);
    const dateStr = isoDate(_selectedDate);
    const today = new Date();
    const isToday = sameDay(_selectedDate, today);
    const nm = nowMins();
    const classes = allClasses;
    const activeClasses = classes.filter(s => !isOccurrenceCancelled(s.id, dateStr));
    const totalClassMins = activeClasses.reduce((acc, s) => acc + (toMins(s.end) - toMins(s.start)), 0);
    const conflicts = detectConflicts(activeClasses);
    let summaryHtml = '';
    if (classes.length) {
        const firstStart = activeClasses.length ? activeClasses[0].start : classes[0].start;
        const lastEnd = activeClasses.length ? activeClasses[activeClasses.length - 1].end : classes[classes.length - 1].end;
        const spanMins = activeClasses.length ? toMins(lastEnd) - toMins(firstStart) : 0;
        const freeMins = spanMins - totalClassMins;
        const cancelledCount = classes.length - activeClasses.length;
        summaryHtml = `<div class="sch-day-summary glass card-pad mb-3 fade-in">
      <div class="sch-summary-label">${isToday ? 'TODAY' : 'DAY SUMMARY'} · ${DAY_LONG[_selectedDate.getDay()].toUpperCase()}</div>
      <div class="sch-summary-stats">
        <div class="sch-stat"><span class="sch-stat-val">${activeClasses.length}</span><span class="sch-stat-lbl">Class${activeClasses.length === 1 ? '' : 'es'}</span></div>
        <div class="sch-stat-div" aria-hidden="true"></div>
        <div class="sch-stat"><span class="sch-stat-val">${fmtDuration(totalClassMins)}</span><span class="sch-stat-lbl">Class Time</span></div>
        ${freeMins >= 15 ? `<div class="sch-stat-div" aria-hidden="true"></div><div class="sch-stat"><span class="sch-stat-val">${fmtDuration(freeMins)}</span><span class="sch-stat-lbl">Free Time</span></div>` : ''}
        ${cancelledCount ? `<div class="sch-stat-div" aria-hidden="true"></div><div class="sch-stat"><span class="sch-stat-val" style="color:#fb7185">${cancelledCount}</span><span class="sch-stat-lbl">Cancelled</span></div>` : ''}
      </div>
    </div>`;
    }
    let conflictHtml = '';
    if (conflicts.length) {
        conflictHtml = `<div class="sch-conflict-banner glass card-pad mb-2 fade-in" role="alert" aria-live="polite">
      <i class="bi bi-exclamation-triangle-fill sch-conflict-icon" aria-hidden="true"></i>
      <div>
        <div class="sch-conflict-title">Schedule Conflict${conflicts.length > 1 ? 's' : ''}</div>
        ${conflicts.map(c => `<div class="sch-conflict-body">${esc(c.a.code)} (${fmtTime(c.a.start)}–${fmtTime(c.a.end)}) overlaps ${esc(c.b.code)} (${fmtTime(c.b.start)}–${fmtTime(c.b.end)}) by ${c.overlapMins}m</div>`).join('')}
      </div>
    </div>`;
    }
    let timelineHtml = '';
    if (!classes.length) {
        const semesterState = getSemesterEmptyState(_selectedDate);
        timelineHtml = `<div class="glass card-pad sch-empty-day fade-in">
      <i class="bi bi-calendar-x" style="font-size:1.6rem;opacity:.4" aria-hidden="true"></i>
      <div class="mt-2 fw-bold" style="color:var(--text)">${semesterState ? semesterState.title : `No Classes ${isToday ? 'Today' : 'This Day'}`}</div>
      ${semesterState ? (semesterState.detail ? `<div class="text-faint" style="font-size:.85rem">${semesterState.detail}</div>` : '') : `<div class="text-faint" style="font-size:.85rem">You have no scheduled classes for ${DAY_LONG[_selectedDate.getDay()]}.</div>`}
      <button class="btn btn-accent btn-sm mt-3" onclick="openSubjectModal()"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add Subject</button>
    </div>`;
    }
    else {
        const timeline = buildTimeline(classes);
        timelineHtml = `<div class="sch-timeline fade-in" role="list">` + timeline.map((item, idx) => {
            if (item.type === 'free') {
                return `<div class="sch-timeline-free" role="listitem">
          <div class="sch-tl-connector free" aria-hidden="true"></div>
          <div class="sch-free-block">
            <i class="bi bi-cup-hot-fill sch-free-icon" aria-hidden="true"></i>
            FREE TIME · ${fmtDuration(item.mins)}
          </div>
        </div>`;
            }
            const s = item.subject;
            const cancelled = isOccurrenceCancelled(s.id, dateStr);
            const cancelInfo = cancelled ? getCancellationInfo(s.id, dateStr) : null;
            const isNow = !cancelled && isToday && toMins(s.start) <= nm && toMins(s.end) > nm;
            const isPast = isToday && toMins(s.end) <= nm;
            const location = buildLocation(s);
            const tasks = getTasksDueToday(s.id);
            const isLast = idx === timeline.length - 1;
            const elapsed = isNow ? nm - toMins(s.start) : 0;
            const total = toMins(s.end) - toMins(s.start);
            const pct = isNow ? Math.min(100, Math.round((elapsed / total) * 100)) : 0;
            const attRecord = isToday ? getAttendanceRecord(s.id, dateStr) : null;
            const attStatus = attRecord ? attRecord.status : null;
            const isConflict = activeClasses.length && conflicts.some(c => c.a.id === s.id || c.b.id === s.id);
            return `<div class="sch-tl-item ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''} ${cancelled ? 'is-cancelled' : ''}" id="schTl-${s.id}" role="listitem">
        <div class="sch-tl-left" aria-hidden="true">
          <div class="sch-tl-time">${fmtTime(s.start)}</div>
          ${!isLast ? '<div class="sch-tl-line"></div>' : ''}
        </div>
        <div class="sch-tl-card glass ${isConflict && !cancelled ? 'sch-conflict-card' : ''}" style="--sc-color:${s.color}">
          ${isNow ? '<div class="sch-now-badge" aria-label="In session now"><i class="bi bi-broadcast" aria-hidden="true"></i> NOW</div>' : ''}
          ${cancelled ? `<div class="sch-cancelled-badge" aria-label="Cancelled"><i class="bi bi-ban" aria-hidden="true"></i> CANCELLED${cancelInfo && cancelInfo.reason ? ' · ' + esc(cancelInfo.reason) : ''}</div>` : ''}
          <div class="sch-tl-header">
            <div class="sch-tl-dot" style="background:${s.color}" aria-hidden="true"></div>
            <div class="sch-tl-info">
              <div class="sch-tl-title ${cancelled ? 'sch-cancelled-text' : ''}">${esc(s.desc)}</div>
              <div class="sch-tl-code">${esc(s.code)}${s.online ? '<span class="sch-online-chip ms-1"><i class="bi bi-wifi" aria-hidden="true"></i> ONLINE</span>' : ''}</div>
            </div>
            <div class="d-flex gap-1 ms-auto flex-shrink-0">
              ${!cancelled && isToday ? buildAttendanceIconBtn(s.id, dateStr, attStatus) : ''}
              <button class="btn-icon sched-icon-btn" onclick="openCancelModal('${s.id}','${dateStr}')" title="${cancelled ? 'Restore' : 'Cancel'} this class" aria-label="${cancelled ? 'Restore' : 'Cancel'} ${esc(s.code)} on this date"><i class="bi bi-${cancelled ? 'arrow-counterclockwise' : 'calendar-x'}" aria-hidden="true"></i></button>
              <button class="btn-icon sched-icon-btn" onclick="openSubjectModal('${s.id}')" title="Edit" aria-label="Edit ${esc(s.code)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
            </div>
          </div>
          ${!cancelled ? `<div class="sch-tl-meta">
            <span><i class="bi bi-clock" aria-hidden="true"></i>${fmtTime(s.start)} – ${fmtTime(s.end)}</span>
            ${location ? `<span><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(location)}</span>` : ''}
            ${s.online ? `<span><i class="bi bi-wifi" aria-hidden="true"></i>Online class</span>` : ''}
            ${s.professor ? `<span><i class="bi bi-person" aria-hidden="true"></i>${esc(s.professor)}</span>` : ''}
          </div>` : ''}
          ${isNow ? `<div class="sch-tl-now-bar mt-2" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="sch-tl-now-fill" style="width:${pct}%;background:${s.color}"></div></div>` : ''}
          ${tasks.length && !cancelled ? `<div class="sch-tl-tasks" onclick="location.href='tasks.html'" role="button" tabindex="0" aria-label="${tasks.length} task${tasks.length === 1 ? '' : 's'} due today">
            <i class="bi bi-check2-square" aria-hidden="true"></i>
            <span>${tasks.length} task${tasks.length === 1 ? '' : 's'} due today</span>
            <i class="bi bi-arrow-right ms-auto sch-task-arrow" aria-hidden="true"></i>
          </div>` : ''}
        </div>
      </div>`;
        }).join('') + `</div>`;
    }
    host.innerHTML = summaryHtml + conflictHtml + timelineHtml;
}

// Today's tasks panel

function renderTasksPanel() {
    const host = document.getElementById('schTasksPanel');
    if (!sameDay(_selectedDate, new Date())) {
        host.innerHTML = '';
        return;
    }
    const tasks = getAllTasksDueToday();
    host.innerHTML = `<div class="glass card-pad mb-3 fade-in">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <div class="section-title mb-0"><i class="bi bi-check2-square" aria-hidden="true"></i>Today's Tasks</div>
      <a href="tasks.html" class="btn btn-ghost btn-sm" aria-label="View all tasks">View All</a>
    </div>
    ${tasks.length
        ? `<div class="sch-task-list" role="list">${tasks.map(t => `
          <div class="sch-task-row ${t.status === 'completed' ? 'done' : ''}" role="listitem">
            <i class="bi ${t.status === 'completed' ? 'bi-check-circle-fill' : 'bi-circle'} sch-task-icon" aria-hidden="true"></i>
            <span class="sch-task-title">${esc(t.title)}</span>
            ${t.priority === 'high' ? '<span class="chip high" style="font-size:.6rem" aria-label="High priority">!</span>' : ''}
          </div>`).join('')}
        </div>`
        : `<div class="text-faint" style="font-size:.84rem">No tasks due today.</div>`}
  </div>`;
}

// Weekly timetable

function setTtZoom(pct) {
    if (!TT_ZOOM_LEVELS.includes(pct))
        pct = TT_ZOOM_LEVELS.reduce((best, l) => Math.abs(l - pct) < Math.abs(best - pct) ? l : best, 100);
    if (pct === ttZoomPct && ttHourHeight === TT_BASE_HOUR_PX * pct / 100)
        return false;
    ttZoomPct = pct;
    ttHourHeight = TT_BASE_HOUR_PX * pct / 100;
    return true;
}

function updateZoomUI() {
    const badge = document.getElementById('ttZoomBadge');
    if (badge)
        badge.textContent = ttZoomPct + '%';
    const i = TT_ZOOM_LEVELS.indexOf(ttZoomPct);
    const out = document.getElementById('ttZoomOut');
    const inn = document.getElementById('ttZoomIn');
    if (out)
        out.disabled = i <= 0;
    if (inn)
        inn.disabled = i >= TT_ZOOM_LEVELS.length - 1;
}

function ttZoom(dir) {
    const i = TT_ZOOM_LEVELS.indexOf(ttZoomPct);
    const next = TT_ZOOM_LEVELS[Math.max(0, Math.min(TT_ZOOM_LEVELS.length - 1, i + dir))];
    if (setTtZoom(next))
        renderTimetable();
}

function renderTimetable() {
    updateZoomUI();
    const wrap = document.getElementById('ttGrid');
    const semId = DB.getActiveSemesterId();
    const allSubs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const startHour = 6, endHour = 21;
    const today = new Date();
    const nm = nowMins();
    const ws = weekStart(_selectedDate);
    const weekDays = [0, 1, 2, 3, 4, 5, 6].map(i => dateAddDays(ws, i));
    const conflictIds = detectAllWeekConflicts();
    const selectedDayName = DAY_SHORT[_selectedDate.getDay()];
    if (!allSubs.length) {
        wrap.innerHTML = `<div class="sch-empty-day" style="min-height:200px">
      <i class="bi bi-calendar2-week" style="font-size:1.6rem;opacity:.4" aria-hidden="true"></i>
      <div class="mt-2 fw-bold" style="color:var(--text)">No Classes Scheduled</div>
      <div class="text-faint" style="font-size:.85rem">Add subjects to see your weekly timetable.</div>
    </div>`;
        return;
    }
    let html = `<div class="tt-grid-inner" style="display:grid;grid-template-columns:48px repeat(7,minmax(0,1fr));position:relative">`;
    html += `<div class="tt-corner"></div>`;
    weekDays.forEach(d => {
        const isToday = sameDay(d, today);
        const isSel = sameDay(d, _selectedDate);
        const dayN = DAY_SHORT[d.getDay()];
        const inSemester = isDateInSemester(d);
        html += `<div class="tt-head ${isToday ? 'tt-head-today' : ''} ${isSel ? 'tt-head-selected' : ''}" style="${inSemester ? '' : 'opacity:.45'}" aria-label="${DAY_LONG[d.getDay()]} ${d.getDate()}${inSemester ? '' : ', outside semester'}">${dayN}<span class="tt-head-date ${isToday ? 'tt-head-date-today' : ''} ${isSel ? 'tt-head-date-selected' : ''}">${d.getDate()}</span></div>`;
    });
    html += `<div class="tt-hour-col">`;
    for (let h = startHour; h <= endHour; h++) {
        html += `<div class="tt-cell tt-hour" style="height:${ttHourHeight}px">${fmtTime(String(h).padStart(2, '0') + ':00')}</div>`;
    }
    html += `</div>`;
    weekDays.forEach(d => {
        const dateStr = isoDate(d);
        const dayName = DAY_SHORT[d.getDay()];
        const isToday = sameDay(d, today);
        const isSel = sameDay(d, _selectedDate);
        const inSemester = isDateInSemester(d);
        const dayClasses = inSemester ? allSubs.filter(s => s.days && s.days.includes(dayName)) : [];
        const overlapMap = computeOverlaps(dayClasses);
        html += `<div class="tt-col ${isToday ? 'tt-col-today' : ''} ${isSel ? 'tt-col-selected' : ''}" style="position:relative;${inSemester ? '' : 'opacity:.45'}" aria-label="${dayName} classes${inSemester ? '' : ', outside semester'}">`;
        for (let h = startHour; h <= endHour; h++) {
            html += `<div class="tt-cell" style="height:${ttHourHeight}px"></div>`;
        }
        dayClasses.forEach(s => {
            const cancelled = isOccurrenceCancelled(s.id, dateStr);
            const sh = toMins(s.start) / 60, eh = toMins(s.end) / 60;
            const top = (sh - startHour) * ttHourHeight;
            const height = Math.max(2, (eh - sh) * ttHourHeight);
            const { col, cols } = overlapMap.get(s.id) || { col: 0, cols: 1 };
            const wpct = 100 / cols;
            const isNowClass = isToday && !cancelled && toMins(s.start) <= nm && toMins(s.end) > nm;
            const hasConflict = conflictIds.has(s.id);
            const locationShort = s.room ? `R${s.room}` : (s.online ? '🌐' : '');
            html += `<div class="tt-block ${isNowClass ? 'tt-block-now' : ''} ${cancelled ? 'tt-block-cancelled' : ''} ${hasConflict && !cancelled ? 'tt-block-conflict' : ''}"
        title="${esc(s.code)}: ${esc(s.desc)}${locationShort ? ' · ' + locationShort : ''}"
        style="top:${top}px;height:${height}px;left:calc(${col * wpct}% + 2px);width:calc(${wpct}% - 4px);background:${cancelled ? 'var(--surface-alt)' : s.color};opacity:${cancelled ? 0.5 : isNowClass ? 1 : .88}"
        onclick="showTimetablePopup('${s.id}','${dateStr}')"
        role="button" tabindex="0" aria-label="${esc(s.code)} ${fmtTime(s.start)}${cancelled ? ' Cancelled' : ''}">
        <div class="tt-block-code" style="text-decoration:${cancelled ? 'line-through' : 'none'}">${esc(s.code)}</div>
        ${height > 34 ? `<div class="tt-block-time">${fmtTime(s.start)}</div>` : ''}
        ${height > 54 && s.room ? `<div class="tt-block-room">${esc(s.room)}</div>` : ''}
        ${cancelled && height > 30 ? '<div class="tt-block-cancelled-label">CANCELLED</div>' : ''}
        ${hasConflict && !cancelled ? '<div class="tt-conflict-dot" aria-label="Has conflict" title="Schedule conflict"></div>' : ''}
      </div>`;
        });
        if (isToday) {
            const nowH = nowMins() / 60;
            if (nowH >= startHour && nowH <= endHour) {
                html += `<div class="tt-now-line" style="top:${(nowH - startHour) * ttHourHeight}px" aria-label="Current time indicator"></div>`;
            }
        }
        html += `</div>`;
    });
    html += `</div>`;
    wrap.innerHTML = html;
}

// Timetable popup (info only, no action buttons)

function showTimetablePopup(subjectId, dateStr) {
    const s = DB.getSubject(subjectId);
    if (!s)
        return;
    const location = buildLocation(s);
    const cancelled = isOccurrenceCancelled(subjectId, dateStr);
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const displayDate = `${months[+m - 1]} ${+d}, ${y}`;
    ensureTimetablePopupModal();
    const body = document.getElementById('ttPopupBody');
    body.innerHTML = `
    <div class="modal-header" style="border:none;padding-bottom:6px;padding-top:14px">
      <div class="d-flex align-items-center gap-2 flex-wrap" style="flex:1;min-width:0">
        <span style="width:9px;height:9px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0" aria-hidden="true"></span>
        <span class="fw-bold" style="font-size:.82rem;font-family:var(--font-mono);color:var(--text-faint)">${esc(s.code)}</span>
        ${s.online ? '<span class="sch-online-chip"><i class="bi bi-wifi" aria-hidden="true"></i> ONLINE</span>' : ''}
        ${cancelled ? '<span class="sch-cancelled-chip"><i class="bi bi-ban" aria-hidden="true"></i> CANCELLED</span>' : ''}
      </div>
      <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </div>
    <div style="padding:0 1rem 1rem">
      <div class="sch-tt-popup-name">${esc(s.desc)}</div>
      <div class="sch-tt-popup-rows">
        <div class="sch-tt-popup-row">
          <i class="bi bi-clock" aria-hidden="true"></i>
          <span>${fmtTime(s.start)} – ${fmtTime(s.end)}</span>
        </div>
        ${location ? `<div class="sch-tt-popup-row">
          <i class="bi bi-geo-alt" aria-hidden="true"></i>
          <span>${esc(location)}</span>
        </div>` : ''}
        ${s.online ? `<div class="sch-tt-popup-row">
          <i class="bi bi-wifi" aria-hidden="true"></i>
          <span>Online class</span>
        </div>` : ''}
        ${s.professor ? `<div class="sch-tt-popup-row">
          <i class="bi bi-person" aria-hidden="true"></i>
          <span>${esc(s.professor)}${s.email ? ' · ' + esc(s.email) : ''}</span>
        </div>` : ''}
        ${s.section ? `<div class="sch-tt-popup-row">
          <i class="bi bi-people" aria-hidden="true"></i>
          <span>${esc(s.section)} · ${s.units} units · ${s.type}</span>
        </div>` : ''}
        ${s.notes ? `<div class="sch-tt-popup-row">
          <i class="bi bi-sticky" aria-hidden="true"></i>
          <span>${esc(s.notes)}</span>
        </div>` : ''}
      </div>
    </div>`;
    new bootstrap.Modal(document.getElementById('ttPopupModal')).show();
}

function ensureTimetablePopupModal() {
    if (document.getElementById('ttPopupModal'))
        return;
    const el = document.createElement('div');
    el.innerHTML = `<div class="modal fade" id="ttPopupModal" tabindex="-1" aria-modal="true" role="dialog">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad sch-tt-popup-modal" id="ttPopupBody"></div>
    </div>
  </div>`;
    document.body.appendChild(el.firstElementChild);
}

function computeOverlaps(classes) {
    const map = new Map();
    const sorted = [...classes].sort((a, b) => a.start.localeCompare(b.start));
    const active = [];
    sorted.forEach(s => {
        for (let i = active.length - 1; i >= 0; i--) {
            if (active[i].end <= s.start)
                active.splice(i, 1);
        }
        let col = 0;
        const usedCols = active.map(a => map.get(a.id).col);
        while (usedCols.includes(col))
            col++;
        active.push(s);
        map.set(s.id, { col });
    });
    sorted.forEach(s => {
        const overlapping = sorted.filter(o => o.start < s.end && o.end > s.start);
        const cols = Math.max(...overlapping.map(o => map.get(o.id).col)) + 1;
        map.set(s.id, { col: map.get(s.id).col, cols });
    });
    return map;
}

// Subject list view (improved)

function renderListView() {
    const wrap = document.getElementById('schSubjectList');
    if (wrap) wrap.removeAttribute('aria-busy');
    const q = (document.getElementById('schSearchInput')?.value || '').toLowerCase().trim();
    const semId = DB.getActiveSemesterId();
    let list = DB.getSubjects().filter(s => {
        if (s.semesterId !== semId)
            return false;
        if (!showArchived && s.archived)
            return false;
        return true;
    }).sort((a, b) => a.start.localeCompare(b.start));
    if (q)
        list = list.filter(s => s.code.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) ||
            s.professor.toLowerCase().includes(q) || s.room.toLowerCase().includes(q));
    const sem = DB.getActiveSemester();
    if (!list.length) {
        wrap.innerHTML = `<div class="col-12"><div class="glass card-pad text-center py-4">
      <i class="bi bi-journal-x" style="font-size:1.5rem;opacity:.4" aria-hidden="true"></i>
      <div class="mt-2 text-faint">${sem ? `No subjects for ${sem.schoolYear} · ${sem.name}` : 'No subjects found'}</div>
      ${!showArchived ? `<button class="btn btn-accent btn-sm mt-3" onclick="openSubjectModal()"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add Subject</button>` : ''}
    </div></div>`;
        return;
    }
    wrap.innerHTML = list.map(s => {
        const gradeAvg = getSubjectGradeAvg(s.id);
        const attRate = getSubjectAttendanceRate(s.id);
        const location = buildLocation(s);
        const locationLine = s.online
            ? `<span class="sch-online-chip"><i class="bi bi-wifi" aria-hidden="true"></i> ONLINE</span>`
            : (location ? `<span><i class="bi bi-geo-alt" aria-hidden="true"></i>${esc(location)}</span>` : '');
        return `<div class="col-md-6 col-xl-4">
      <div class="glass subject-card hover-lift ${s.archived ? 'subject-card-archived' : ''}" style="--sc-color:${s.color}">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="sched-dot" style="background:${s.color}" aria-hidden="true"></span>
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-items-center gap-1 flex-wrap">
              <span class="fw-bold" style="font-size:.85rem">${esc(s.code)}</span>
              ${s.type === 'Laboratory' ? '<span class="chip" style="font-size:.58rem;padding:1px 5px">LAB</span>' : ''}
              ${s.archived ? '<span class="chip" style="font-size:.58rem">Archived</span>' : ''}
            </div>
            <div class="text-soft" style="font-size:.78rem;line-height:1.3;overflow-wrap:anywhere">${esc(s.desc)}</div>
          </div>
          <div class="d-flex gap-1 flex-shrink-0">
            <button class="btn-icon sched-icon-btn" onclick="openSubjectModal('${s.id}')" title="Edit" aria-label="Edit ${esc(s.code)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
            <button class="btn-icon sched-icon-btn" onclick="deleteSubject('${s.id}')" title="Delete" aria-label="Delete ${esc(s.code)}"><i class="bi bi-trash" aria-hidden="true"></i></button>
          </div>
        </div>

        <div class="sched-meta mb-2">
          <span><i class="bi bi-clock" aria-hidden="true"></i>${s.days.join(', ')} · ${fmtTime(s.start)}–${fmtTime(s.end)}</span>
          ${locationLine}
          ${s.professor ? `<span><i class="bi bi-person" aria-hidden="true"></i>${esc(s.professor)}</span>` : ''}
        </div>

        <div class="sch-subject-stats">
          <div class="sch-subject-stat">
            <span class="sch-subject-stat-lbl">Grade</span>
            <span class="sch-subject-stat-val ${gradeAvg !== null && gradeAvg >= 75 ? 'stat-good' : gradeAvg !== null && gradeAvg < 75 ? 'stat-bad' : ''}">${gradeAvg !== null ? gradeAvg.toFixed(1) + '%' : '—'}</span>
          </div>
          <div class="sch-subject-stat-div" aria-hidden="true"></div>
          <div class="sch-subject-stat">
            <span class="sch-subject-stat-lbl">Attendance</span>
            <span class="sch-subject-stat-val ${attRate !== null && attRate >= 75 ? 'stat-good' : attRate !== null && attRate < 75 ? 'stat-bad' : ''}">${attRate !== null ? attRate + '%' : '—'}</span>
          </div>
          <div class="sch-subject-stat-div" aria-hidden="true"></div>
          <div class="sch-subject-stat">
            <span class="sch-subject-stat-lbl">Units</span>
            <span class="sch-subject-stat-val">${s.units}</span>
          </div>
        </div>

        <div class="d-flex gap-1 mt-2 pt-2" style="border-top:1px solid var(--border)">
          <button class="btn btn-ghost btn-sm sched-action-btn flex-grow-1" onclick="openAttendanceForSubject('${s.id}')" aria-label="Log attendance for ${esc(s.code)}"><i class="bi bi-person-check me-1" aria-hidden="true"></i>Attendance</button>
          <button class="btn btn-ghost btn-sm sched-action-btn flex-grow-1" onclick="archiveSubject('${s.id}')" aria-label="${s.archived ? 'Restore' : 'Archive'} ${esc(s.code)}"><i class="bi bi-archive me-1" aria-hidden="true"></i>${s.archived ? 'Restore' : 'Archive'}</button>
          <button class="btn btn-ghost btn-sm sched-action-btn" onclick="duplicateSubject('${s.id}')" aria-label="Duplicate ${esc(s.code)}" title="Duplicate"><i class="bi bi-copy" aria-hidden="true"></i></button>
        </div>
      </div>
    </div>`;
    }).join('');
}

// Attendance from Subject list view

function openAttendanceForSubject(subjectId) {
    const s = DB.getSubject(subjectId);
    if (!s)
        return;
    const today = isoDate(new Date());
    const todayDayName = DAY_SHORT[new Date().getDay()];
    const isClassDay = s.days && s.days.includes(todayDayName);
    if (isClassDay && isOccurrenceCancelled(subjectId, today)) {
        Toast.show("Today's class was cancelled — attendance not applicable", 'high', 'bi-ban');
        return;
    }
    openQuickAttModal(subjectId, today);
}

function toggleArchivedView() {
    showArchived = !showArchived;
    document.getElementById('schArchiveBtn')?.classList.toggle('active', showArchived);
    renderListView();
}

// Subject detail modal (timetable card popup replacement kept separate)

function showSubjectDetail(id) {
    const s = DB.getSubject(id);
    if (!s)
        return;
    const location = buildLocation(s);
    const gradeAvg = getSubjectGradeAvg(s.id);
    const attRate = getSubjectAttendanceRate(s.id);
    const body = document.getElementById('detailModalBody');
    body.innerHTML = `
    <div class="modal-header" style="border:none;padding-bottom:8px">
      <div class="d-flex align-items-center gap-2">
        <span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block;flex-shrink:0" aria-hidden="true"></span>
        <h5 class="modal-title mb-0">${esc(s.code)}</h5>
        ${s.online ? '<span class="sch-online-chip"><i class="bi bi-wifi" aria-hidden="true"></i> ONLINE</span>' : ''}
      </div>
      <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
    </div>
    <p class="text-soft mb-3" style="font-size:.88rem">${esc(s.desc)}</p>
    <div class="d-flex flex-column gap-2 mb-3" style="font-size:.83rem">
      <div class="d-flex gap-2"><i class="bi bi-clock text-faint" aria-hidden="true"></i><span>${s.days.join(', ')} · ${fmtTime(s.start)}–${fmtTime(s.end)}</span></div>
      ${location ? `<div class="d-flex gap-2"><i class="bi bi-geo-alt text-faint" aria-hidden="true"></i><span>${esc(location)}</span></div>` : ''}
      ${s.online ? `<div class="d-flex gap-2"><i class="bi bi-wifi text-faint" aria-hidden="true"></i><span>Online class</span></div>` : ''}
      ${s.professor ? `<div class="d-flex gap-2"><i class="bi bi-person text-faint" aria-hidden="true"></i><span>${esc(s.professor)}${s.email ? ' · ' + esc(s.email) : ''}</span></div>` : ''}
      <div class="d-flex gap-2"><i class="bi bi-mortarboard text-faint" aria-hidden="true"></i><span>${s.units} units · ${s.type} · ${s.section}</span></div>
      ${s.notes ? `<div class="d-flex gap-2"><i class="bi bi-sticky text-faint" aria-hidden="true"></i><span>${esc(s.notes)}</span></div>` : ''}
    </div>
    <div class="sch-subject-stats mb-3">
      <div class="sch-subject-stat">
        <span class="sch-subject-stat-lbl">Grade</span>
        <span class="sch-subject-stat-val ${gradeAvg !== null && gradeAvg >= 75 ? 'stat-good' : gradeAvg !== null && gradeAvg < 75 ? 'stat-bad' : ''}">${gradeAvg !== null ? gradeAvg.toFixed(1) + '%' : 'Not available'}</span>
      </div>
      <div class="sch-subject-stat-div" aria-hidden="true"></div>
      <div class="sch-subject-stat">
        <span class="sch-subject-stat-lbl">Attendance</span>
        <span class="sch-subject-stat-val ${attRate !== null && attRate >= 75 ? 'stat-good' : attRate !== null && attRate < 75 ? 'stat-bad' : ''}">${attRate !== null ? attRate + '%' : 'No records'}</span>
      </div>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-accent flex-grow-1 btn-sm" onclick="bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();openSubjectModal('${s.id}')"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit</button>
      <button class="btn btn-ghost btn-sm" onclick="bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();openCancelModal('${s.id}','${isoDate(new Date())}')" aria-label="Cancel today's occurrence"><i class="bi bi-calendar-x me-1" aria-hidden="true"></i>Cancel Today</button>
    </div>`;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

const TIME_MENU_FIRST = 5 * 60;
const TIME_MENU_LAST = 23 * 60 + 45;
const TIME_MENU_STEP = 15;
const TIME_ORDER_MSG = 'End time must be later than start time';
const _timeAssumed = { Start: false, End: false };
const _timeActive = { Start: null, End: null };
const _timeNavigated = { Start: false, End: false };

function timeValueToMins(v) {
    const m = /^(\d{2}):(\d{2})/.exec(v || '');
    return m ? (+m[1]) * 60 + (+m[2]) : null;
}

function formatTime12(v) {
    const mins = timeValueToMins(v);
    if (mins == null)
        return '';
    const h = Math.floor(mins / 60), mi = mins % 60;
    return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatClassLength(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

// Returns { empty } | { error } | { value:'HH:MM', assumed:boolean }
function parseTimeText(raw, afterMins) {
    let s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s)
        return { empty: true };
    if (s === 'noon')
        return { value: '12:00' };
    const unreadable = { error: "Couldn't read that time. Try 9:30 AM or 14:30, or pick from the list." };
    let mer = null;
    const mm = s.match(/\s*([ap])\.?\s*m?\.?\s*$/);
    if (mm) {
        mer = mm[1] === 'a' ? 'am' : 'pm';
        s = s.slice(0, mm.index).trim();
    }
    let hStr, miStr, m;
    if ((m = s.match(/^(\d{1,2})\s*[:.h]\s*(\d{2})$/)) || (m = s.match(/^(\d{1,2})\s+(\d{2})$/))) {
        hStr = m[1];
        miStr = m[2];
    }
    else if ((m = s.match(/^(\d{3,4})$/))) {
        hStr = m[1].slice(0, -2);
        miStr = m[1].slice(-2);
    }
    else if ((m = s.match(/^(\d{1,2})$/))) {
        hStr = m[1];
        miStr = '00';
    }
    else
        return unreadable;

    let h = +hStr;
    const mi = +miStr;
    if (mi > 59)
        return { error: 'Minutes must be between 00 and 59. Or pick from the list.' };
    let assumed = false;
    if (mer) {
        if (h >= 13 && h <= 23) { /* 24-hour hour typed with a stray am/pm: trust the 24-hour hour */ }
        else if (h < 1 || h > 12)
            return { error: 'With AM/PM, use an hour from 1 to 12.' };
        else if (mer === 'am')
            h = h === 12 ? 0 : h;
        else
            h = h === 12 ? 12 : h + 12;
    }
    else {
        if (h > 23)
            return { error: 'Hours go from 0 to 23 (or 1 to 12 with AM/PM).' };
        const explicit24 = h === 0 || h >= 13 || (hStr.length === 2 && hStr[0] === '0');
        if (!explicit24) {
            assumed = true;
            if (h >= 1 && h <= 6)
                h += 12;
        }
    }
    let mins = h * 60 + mi;
    if (assumed && afterMins != null && mins <= afterMins && mins + 720 > afterMins && mins + 720 < 1440)
        mins += 720;
    return { value: fromMins(mins), assumed };
}

function buildTimeFieldHtml(key, label, value, placeholder) {
    const v = timeValueToMins(value) != null ? String(value).slice(0, 5) : '';
    return `<div class="sch-time-col">
      <label class="form-label" style="font-size:.82rem" for="sub${key}Text">${label} <span class="sch-subject-required" aria-hidden="true">*</span></label>
      <div class="sch-time-field" data-time-key="${key}">
        <input type="text" class="form-control sch-time-input" id="sub${key}Text" value="${v ? formatTime12(v) : ''}" placeholder="${placeholder}" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="sub${key}Menu" aria-invalid="false" aria-describedby="sub${key}Error">
        <button type="button" class="sch-time-btn" id="sub${key}Btn" aria-label="Pick ${label.toLowerCase()} from list" aria-haspopup="listbox"><i class="bi bi-clock" aria-hidden="true"></i></button>
        <input type="hidden" id="sub${key}" value="${v}">
        <div class="sch-time-menu" id="sub${key}Menu" role="listbox" aria-label="${label} options" hidden></div>
      </div>
      <p class="sch-subject-error" id="sub${key}Error" hidden></p>
    </div>`;
}

function timeEls(key) {
    return {
        field: document.querySelector(`.sch-time-field[data-time-key="${key}"]`),
        text: document.getElementById(`sub${key}Text`),
        hidden: document.getElementById(`sub${key}`),
        btn: document.getElementById(`sub${key}Btn`),
        menu: document.getElementById(`sub${key}Menu`),
        err: document.getElementById(`sub${key}Error`)
    };
}

function setTimeError(key, msg) {
    const el = timeEls(key);
    el.err.textContent = msg || '';
    el.err.hidden = !msg;
    el.text.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.field.classList.toggle('has-error', !!msg);
}

function validateTimeOrder() {
    const s = timeValueToMins(document.getElementById('subStart').value);
    const e = timeValueToMins(document.getElementById('subEnd').value);
    const endEl = timeEls('End');
    if (s != null && e != null)
        setTimeError('End', e <= s ? TIME_ORDER_MSG : '');
    else if (endEl.err.textContent === TIME_ORDER_MSG)
        setTimeError('End', '');
}

function refreshTimeHint() {
    const hint = document.getElementById('subTimeHint');
    if (!hint)
        return;
    const s = timeValueToMins(document.getElementById('subStart').value);
    const e = timeValueToMins(document.getElementById('subEnd').value);
    const notes = [];
    ['Start', 'End'].forEach(k => {
        const v = document.getElementById('sub' + k).value;
        if (_timeAssumed[k] && v)
            notes.push(`${k} read as ${formatTime12(v)}. Add "am" or "pm" to change.`);
    });
    const parts = [];
    if (s != null && e != null && e > s)
        parts.push(`<i class="bi bi-hourglass-split" aria-hidden="true"></i> ${formatClassLength(e - s)}`);
    if (notes.length)
        parts.push(notes.join(' '));
    hint.innerHTML = parts.length
        ? parts.join(' · ')
        : 'Type a time (9:30 AM, 930, 14:30) or tap the clock to pick.';
}

// Parse whatever is typed, write the clean text + the canonical HH:MM hidden value.
function commitTimeField(key) {
    const el = timeEls(key);
    if (!el.text)
        return;
    const attempted = document.getElementById('subjectModal').dataset.timeValidationAttempted === 'true';
    const raw = el.text.value;
    if (!raw.trim()) {
        el.hidden.value = '';
        _timeAssumed[key] = false;
        setTimeError(key, attempted ? `${key} time is required` : '');
    }
    else {
        const after = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
        const r = parseTimeText(raw, after);
        if (r.error) {
            el.hidden.value = '';
            _timeAssumed[key] = false;
            setTimeError(key, r.error);
        }
        else {
            el.hidden.value = r.value;
            el.text.value = formatTime12(r.value);
            _timeAssumed[key] = !!r.assumed;
            setTimeError(key, '');
        }
    }
    validateTimeOrder();
    refreshTimeHint();
}

function setTimeValue(key, value) {
    const el = timeEls(key);
    el.hidden.value = value;
    el.text.value = formatTime12(value);
    _timeAssumed[key] = false;
    setTimeError(key, '');
    validateTimeOrder();
    refreshTimeHint();
}

function setActiveTimeOption(key, opt, center) {
    const el = timeEls(key);
    if (_timeActive[key])
        _timeActive[key].classList.remove('is-active');
    _timeActive[key] = opt;
    if (!opt) {
        el.text.removeAttribute('aria-activedescendant');
        return;
    }
    opt.classList.add('is-active');
    el.text.setAttribute('aria-activedescendant', opt.id);
    const menu = el.menu;
    const top = opt.offsetTop, h = menu.clientHeight;
    if (center)
        menu.scrollTop = top - h / 2 + opt.offsetHeight / 2;
    else if (top < menu.scrollTop)
        menu.scrollTop = top;
    else if (top + opt.offsetHeight > menu.scrollTop + h)
        menu.scrollTop = top + opt.offsetHeight - h;
}

function openTimeMenu(key) {
    closeAllTimeMenus(key);
    const el = timeEls(key);
    if (!el.menu.hidden)
        return;
    const current = el.hidden.value;
    const startMins = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
    const first = startMins != null ? (Math.floor(startMins / TIME_MENU_STEP) + 1) * TIME_MENU_STEP : TIME_MENU_FIRST;
    const times = [];
    for (let m = first; m <= TIME_MENU_LAST; m += TIME_MENU_STEP)
        times.push(m);
    const curMins = timeValueToMins(current);
    if (curMins != null && !times.includes(curMins) && (startMins == null || curMins > startMins)) {
        times.push(curMins);
        times.sort((a, b) => a - b);
    }
    if (!times.length)
        return;
    el.menu.innerHTML = times.map(m => {
        const v = fromMins(m);
        const dur = startMins != null ? `<span class="sch-time-opt-dur">${formatClassLength(m - startMins)}</span>` : '';
        return `<div class="sch-time-opt" role="option" id="sub${key}Opt-${v.replace(':', '')}" data-value="${v}" aria-selected="${v === current}">${formatTime12(v)}${dur}</div>`;
    }).join('');
    el.menu.hidden = false;
    el.text.setAttribute('aria-expanded', 'true');
    _timeNavigated[key] = false;

    el.menu.classList.remove('is-up');
    const fr = el.field.getBoundingClientRect();
    const br = (el.field.closest('.modal-body') || document.body).getBoundingClientRect();
    const below = Math.min(br.bottom, window.innerHeight) - fr.bottom;
    const above = fr.top - Math.max(br.top, 0);
    el.menu.classList.toggle('is-up', below < 240 && above > below);

    const target = curMins != null && times.includes(curMins) ? curMins
        : (startMins != null ? startMins + 90 : 8 * 60);
    const nearest = times.reduce((b, m) => Math.abs(m - target) < Math.abs(b - target) ? m : b, times[0]);
    setActiveTimeOption(key, el.menu.querySelector(`[data-value="${fromMins(nearest)}"]`), true);
}

function closeTimeMenu(key) {
    const el = timeEls(key);
    if (!el.menu)
        return;
    el.menu.hidden = true;
    el.text.setAttribute('aria-expanded', 'false');
    el.text.removeAttribute('aria-activedescendant');
    _timeActive[key] = null;
}

function closeAllTimeMenus(exceptKey) {
    ['Start', 'End'].forEach(k => {
        if (k !== exceptKey && document.getElementById(`sub${k}Menu`))
            closeTimeMenu(k);
    });
}

function initSubjectTimeFields() {
    _timeAssumed.Start = _timeAssumed.End = false;
    ['Start', 'End'].forEach(key => {
        const el = timeEls(key);
        el.text.addEventListener('focus', () => setTimeout(() => el.text.select(), 0));
        el.text.addEventListener('input', () => {
            setTimeError(key, '');
            _timeNavigated[key] = false;
            if (!el.menu.hidden) {
                const after = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
                const r = parseTimeText(el.text.value, after);
                const opt = r.value && el.menu.querySelector(`[data-value="${r.value}"]`);
                if (opt)
                    setActiveTimeOption(key, opt, true);
            }
        });
        el.text.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (el.menu.hidden) {
                    commitTimeField(key);
                    openTimeMenu(key);
                    return;
                }
                const opts = [...el.menu.querySelectorAll('.sch-time-opt')];
                const idx = opts.indexOf(_timeActive[key]);
                const next = Math.max(0, Math.min(opts.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
                _timeNavigated[key] = true;
                setActiveTimeOption(key, opts[next], false);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!el.menu.hidden && _timeNavigated[key] && _timeActive[key])
                    setTimeValue(key, _timeActive[key].dataset.value);
                else
                    commitTimeField(key);
                closeTimeMenu(key);
                if (window.matchMedia('(hover: none)').matches)
                    el.text.blur();
            }
            else if (e.key === 'Escape' && !el.menu.hidden) {
                e.stopPropagation();
                closeTimeMenu(key);
            }
        });
        el.field.addEventListener('focusout', e => {
            if (!el.field.contains(e.relatedTarget)) {
                commitTimeField(key);
                closeTimeMenu(key);
            }
        });
        el.btn.addEventListener('click', () => {
            if (!el.menu.hidden) {
                closeTimeMenu(key);
                return;
            }
            commitTimeField(key);
            openTimeMenu(key);
        });
        el.menu.addEventListener('mousedown', e => e.preventDefault());
        el.menu.addEventListener('click', e => {
            const opt = e.target.closest('.sch-time-opt');
            if (!opt)
                return;
            setTimeValue(key, opt.dataset.value);
            closeTimeMenu(key);
        });
    });
    if (!window._schTimeGlobalBound) {
        window._schTimeGlobalBound = true;
        document.addEventListener('pointerdown', e => {
            if (!e.target.closest('.sch-time-field') && document.getElementById('subStartMenu'))
                closeAllTimeMenus();
        });
    }
}

// CRUD

function updateSubjectTimeValidation() {
    commitTimeField('Start');
    commitTimeField('End');
    const bad = k => {
        const el = timeEls(k);
        return !el.hidden.value || !el.err.hidden;
    };
    return { startInvalid: bad('Start'), endInvalid: bad('End') };
}

function openSubjectModal(id) {
    const s = id ? DB.getSubject(id) : null;
    document.getElementById('subjectModalTitle').textContent = s ? 'Edit Subject' : 'Add Subject';
    const sem = DB.getActiveSemester();
    const body = document.getElementById('subjectModalBody');
    const days = s ? s.days : [];
    const isOnline = s ? !!s.online : false;
    body.innerHTML = `
    <input type="hidden" id="subId" value="${s ? s.id : ''}">
    <div class="row g-2">
      <div class="col-5"><label class="form-label" style="font-size:.82rem">Subject Code <span class="sch-subject-required" aria-hidden="true">*</span></label><input class="form-control sch-subject-code" id="subCode" value="${s ? esc(s.code) : ''}" placeholder="CS101" aria-label="Subject Code" aria-invalid="false" aria-describedby="subCodeError"><p class="sch-subject-error" id="subCodeError" hidden>Subject code is required</p></div>
      <div class="col-7"><label class="form-label" style="font-size:.82rem">Description</label><input class="form-control" id="subDesc" value="${s ? esc(s.desc) : ''}" placeholder="Introduction to Computing" aria-label="Subject Description"></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Type</label>
        <select class="form-select" id="subType" aria-label="Subject Type">${['Lecture', 'Laboratory', 'Seminar', 'Hybrid'].map(t => `<option ${s && s.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Units</label><input type="number" step="0.5" class="form-control" id="subUnits" value="${s ? s.units : 3}" aria-label="Units"></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Section</label><input class="form-control" id="subSection" value="${s ? esc(s.section) : ''}" placeholder="BSCS-1A" aria-label="Section"></div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Days <span class="sch-subject-required" aria-hidden="true">*</span></label>
        <div class="sch-subject-days" id="subDaysGroup" role="group" aria-label="Select class days" aria-describedby="subDaysError" aria-invalid="false">
        <div class="day-selector">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `
            <label class="day-chip">
              <input class="day-check" type="checkbox" value="${d}" id="day_${d}" ${days.includes(d) ? 'checked' : ''}>
              <span>${d}</span>
            </label>`).join('')}
        </div>
        </div>
        <p class="sch-subject-error" id="subDaysError" hidden>Select at least one day</p>
      </div>
        <div class="col-12">
        <div class="sch-time-row">
          ${buildTimeFieldHtml('Start', 'Start time', s ? s.start : '', '9:00 AM')}
          ${buildTimeFieldHtml('End', 'End time', s ? s.end : '', '10:30 AM')}
        </div>
        <p class="sch-time-hint" id="subTimeHint" aria-live="polite"></p>
      </div>
        <div class="form-check form-switch mb-1">
          <input class="form-check-input" type="checkbox" id="subOnline" ${isOnline ? 'checked' : ''} aria-label="Online class">
          <label class="form-check-label" for="subOnline" style="font-size:.82rem"><i class="bi bi-wifi me-1" aria-hidden="true"></i>Online Class</label>
        </div>
      </div>
      <div class="col-4 sub-physical-field"><label class="form-label" style="font-size:.82rem">Room</label><input class="form-control" id="subRoom" value="${s && !s.online ? esc(s.room) : ''}" placeholder="302" aria-label="Room number"></div>
      <div class="col-8 sub-physical-field"><label class="form-label" style="font-size:.82rem">Building</label><input class="form-control" id="subBuilding" value="${s && !s.online ? esc(s.building) : ''}" placeholder="Engineering Building" aria-label="Building name"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Professor</label><input class="form-control" id="subProf" value="${s ? esc(s.professor) : ''}" aria-label="Professor"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Email</label><input type="email" class="form-control" id="subEmail" value="${s ? esc(s.email) : ''}" aria-label="Professor email"></div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Color Label</label>
        <div class="color-swatch-group" id="colorPicker" role="radiogroup" aria-label="Select subject color">
          ${DB.colors.map(c => `<button type="button" onclick="selectColor('${c}')" data-color="${c}" class="color-swatch-btn${(s ? s.color : DB.colors[0]) === c ? ' is-selected' : ''}" role="radio" aria-label="Color ${c}" aria-checked="${(s ? s.color : DB.colors[0]) === c}" style="background:${c}"></button>`).join('')}
        </div>
        <input type="hidden" id="subColor" value="${s ? s.color : DB.colors[0]}">
      </div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Notes</label><textarea class="form-control" id="subNotes" rows="2" aria-label="Notes">${s ? esc(s.notes) : ''}</textarea></div>
    </div>
    <div id="subConflictWarning" class="sch-conflict-warning d-none" role="alert"></div>
    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-accent flex-grow-1" onclick="saveSubject()"><i class="bi bi-check2 me-1" aria-hidden="true"></i>${s ? 'Update' : 'Save'} Subject</button>
      ${s ? `<button class="btn btn-ghost" onclick="deleteSubject('${s.id}')" aria-label="Delete subject"><i class="bi bi-trash3" aria-hidden="true"></i></button>` : ''}
    </div>`;
    const onlineCheck = body.querySelector('#subOnline');
    function togglePhysical() {
        const isOn = onlineCheck.checked;
        body.querySelectorAll('.sub-physical-field').forEach(el => el.classList.toggle('d-none', isOn));
    }
    togglePhysical();
    onlineCheck.addEventListener('change', togglePhysical);
    const codeInput = body.querySelector('#subCode');
    const codeError = body.querySelector('#subCodeError');
    const daysGroup = body.querySelector('#subDaysGroup');
    const daysError = body.querySelector('#subDaysError');
    codeInput.addEventListener('input', () => {
      if (codeInput.value.trim()) {
        codeInput.setAttribute('aria-invalid', 'false');
        codeError.hidden = true;
      }
    });
    daysGroup.addEventListener('change', () => {
      if (daysGroup.querySelector('.day-check:checked')) {
        daysGroup.classList.remove('has-error');
        daysGroup.setAttribute('aria-invalid', 'false');
        daysError.hidden = true;
      }
    });

    const subjectModal = document.getElementById('subjectModal');
    subjectModal.dataset.timeValidationAttempted = 'false';
    initSubjectTimeFields();
    refreshTimeHint();
    subjectModal.addEventListener('hidden.bs.modal', () => {
      closeAllTimeMenus();
      subjectModal.dataset.timeValidationAttempted = 'false';
    }, { once: true });
    new bootstrap.Modal(document.getElementById('subjectModal')).show();
}

function selectColor(c) {
    document.getElementById('subColor').value = c;
    document.querySelectorAll('#colorPicker .color-swatch-btn').forEach(d => {
        const isSelected = d.dataset.color === c;
        d.classList.toggle('is-selected', isSelected);
        d.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
}

let subSaving = false;
function saveSubject() {
    // Re-entrancy guard against a rapid double-click duplicating the
    // subject before the modal's fade-out finishes.
    if (subSaving) return;
    const id = document.getElementById('subId').value;
    const codeInput = document.getElementById('subCode');
    const code = codeInput.value.trim();
    const codeInvalid = !code;
    const daysGroup = document.getElementById('subDaysGroup');
    const days = [...daysGroup.querySelectorAll('.day-check:checked')].map(c => c.value);
    const daysInvalid = days.length === 0;
    const codeError = document.getElementById('subCodeError');
    const daysError = document.getElementById('subDaysError');
    const startInput = document.getElementById('subStart');
    const endInput = document.getElementById('subEnd');
    const subjectModal = document.getElementById('subjectModal');
    subjectModal.dataset.timeValidationAttempted = 'true';
    const timeInvalid = updateSubjectTimeValidation();
    codeInput.setAttribute('aria-invalid', codeInvalid ? 'true' : 'false');
    codeError.hidden = !codeInvalid;
    daysGroup.classList.toggle('has-error', daysInvalid);
    daysGroup.setAttribute('aria-invalid', daysInvalid ? 'true' : 'false');
    daysError.hidden = !daysInvalid;
    if (codeInvalid || daysInvalid || timeInvalid.startInvalid || timeInvalid.endInvalid) {
        if (codeInvalid)
            codeInput.focus();
        else if (daysInvalid)
            daysGroup.querySelector('.day-check').focus();
        else if (timeInvalid.startInvalid)
            document.getElementById('subStartText').focus();
        else
            document.getElementById('subEndText').focus();
        return;
    }
    const start = startInput.value;
    const end = endInput.value;
    const isOnline = document.getElementById('subOnline').checked;
    const sem = DB.getActiveSemester();
    const data = {
        code, desc: document.getElementById('subDesc').value.trim(),
        type: document.getElementById('subType').value,
        units: parseFloat(document.getElementById('subUnits').value) || 0,
        section: document.getElementById('subSection').value.trim(),
        days, start, end,
        online: isOnline,
        room: isOnline ? '' : document.getElementById('subRoom').value.trim(),
        building: isOnline ? '' : document.getElementById('subBuilding').value.trim(),
        professor: document.getElementById('subProf').value.trim(),
        email: document.getElementById('subEmail').value.trim(),
        color: document.getElementById('subColor').value,
        notes: document.getElementById('subNotes').value.trim(),
        semester: sem ? sem.name : '1st Semester',
        schoolYear: sem ? sem.schoolYear : '2026-2027',
        semesterId: sem ? sem.id : DB.getActiveSemesterId(),
        archived: false,
    };
    subSaving = true;
    const conflicts = checkSaveConflict(data, id || null);
    const warnEl = document.getElementById('subConflictWarning');
    if (conflicts.length) {
        const conflictNames = conflicts.map(c => `${c.code} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ');
        warnEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>Schedule conflict with: ${escHtml(conflictNames)}. You can still save.`;
        warnEl.classList.remove('d-none');
    }
    else {
        warnEl.classList.add('d-none');
    }
    const subjects = DB.getSubjects();
    if (id) {
        const idx = subjects.findIndex(s => s.id === id);
        if (idx !== -1)
            subjects[idx] = { ...subjects[idx], ...data };
    }
    else
        subjects.push({ id: DB.uid(), ...data });
    if (DB.saveSubjects(subjects) === false) {
        Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'bi-exclamation-triangle');
        subSaving = false;
        return;
    }
    bootstrap.Modal.getInstance(document.getElementById('subjectModal')).hide();
    Toast.show(id ? 'Subject updated' : 'Subject added');
    renderAllViews();
    subSaving = false;
}

function deleteSubject(id) {
    const s = DB.getSubject(id);
    if (!s)
        return;
    confirmAction({
        title: 'Delete subject?',
        message: `"${s.code} — ${s.desc}" will be permanently removed.`,
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill', hideCloseButton: true,
        onConfirm() {
            if (DB.saveSubjects(DB.getSubjects().filter(x => x.id !== id)) === false) {
                Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'bi-exclamation-triangle');
                return;
            }
            Toast.show('Subject deleted');
            renderAllViews();
        }
    });
}

function duplicateSubject(id) {
    const subjects = DB.getSubjects();
    const s = subjects.find(x => x.id === id);
    if (!s)
        return;
    subjects.push({ ...s, id: DB.uid(), code: s.code + ' (copy)' });
    if (DB.saveSubjects(subjects) === false) {
        Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'bi-exclamation-triangle');
        return;
    }
    Toast.show('Subject duplicated');
    renderAllViews();
}

function archiveSubject(id) {
    const subjects = DB.getSubjects();
    const s = subjects.find(x => x.id === id);
    if (!s)
        return;
    s.archived = !s.archived;
    if (DB.saveSubjects(subjects) === false) {
        Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'bi-exclamation-triangle');
        return;
    }
    Toast.show(s.archived ? 'Subject archived' : 'Subject restored');
    renderAllViews();
}

// Pinch-to-zoom for timetable

function setupPinchZoom() {
    const el = document.getElementById('schTimetableView');
    if (!el)
        return;
    el.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            _pinchStartDist = Math.sqrt(dx * dx + dy * dy);
            _pinchStartZoom = ttZoomPct;
        }
    }, { passive: true });
    el.addEventListener('touchmove', e => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const scale = dist / (_pinchStartDist || 1);
            if (setTtZoom(_pinchStartZoom * scale))
                renderTimetable();
        }
    }, { passive: true });
}

function escapeHtml(s) { return escHtml(s); }

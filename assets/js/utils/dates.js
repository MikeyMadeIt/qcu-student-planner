// Date and time helpers (classic script — exposes globals used by all modules)

function ymdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isDateInSemester(date) {
    const toDateKey = value => {
        if (value instanceof Date)
            return isNaN(value.getTime()) ? null : ymdLocal(value);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!match)
            return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const localDate = new Date(year, month - 1, day);
        if (localDate.getFullYear() !== year || localDate.getMonth() !== month - 1 || localDate.getDate() !== day)
            return null;
        return ymdLocal(localDate);
    };
    const semester = typeof DB !== 'undefined' ? DB.getActiveSemester() : null;
    const dateKey = toDateKey(date);
    const startKey = semester && toDateKey(semester.startDate);
    const endKey = semester && toDateKey(semester.endDate);
    return !!(dateKey && startKey && endKey && startKey <= dateKey && dateKey <= endKey);
}

// Academic periods use date-only values in Asia/Manila. Weeks are seven-day
// blocks anchored to the configured start date, with a final partial block.
function calculateSemesterTimeline(startValue, endValue, nowValue) {
    const parse = value => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!m) return null;
        const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
        const d = new Date(ms);
        return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? ms : null;
    };
    const start = parse(startValue), end = parse(endValue);
    if (start === null || end === null || end < start) return null;
    let today;
    if (typeof nowValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nowValue)) today = parse(nowValue);
    else {
        const now = nowValue instanceof Date ? nowValue : new Date(nowValue == null ? Date.now() : nowValue);
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
        const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
        today = parse(`${p.year}-${p.month}-${p.day}`);
    }
    if (today === null) return null;
    const day = 86400000;
    const totalDays = Math.floor((end - start) / day) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    const status = today < start ? 'upcoming' : today > end ? 'completed' : 'in-progress';
    const elapsedDays = Math.max(0, Math.min(totalDays - 1, Math.floor((today - start) / day)));
    return {
        status, totalDays, totalWeeks,
        currentWeek: status === 'upcoming' ? null : status === 'completed' ? totalWeeks : Math.floor((today - start) / (7 * day)) + 1,
        progress: status === 'upcoming' ? 0 : status === 'completed' ? 100 : totalDays <= 1 ? 100 : Math.round(elapsedDays / (totalDays - 1) * 100),
    };
}

function isSemesterSelectable(semester, activeSemesterId, todayValue) {
    if (!semester || !semester.id || !semester.startDate) return false;
    return semester.id === activeSemesterId || semester.startDate <= (todayValue || academicDateKey());
}

function academicDateKey() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
}

// Keep academic-period date ranges consistent across the dashboard and
// settings, using date-only values in the university's Asia/Manila timezone.
function formatSemesterDateRange(startValue, endValue) {
    const format = (value, includeYear) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!match) return '';
        const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
        if (date.getUTCFullYear() !== +match[1] || date.getUTCMonth() !== +match[2] - 1 || date.getUTCDate() !== +match[3]) return '';
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}), timeZone: 'UTC'
        });
    };
    const startYear = String(startValue || '').slice(0, 4);
    const endYear = String(endValue || '').slice(0, 4);
    const start = format(startValue, !!(startYear && endYear && startYear !== endYear));
    const end = format(endValue, true);
    if (start && end) return `${start} - ${end}`;
    return start || end;
}
window.formatSemesterDateRange = formatSemesterDateRange;

// Format "14:30" -> "2:30 PM"

function fmtTime(t) {
    if (!t)
        return '';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtDuration(mins) {
    if (mins < 0)
        return 'Overdue';
    if (mins < 60)
        return `${mins}m`;
    const h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24)
        return `${h}h ${m}m`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayKey() { return ymdLocal(new Date()); }

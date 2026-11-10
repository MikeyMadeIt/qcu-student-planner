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

// Format "14:30" -> "2:30 PM"

function fmtTime(t) {
    if (!t)
        return '';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function minutesUntil(dateStr, timeStr) {
    const target = new Date(`${dateStr}T${timeStr}:00`);
    return Math.round((target - new Date()) / 60000);
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

/* Date and time helpers (classic script — exposes globals used by all modules) */

function ymdLocal(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Format "14:30" -> "2:30 PM"
 */

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

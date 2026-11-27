/* Small RFC 5545 calendar importer. Expands recurring events into individual
   planner events because calendar_events stores one date per event. */
(function (root) {
    'use strict';

    const DATE_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/;

    function localDate(y, m, d) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function localParts(date) {
        return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), h: date.getHours(), min: date.getMinutes() };
    }

    function partsInZone(date, zone) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return { y: +values.year, m: +values.month, d: +values.day, h: +values.hour, min: +values.minute };
    }

    function wallTimeInZone(parts, zone) {
        const guess = Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min);
        const shown = partsInZone(new Date(guess), zone);
        const offset = Date.UTC(shown.y, shown.m - 1, shown.d, shown.h, shown.min) - guess;
        return new Date(guess - offset);
    }

    function parseDateValue(value, params = {}) {
        const match = DATE_RE.exec(String(value || '').trim());
        if (!match) return null;
        const parts = { y: +match[1], m: +match[2], d: +match[3], h: +(match[4] || 0), min: +(match[5] || 0), sec: +(match[6] || 0) };
        const day = new Date(parts.y, parts.m - 1, parts.d);
        if (day.getFullYear() !== parts.y || day.getMonth() !== parts.m - 1 || day.getDate() !== parts.d || parts.h > 23 || parts.min > 59 || parts.sec > 59)
            return null;
        const isDate = !match[4] || String(params.VALUE || '').toUpperCase() === 'DATE';
        if (isDate) return { date: localDate(parts.y, parts.m, parts.d), time: '', allDay: true };

        let instant = null;
        const zone = String(params.TZID || '').replace(/^"|"$/g, '');
        try {
            if (match[7]) instant = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.h, parts.min, parts.sec));
            else if (zone) instant = wallTimeInZone(parts, zone);
        } catch (_) { return null; }
        const displayed = instant ? localParts(instant) : parts;
        return { date: localDate(displayed.y, displayed.m, displayed.d), time: `${String(displayed.h).padStart(2, '0')}:${String(displayed.min).padStart(2, '0')}`, allDay: false };
    }

    function parseProperty(line) {
        const colon = line.indexOf(':');
        if (colon < 0) return null;
        const left = line.slice(0, colon).split(';');
        const params = {};
        left.slice(1).forEach(part => {
            const idx = part.indexOf('=');
            if (idx > 0) params[part.slice(0, idx).toUpperCase()] = part.slice(idx + 1);
        });
        return { name: left[0].toUpperCase(), params, value: line.slice(colon + 1) };
    }

    function unescapeText(value) {
        return String(value || '').replace(/\\([nN,;\\])/g, (_, ch) => ch === 'n' || ch === 'N' ? '\n' : ch);
    }

    function mondayIndex(date) { return (date.getDay() + 6) % 7; }
    function dateObject(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
    function dateKey(date) { return localDate(date.getFullYear(), date.getMonth() + 1, date.getDate()); }

    function recurrenceDates(startKey, ruleText, endKey) {
        if (!ruleText) return [startKey];
        const rule = Object.fromEntries(String(ruleText || '').split(';').map(part => {
            const idx = part.indexOf('='); return idx < 0 ? ['', ''] : [part.slice(0, idx).toUpperCase(), part.slice(idx + 1).toUpperCase()];
        }));
        const freq = rule.FREQ;
        const supported = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH']);
        if (Object.keys(rule).some(key => !supported.has(key)) || !freq || (rule.COUNT && rule.UNTIL)) return null;
        if ((rule.INTERVAL && !/^[1-9]\d*$/.test(rule.INTERVAL)) || (rule.COUNT && !/^[1-9]\d*$/.test(rule.COUNT))) return null;
        if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
        if ((rule.BYDAY && (freq !== 'WEEKLY' || rule.BYDAY.split(',').some(day => !/^(MO|TU|WE|TH|FR|SA|SU)$/.test(day)))) ||
            (rule.BYMONTHDAY && !['MONTHLY', 'YEARLY'].includes(freq)) || (rule.BYMONTH && freq !== 'YEARLY')) return null;
        const interval = Math.max(1, Number(rule.INTERVAL) || 1);
        const countLimit = Math.max(0, Number(rule.COUNT) || Infinity);
        const untilValue = rule.UNTIL ? parseDateValue(rule.UNTIL) : null;
        if (rule.UNTIL && !untilValue) return null;
        const until = untilValue ? untilValue.date : endKey;
        const upper = [endKey, until].filter(Boolean).sort()[0] || startKey;
        const start = dateObject(startKey), finish = dateObject(upper);
        const dayMap = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };
        const byDays = rule.BYDAY ? rule.BYDAY.split(',').map(v => v.slice(-2)).map(code => dayMap[code]).filter(v => v !== undefined) : [mondayIndex(start)];
        const byMonthDays = rule.BYMONTHDAY ? rule.BYMONTHDAY.split(',').map(Number) : [start.getDate()];
        const byMonths = rule.BYMONTH ? rule.BYMONTH.split(',').map(Number) : [start.getMonth() + 1];
        if (byMonthDays.some(day => !Number.isInteger(day) || day === 0 || day < -31 || day > 31) || byMonths.some(month => !Number.isInteger(month) || month < 1 || month > 12)) return null;
        const result = [];
        let occurrence = 0;
        const cursor = new Date(start);
        const maxDays = 366 * 20;
        for (let scanned = 0; cursor <= finish && scanned < maxDays; scanned++, cursor.setDate(cursor.getDate() + 1)) {
            const dayDiff = Math.round((cursor - start) / 86400000);
            const monthDiff = (cursor.getFullYear() - start.getFullYear()) * 12 + cursor.getMonth() - start.getMonth();
            const yearDiff = cursor.getFullYear() - start.getFullYear();
            const monthDayMatch = byMonthDays.some(day => day > 0 ? cursor.getDate() === day : cursor.getDate() === new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate() + day + 1);
            let matches = false;
            if (freq === 'DAILY') matches = dayDiff >= 0 && dayDiff % interval === 0;
            if (freq === 'WEEKLY') {
                const weekDiff = Math.floor((dayDiff + mondayIndex(start)) / 7);
                matches = weekDiff >= 0 && weekDiff % interval === 0 && byDays.includes(mondayIndex(cursor));
            }
            if (freq === 'MONTHLY') matches = monthDiff >= 0 && monthDiff % interval === 0 && monthDayMatch;
            if (freq === 'YEARLY') matches = yearDiff >= 0 && yearDiff % interval === 0 && byMonths.includes(cursor.getMonth() + 1) && monthDayMatch;
            if (!matches) continue;
            occurrence++;
            if (occurrence > countLimit) break;
            const key = dateKey(cursor);
            if (key >= startKey && (!endKey || key <= endKey)) result.push(key);
        }
        return result;
    }

    function parse(text, semester) {
        if (typeof text !== 'string' || !text.trim()) throw new Error('The selected file is empty.');
        if (text.length > 10 * 1024 * 1024) throw new Error('The ICS file is too large (10 MB limit).');
        const normalized = text.replace(/^\uFEFF/, '').replace(/\r?\n[ \t]/g, '');
        if (!/^BEGIN:VCALENDAR\s*$/im.test(normalized) || !/^END:VCALENDAR\s*$/im.test(normalized))
            throw new Error('This file is not a complete ICS calendar.');
        const lines = normalized.split(/\r?\n/);
        const rawEvents = [];
        let current = null;
        for (const line of lines) {
            const normalized = line.trimEnd();
            if (/^BEGIN:VEVENT$/i.test(normalized)) { if (current) throw new Error('The ICS file contains a nested event.'); current = []; continue; }
            if (/^END:VEVENT$/i.test(normalized)) { if (current) rawEvents.push(current); current = null; continue; }
            if (current) { const prop = parseProperty(normalized); if (prop) current.push(prop); }
        }
        if (current || !rawEvents.length) throw new Error('No complete calendar events were found in this ICS file.');

        const semStart = semester && semester.startDate;
        const semEnd = semester && semester.endDate;
        const imported = [];
        let skipped = 0;
        for (const props of rawEvents) {
            const one = name => props.find(p => p.name === name);
            const startProp = one('DTSTART'), endProp = one('DTEND'), summary = one('SUMMARY');
            const start = startProp && parseDateValue(startProp.value, startProp.params);
            const end = endProp && parseDateValue(endProp.value, endProp.params);
            const title = summary && unescapeText(summary.value).trim();
            if (!start || (endProp && !end) || (end && end.allDay !== start.allDay) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(start.date) || (end && (end.date < start.date || (end.date === start.date && start.allDay) || (end.date === start.date && end.time && start.time && end.time < start.time))) || props.some(p => p.name === 'STATUS' && p.value.toUpperCase() === 'CANCELLED')) { skipped++; continue; }
            const description = unescapeText((one('DESCRIPTION') || {}).value || '');
            let endTime = end && !start.allDay ? end.time : '';
            const duration = (one('DURATION') || {}).value || '';
            if (!endTime && start.time && /^PT(?:(\d+)H)?(?:(\d+)M)?$/.test(duration)) {
                const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(duration);
                const total = Number(m[1] || 0) * 60 + Number(m[2] || 0);
                endTime = `${String((Math.floor((Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) + total) / 60)) % 24).padStart(2, '0')}:${String((Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)) + total) % 60).padStart(2, '0')}`;
            }
            const exdates = new Set(props.filter(p => p.name === 'EXDATE').flatMap(p => p.value.split(',').map(v => parseDateValue(v, p.params)).filter(Boolean).map(v => v.date)));
            const rrule = (one('RRULE') || {}).value;
            const expandedDates = recurrenceDates(start.date, rrule, semEnd);
            if (!expandedDates) { skipped++; continue; }
            const rdates = props.filter(p => p.name === 'RDATE').flatMap(p => p.value.split(',').map(v => parseDateValue(v, p.params)).filter(Boolean).map(v => v.date));
            const dates = [...new Set([...expandedDates, ...rdates])].filter(key => (!semStart || key >= semStart) && (!semEnd || key <= semEnd) && !exdates.has(key)).sort();
            const occurrences = dates.length ? dates : (!rrule && (!semStart || start.date >= semStart) && (!semEnd || start.date <= semEnd) ? [start.date] : []);
            if (!occurrences.length) { skipped++; continue; }
            const spanDays = end && end.date > start.date
                ? Math.max(1, Math.round((dateObject(end.date) - dateObject(start.date)) / 86400000))
                : 1;
            occurrences.forEach(date => {
                for (let offset = 0; offset < spanDays; offset++) {
                    const occurrenceDate = dateObject(date);
                    occurrenceDate.setDate(occurrenceDate.getDate() + offset);
                    if (semEnd && dateKey(occurrenceDate) > semEnd) break;
                    imported.push({
                        title, date: dateKey(occurrenceDate),
                        startTime: offset === 0 ? start.time : (start.time ? '00:00' : ''),
                        endTime: start.allDay ? '' : (offset === spanDays - 1 ? endTime : '23:59'),
                        description, category: 'Event', semesterId: semester.id
                    });
                }
            });
        }
        if (!imported.length) throw new Error('No valid events for the active semester were found.');
        return { events: imported, skipped };
    }

    root.ICSImport = { parse };
})(window);

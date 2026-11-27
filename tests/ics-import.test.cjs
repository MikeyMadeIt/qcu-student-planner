const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {}, Intl, Date, Object, String, Number, Math, Set, Error };
vm.runInNewContext(fs.readFileSync('assets/js/utils/ics-import.js', 'utf8'), context);
const { parse } = context.window.ICSImport;

test('imports multiple timed and all-day VEVENT records with escaped text', () => {
  const result = parse(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:one\nDTSTART:20260810T090000\nDTEND:20260810T103000\nSUMMARY:Project\\, review\nDESCRIPTION:Bring notes\\nAnd laptop\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260811\nDTEND;VALUE=DATE:20260812\nSUMMARY:Holiday\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-01', endDate: '2026-12-31'
  });
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].title, 'Project, review');
  assert.equal(result.events[0].description, 'Bring notes\nAnd laptop');
  assert.equal(result.events[0].startTime, '09:00');
  assert.equal(result.events[0].endTime, '10:30');
  assert.equal(result.events[1].date, '2026-08-11');
  assert.equal(result.events[1].startTime, '');
});

test('expands weekly recurrence into the active semester range', () => {
  const result = parse(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260803T100000\nDTEND:20260803T110000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10\nSUMMARY:Review\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-10', endDate: '2026-08-21'
  });
  assert.deepEqual(Array.from(result.events, event => event.date), ['2026-08-10', '2026-08-12', '2026-08-17', '2026-08-19']);
});

test('converts timezone-qualified event times to the device local timezone', () => {
  const result = parse(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=America/New_York:20260810T090000\nDTEND;TZID=America/New_York:20260810T103000\nSUMMARY:Timezone check\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-01', endDate: '2026-12-31'
  });
  const expected = new Date('2026-08-10T13:00:00Z');
  assert.equal(result.events[0].date, `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`);
  assert.equal(result.events[0].startTime, `${String(expected.getHours()).padStart(2, '0')}:${String(expected.getMinutes()).padStart(2, '0')}`);
});

test('splits multi-day all-day events across dates using the exclusive ICS end date', () => {
  const result = parse(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260810\nDTEND;VALUE=DATE:20260813\nSUMMARY:Orientation\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-01', endDate: '2026-12-31'
  });
  assert.deepEqual(Array.from(result.events, event => event.date), ['2026-08-10', '2026-08-11', '2026-08-12']);
  assert.ok(result.events.every(event => !event.startTime && !event.endTime));
});

test('rejects malformed calendars and skips invalid events', () => {
  assert.throws(() => parse('BEGIN:VEVENT\nSUMMARY:Missing calendar wrapper\nEND:VEVENT', { id: 's' }), /complete ICS calendar/);
  assert.throws(() => parse(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Missing start\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-01', endDate: '2026-12-31'
  }), /No valid events/);
});

test('rejects unsupported recurrence rules rather than silently importing one occurrence', () => {
  assert.throws(() => parse(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260803T100000\nRRULE:FREQ=HOURLY\nSUMMARY:Unsupported\nEND:VEVENT\nEND:VCALENDAR`, {
    id: 'semester-1', startDate: '2026-08-01', endDate: '2026-12-31'
  }), /No valid events/);
});

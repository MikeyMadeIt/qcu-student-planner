const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createCalendarContext(data) {
  let downloadedBlob;
  let downloadedName;
  const handlers = {};
  const document = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    documentElement: { dataset: {} },
    createElement: () => ({ click() {} }),
  };
  const anchor = document.createElement();
  document.createElement = () => anchor;
  const context = {
    Date, Blob, Set, Object, String, Number, Math, Intl,
    document,
    window: { addEventListener() {} },
    URL: {
      createObjectURL(blob) { downloadedBlob = blob; return 'blob:test'; },
      revokeObjectURL() {},
    },
    DB: {
      getActiveSemesterId: () => 'semester-1',
      getActiveSemester: () => data.semester,
      getCalendarEventsForSemester: () => data.events,
      getTasksForSemester: () => data.tasks,
      getSubjects: () => data.subjects,
    },
    Toast: { show() {} },
    console,
  };
  Object.defineProperty(anchor, 'download', { set(value) { downloadedName = value; } });
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/modules/calendar.js', 'utf8'), context);
  vm.runInContext(`_univEventsCache = ${JSON.stringify(data.universityEvents)};`, context);
  return { context, getBlob: () => downloadedBlob, getName: () => downloadedName };
}

test('calendar ICS exports planner events, tasks, recurring subjects, and university events', async () => {
  const { context, getBlob, getName } = createCalendarContext({
    semester: { schoolYear: '2026-2027', name: '1st Semester', startDate: '2026-08-10', endDate: '2026-12-12' },
    events: [{ id: 'event-1', date: '2026-08-11', title: 'Planner meeting', startTime: '09:00', endTime: '10:00' }],
    tasks: [{ id: 'task-1', dueDate: '2026-08-12', dueTime: '', title: 'Read chapter', description: 'Chapter 1' }],
    subjects: [{ id: 'subject-1', semesterId: 'semester-1', code: 'CS101', desc: 'Intro to Computing', days: ['Mon', 'Wed'], start: '08:00', end: '09:30', room: 'Room 2', building: 'North' }],
    universityEvents: [{ id: 'univ-1', title: 'University Assembly', event_date: '2026-08-13', description: '', location: 'Gym' }],
  });
  context.exportICS();
  const ics = await getBlob().text();
  assert.equal(getName(), 'Student-Planner-2026-2027-1st-Semester.ics');
  assert.match(ics, /SUMMARY:Planner meeting/);
  assert.match(ics, /SUMMARY:\[Task\] Read chapter/);
  assert.match(ics, /SUMMARY:CS101/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261212T235959/);
  assert.match(ics, /LOCATION:Room 2\\, North/);
  assert.match(ics, /SUMMARY:University Assembly/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260812\r\nDTEND;VALUE=DATE:20260813/);
  context.exportGoogleCalendar();
  assert.equal(getName(), 'Google-Calendar-2026-2027-1st-Semester.ics');
});

test('jump date outside-click check recognizes a picker whose clicked month button was replaced', () => {
  const pickerPanel = { contains: () => false };
  const detachedChevron = { closest: () => null };
  const path = [{}, pickerPanel, {}];
  const context = {
    Date, Set, Object, String, Number, Math, Intl,
    document: { addEventListener() {}, documentElement: { dataset: {} }, getElementById: () => pickerPanel },
    window: { addEventListener() {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/modules/calendar.js', 'utf8'), context);
  const dropdown = { contains: () => false };
  const pathEvent = { target: detachedChevron, composedPath: () => path };
  assert.equal(context.isJumpDatePickerInteraction(pathEvent, dropdown), true);
  assert.equal(context.isJumpDatePickerInteraction({ target: {}, composedPath: () => [] }, dropdown), false);
});

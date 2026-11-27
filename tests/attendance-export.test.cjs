const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function createExportContext(records) {
  const semester = { id: 'semester-1', schoolYear: '2026-2027', name: '1st Semester' };
  const events = [];
  const downloads = [];
  let report = '';
  let printCount = 0;
  const DB = {
    getActiveSemesterId: () => semester.id,
    getActiveSemester: () => semester,
    getAttendance: () => records,
    getSubjects: () => [{ id: 'subject-1', semesterId: semester.id, code: 'MATH,"1"', archived: false }],
    getSettings: () => ({ name: 'Test Student' }),
  };
  const anchor = { click() { downloads.push({ href: this.href, download: this.download }); } };
  const printWindow = {
    document: { write(value) { report = value; }, close() {} },
    focus() {}, requestAnimationFrame(callback) { callback(); }, print() { printCount++; },
  };
  const context = {
    DB,
    Toast: { show: message => events.push(message) },
    Blob,
    URL: { createObjectURL: blob => { context.lastBlob = blob; return 'blob:attendance'; }, revokeObjectURL() {} },
    document: { createElement: () => anchor, addEventListener() {} },
    window: { open: () => printWindow, addEventListener() {} },
    summarizeAttendance: () => ({ rate: 50, present: 1, late: 0, excused: 0, absent: 1, noClass: 0 }),
    getLiveSemesterAttendance: () => records,
    Date,
    console,
  };
  vm.runInNewContext(fs.readFileSync('assets/js/modules/attendance.js', 'utf8'), context);
  return { context, events, downloads, getReport: () => report, getPrintCount: () => printCount };
}

const sampleRecords = [{
  id: 'record-1', semesterId: 'semester-1', subjectId: 'subject-1', date: '2026-08-10',
  status: 'Present', online: true, notes: 'Lab, "bring" <script>alert(1)</script>',
}];

test('attendance CSV is a quoted data export with headers, filename, and escaped values', async () => {
  const testApp = createExportContext(sampleRecords);
  testApp.context.exportAttendanceCSV();
  const csv = await testApp.context.lastBlob.text();
  assert.match(csv, /^Date,Subject,Status,Mode,Notes/);
  assert.match(csv, /"MATH,""1"""/);
  assert.match(csv, /"Lab, ""bring"" <script>alert\(1\)<\/script>"/);
  assert.match(testApp.downloads[0].download, /Attendance-2026-2027-1st-Semester\.csv$/);
});

test('attendance PDF builds a safe paginated print report and invokes the browser print flow', () => {
  const testApp = createExportContext(sampleRecords);
  testApp.context.exportAttendancePDF();
  assert.match(testApp.getReport(), /QCU Student Planner/);
  assert.match(testApp.getReport(), /thead\{display:table-header-group\}/);
  assert.match(testApp.getReport(), /Lab, &quot;bring&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.equal(testApp.getPrintCount(), 1);
});

test('attendance exports give a clear message for empty records', () => {
  const testApp = createExportContext([]);
  testApp.context.exportAttendanceCSV();
  testApp.context.exportAttendancePDF();
  assert.equal(testApp.downloads.length, 0);
  assert.equal(testApp.getPrintCount(), 0);
  assert.equal(testApp.events.length, 2);
});

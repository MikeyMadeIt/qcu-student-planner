const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/utils/dates.js'), 'utf8');
const context = {};
vm.runInNewContext(source + '\nthis.calculateSemesterTimeline = calculateSemesterTimeline; this.isSemesterSelectable = isSemesterSelectable;', context);
const calculate = context.calculateSemesterTimeline;
const canSelect = context.isSemesterSelectable;

test('semester weeks anchor to configured start and include partial final week', () => {
  const result = calculate('2026-01-05', '2026-01-19', '2026-01-12');
  assert.equal(result.totalDays, 15);
  assert.equal(result.totalWeeks, 3);
  assert.equal(result.currentWeek, 2);
});

test('week one begins on the configured start date and never displays week zero', () => {
  assert.equal(calculate('2026-01-05', '2026-02-10', '2026-01-05').currentWeek, 1);
  assert.equal(calculate('2026-01-05', '2026-02-10', '2026-01-04').currentWeek, null);
});

test('progress is bounded and completed periods stop at their calculated total', () => {
  assert.equal(calculate('2024-02-20', '2024-02-29', '2024-02-20').progress, 0);
  const done = calculate('2024-02-20', '2024-02-29', '2024-03-01');
  assert.equal(done.status, 'completed');
  assert.equal(done.progress, 100);
  assert.equal(done.currentWeek, 2);
});

test('date-only academic boundaries use Manila calendar date', () => {
  const beforeManilaMidnight = new Date('2026-01-04T15:59:00Z');
  const atManilaMidnight = new Date('2026-01-04T16:00:00Z');
  assert.equal(calculate('2026-01-05', '2026-01-20', beforeManilaMidnight).status, 'upcoming');
  assert.equal(calculate('2026-01-05', '2026-01-20', atManilaMidnight).status, 'in-progress');
});

test('students can select active and past semesters but not future semesters', () => {
  const active = { id: 'active', startDate: '2026-08-01' };
  const past = { id: 'past', startDate: '2025-08-01' };
  const future = { id: 'future', startDate: '2027-08-01' };
  assert.equal(canSelect(active, 'active', '2026-01-01'), true);
  assert.equal(canSelect(past, 'active', '2026-01-01'), true);
  assert.equal(canSelect(future, 'active', '2026-01-01'), false);
});

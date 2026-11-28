const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('task ownership trigger migration checks only task columns that exist', () => {
  const migration = read('supabase/migrations/0033_fix_task_ownership_trigger.sql');
  const body = migration.match(/create or replace function public\.tasks_guard_fk\(\)([\s\S]*?)\$\$;/i)?.[1] || '';
  assert.match(body, /new\.subject_id/i);
  assert.match(body, /new\.semester_id/i);
  assert.doesNotMatch(body, /syllabus_week_id/i);
});

test('task modal waits for server success before committing locally or closing', () => {
  const modal = read('assets/js/shared/task-modal.js');
  assert.match(modal, /await DB\.saveTasksAndSync\(tasks\)/);
  assert.match(modal, /if \(!saveResult\.ok\)[\s\S]*?return;/);
  assert.match(modal, /Task was not saved:/);
  assert.doesNotMatch(modal, /syllabusWeekId|tSyllabusWeekId/);
});

test('task sync payload includes the selected semester and no syllabus field', () => {
  const sync = read('assets/js/data/cloud-sync.js');
  const mapper = sync.match(/function taskLocalToRow\(t, userId\)([\s\S]*?)\n    }/i)?.[1] || '';
  assert.match(mapper, /semester_id:\s*requireServerSemesterId\(t\.semesterId, 'this task'\)/);
  assert.doesNotMatch(mapper, /syllabus_week_id/i);
});

test('shared-semester migration replaces student-owned composite semester FKs without dropping owner guards', () => {
  const migration = read('supabase/migrations/0034_shared_semester_foreign_keys.sql');
  assert.match(migration, /array_length\(v_constraint\.local_columns, 1\) > 1/);
  assert.match(migration, /references public\.semesters\(id\).*not valid/i);
  assert.match(migration, /Existing rows are preserved/);
  assert.doesNotMatch(migration, /drop trigger|drop policy|disable row level security/i);
});

test('semester relationship migration enforces parent consistency without rewriting history', () => {
  const migration = read('supabase/migrations/0036_enforce_parent_semester_consistency.sql');
  assert.match(migration, /Task and subject must belong to the same semester/);
  assert.match(migration, /Note and task must belong to the same semester/);
  assert.match(migration, /Attendance and subject must belong to the same semester/);
  assert.match(migration, /Grade and subject must belong to the same semester/);
  assert.match(migration, /unrelated edits to an old inconsistent row remain possible/i);
  assert.match(migration, /security definer set search_path to ''/i);
});

test('account deletion migration no longer depends on removed syllabus or settings tables', () => {
  const migration = read('supabase/migrations/0035_fix_account_deletion_rpc.sql');
  assert.doesNotMatch(migration, /public\.(syllabus_courses|syllabus_weeks|syllabus_topics|user_settings|push_subscriptions)\b/i);
  assert.match(migration, /if not public\.is_admin\(\)/i);
  assert.match(migration, /v_status <> 'rejected'/i);
  assert.match(migration, /set search_path to ''/i);
  assert.match(migration, /where user_id = target_user_id/i);
});

test('admin semester activation uses the Manila academic date consistently', () => {
  const migration = read('supabase/migrations/0037_manila_calendar_status_date.sql');
  assert.match(migration, /now\(\) at time zone 'Asia\/Manila'\)::date/i);
  assert.doesNotMatch(migration.replace(/--[^\n]*/g, ''), /current_date/i);
  assert.match(migration, /if not public\.is_admin\(\)/i);
});

test('subject modal waits for server persistence and reports a single save outcome', () => {
  const modal = read('assets/js/shared/subject-modal.js');
  const sync = read('assets/js/data/cloud-sync.js');
  assert.match(modal, /await DB\.saveSubjectsAndSync\(subjects\)/);
  assert.match(modal, /if \(!saveResult \|\| !saveResult\.ok\)[\s\S]*?return;/);
  assert.match(sync, /Select a valid semester before saving subject/);
});

test('unchanged legacy subjects do not block synchronization of a newly selected semester', () => {
  const sync = read('assets/js/data/cloud-sync.js');
  assert.match(sync, /markChangedCollectionDirty\('subjects', previous, list\)/);
  assert.match(sync, /if \(dirty\.has\(s\.id\)\)[\s\S]*?Select a valid semester before saving subject/);
  assert.match(sync, /JSON\.stringify\(previous\.get\(id\)\) === JSON\.stringify\(row\) && !serverSemesterId\(row\.semesterId\)/);
});

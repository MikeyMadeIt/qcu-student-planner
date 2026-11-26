const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('grade normalization repairs semester from its owned subject and only saves changes', () => {
    const source = read('assets/js/modules/grades.js');
    const fn = source.match(/function syncGradesWithSubjects\(\)([\s\S]*?)\n}\n/)[1];
    assert.match(fn, /subjectsById\.get\(g\.subjectId\)/);
    assert.match(fn, /g\.semesterId !== sub\.semesterId/);
    assert.match(fn, /if \(changed\) DB\.saveGrades\(allGrades\)/);
});

test('grade display and editor match both subject and semester', () => {
    const source = read('assets/js/modules/grades.js');
    assert.match(source, /x\.subjectId === s\.id && x\.semesterId === s\.semesterId/);
    assert.match(source, /x\.subjectId === subjectId && x\.semesterId === s\.semesterId/);
});

test('grading breakdown commits to Supabase before success UI and preserves draft on failure', () => {
    const source = read('assets/js/modules/grades.js');
    const fn = source.match(/async function saveGradeComponents\(\)([\s\S]*?)\n}\n/)[1];
    assert.match(fn, /await DB\.saveGradesAndSync\(grades\)/);
    assert.ok(fn.indexOf('if (!result || !result.ok)') < fn.indexOf("Toast.show('Grading breakdown saved')"));
    assert.match(fn, /catch \(error\)[\s\S]*Toast\.show\(`Couldn't save the grading breakdown/);
    assert.match(fn, /if \(gcSaving \|\| !gradeDraft\) return/);
});

test('grade sync returns one operation result and suppresses service toast for form-owned saves', () => {
    const source = read('assets/js/data/cloud-sync.js');
    assert.match(source, /function pushGrades\(newList, silentFailure\)/);
    assert.match(source, /if \(silentFailure\) recordSyncError\('grades', message\);\s*else toast\(message, 'high', 'grades'\)/);
    assert.match(source, /if \(last\.grades\.has\(g\.id\) && !dirty\.has\(g\.id\)\) continue/);
    assert.match(source, /DB\.saveGradesAndSync = async function \(list\)/);
});

function makeSaveHarness(saveResult) {
    const messages = [];
    let savedRows = null;
    let hidden = false;
    const button = {
        disabled: false,
        dataset: {},
        isConnected: true,
        setAttribute() {},
        removeAttribute() {},
    };
    const subject = { id: 'subject-1', semesterId: 'semester-current', code: 'AR101' };
    const context = {
        DB: {
            getSubject: () => subject,
            getActiveSemesterId: () => 'semester-current',
            getGrades: () => [{ id: 'grade-1', subjectId: 'subject-1', semesterId: 'semester-old', components: [] }],
            uid: () => '10000000-0000-4000-8000-000000000000',
            saveGradesAndSync: async rows => { savedRows = rows; return saveResult; },
        },
        document: {
            querySelector: () => button,
            querySelectorAll: () => [],
            getElementById: () => ({}),
        },
        Toast: { show: (...args) => messages.push(args) },
        bootstrap: { Modal: { getInstance: () => ({ hide: () => { hidden = true; } }) } },
        renderGradesOverview() {},
        renderGradeCards() {},
        console,
    };
    const gradeSource = fs.readFileSync(path.join(__dirname, '..', 'assets/js/modules/grades.js'), 'utf8');
    const gwaSource = fs.readFileSync(path.join(__dirname, '..', 'assets/js/services/gwa.js'), 'utf8');
    vm.runInNewContext(gwaSource + '\n' + gradeSource + `
        gradeDraft = { components: [{ id: '20000000-0000-4000-8000-000000000000', name: 'Exam', weight: 100, assessments: [] }] };
        gradeDraftSubjectId = 'subject-1';
        gradeDraftSemesterId = 'semester-current';
        renderGradesOverview = function () {};
        renderGradeCards = function () {};
    `, context);
    return { context, messages, button, getSavedRows: () => savedRows, wasHidden: () => hidden };
}

test('grade save repairs the stale grade semester and only reports success after server confirmation', async () => {
    const harness = makeSaveHarness({ ok: true });
    await vm.runInNewContext('saveGradeComponents()', harness.context);
    assert.equal(harness.getSavedRows()[0].semesterId, 'semester-current');
    assert.equal(harness.wasHidden(), true);
    assert.equal(harness.messages.length, 1);
    assert.match(harness.messages[0][0], /Grading breakdown saved/);
});

test('failed grade save keeps the breakdown open and emits one error notification', async () => {
    const harness = makeSaveHarness({ ok: false, error: new Error('Grade and subject must belong to the same semester') });
    await vm.runInNewContext('saveGradeComponents()', harness.context);
    assert.equal(harness.wasHidden(), false);
    assert.equal(harness.messages.length, 1);
    assert.match(harness.messages[0][0], /same semester/);
    assert.match(harness.button.innerHTML, /Retry Save/);
    assert.equal(harness.button.disabled, false);
});

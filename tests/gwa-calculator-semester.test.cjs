const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function makeHarness() {
    let semesterId = 'semester-a';
    let rows = [];
    let uid = 0;
    const elements = new Map();
    const element = id => {
        if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', style: {} });
        return elements.get(id);
    };
    const context = {
        DB: {
            getActiveSemesterId: () => semesterId,
            getGwaCalcRows: () => rows,
            saveGwaCalcRows: next => { rows = structuredClone(next); return true; },
            uid: () => `row-${++uid}`,
        },
        document: { getElementById: element },
        window: { enhanceSelects() {}, addEventListener() {} },
        escapeHtml: value => String(value),
        console,
    };
    vm.runInNewContext(read('assets/js/services/gwa.js') + '\n' + read('assets/js/modules/grades.js'), context);
    return {
        context,
        rows: () => rows,
        element,
        selectSemester(id) { semesterId = id; },
    };
}

test('manual GWA rows receive the selected semester and remain isolated when switching', () => {
    const h = makeHarness();
    h.context.renderGwaCalculator();
    const draft = h.rows()[0];
    assert.equal(draft.semesterId, 'semester-a');
    h.context.updateGwaCalcRow(draft.id, 'label', 'AR101');
    h.context.updateGwaCalcRow(draft.id, 'units', '3');
    h.context.updateGwaCalcRow(draft.id, 'grade', '1.5');
    assert.equal(h.rows()[0].semesterId, 'semester-a');
    assert.match(h.element('gwaCalcResult').textContent, /1\.50/);
    assert.equal(h.element('gwaTotalUnits').textContent, 3);
    assert.equal(h.element('gwaTotalCourses').textContent, 1);

    h.selectSemester('semester-b');
    h.context.renderGwaCalculator();
    assert.equal(h.rows().length, 2);
    assert.equal(h.rows()[1].semesterId, 'semester-b');
    assert.doesNotMatch(h.element('gwaCalcRows').innerHTML, /AR101/);
    assert.equal(h.element('gwaCalcResult').textContent, '--');

    h.selectSemester('semester-a');
    h.context.renderGwaCalculator();
    assert.match(h.element('gwaCalcRows').innerHTML, /AR101/);
    assert.match(h.element('gwaCalcResult').textContent, /1\.50/);
});

test('manual calculator edits and clear affect only the selected semester', () => {
    const h = makeHarness();
    h.context.renderGwaCalculator();
    const first = h.rows()[0];
    h.context.updateGwaCalcRow(first.id, 'units', '2');
    h.context.updateGwaCalcRow(first.id, 'grade', '2');
    h.context.addGwaCalcRow();
    const added = h.rows().find(row => row.id !== first.id);
    assert.equal(added.semesterId, 'semester-a');
    h.context.removeGwaCalcRow(added.id);
    assert.equal(h.rows().length, 1);

    h.selectSemester('semester-b');
    h.context.renderGwaCalculator();
    h.context.clearAllGwaRows();
    assert.ok(h.rows().some(row => row.id === first.id && row.semesterId === 'semester-a'));
    assert.equal(h.rows().filter(row => row.semesterId === 'semester-b').length, 1);
});

test('pre-semester manual calculator entries are preserved and assigned to the current workspace once', () => {
    const h = makeHarness();
    h.context.DB.saveGwaCalcRows([{ id: 'legacy', label: 'BIO 101', units: 3, grade: 2 }]);
    h.context.renderGwaCalculator();
    const legacy = h.rows().find(row => row.id === 'legacy');
    assert.equal(legacy.semesterId, 'semester-a');
    assert.match(h.element('gwaCalcRows').innerHTML, /BIO 101/);
});

test('manual GWA validates entries and computes the unit-weighted mean', () => {
    const h = makeHarness();
    const ctx = h.context;
    assert.equal(vm.runInNewContext('computeManualGwa([{units: 3, grade: 2}, {units: 1, grade: 4}])', ctx), 2.5);
    assert.equal(vm.runInNewContext('computeManualGwa([{units: 0, grade: 2}, {units: -1, grade: 1}])', ctx), null);
});

test('assessment aggregation and official GWA use saved weighted scores and subject units', () => {
    const h = makeHarness();
    const result = vm.runInNewContext(`(() => {
      const subject = {id:'subject-a', semesterId:'semester-a', units:3};
      const grade = {subjectId:'subject-a', semesterId:'semester-a', components:[
        {weight:40, assessments:[{score:8,totalItems:10},{score:45,totalItems:50}]},
        {weight:60, assessments:[{score:90,totalItems:100}]},
        {weight:0, assessments:[]}
      ]};
      return {pct: computeSubjectFinalPct(grade.components), summary: computeSemesterGWA([subject], [grade])};
    })()`, h.context);
    assert.ok(Math.abs(result.pct - 89.3333333333) < 1e-8);
    assert.ok(Math.abs(result.summary.gwa - 1.5) < 1e-8);
    assert.equal(result.summary.scoredRows.length, 1);
});

test('manual calculator data is not an input to official semester GWA', () => {
    const source = read('assets/js/services/gwa.js');
    const semesterFn = source.match(/function computeSemesterGWA\([\s\S]*?\n}/)[0];
    assert.doesNotMatch(semesterFn, /gwaCalc|GwaCalc/);
    assert.match(semesterFn, /subjectId === s\.id && x\.semesterId === s\.semesterId/);
    const h = makeHarness();
    const result = vm.runInNewContext(`computeSemesterGWA(
      [{id:'subject-a', semesterId:'semester-a', units:3}],
      [{subjectId:'subject-a', semesterId:'semester-old', components:[{weight:100, assessments:[{score:100,totalItems:100}]}]}]
    )`, h.context);
    assert.equal(result.gwa, null);
    assert.equal(result.scoredRows.length, 0);
});

test('server sync requires a valid semester and course data for manual entries', () => {
    const source = read('assets/js/data/cloud-sync.js');
    const predicate = source.match(/function isSyncableGwaRow\(r\) \{[\s\S]*?\n    }/)[0];
    assert.match(predicate, /!r\.semesterId/);
    assert.match(predicate, /units > 0/);
    assert.match(predicate, /n >= 1 && n <= 5/);
    assert.match(source, /semester_id: requireServerSemesterId\(r\.semesterId, 'the GWA calculator entry'\)/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/shared/subject-modal.js', 'utf8');

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.value = '';
        this.hidden = false;
        this.dataset = {};
        this.attributes = {};
        this.listeners = new Map();
        this.classes = new Set();
        this.classList = {
            add: name => this.classes.add(name),
            remove: name => this.classes.delete(name),
            toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
        };
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelectorAll(selector) {
        if (selector === '.day-check:checked') return this.days.filter(day => day.checked);
        if (selector === '.day-check') return this.days;
        return [];
    }
    querySelector(selector) {
        if (selector === '.day-check') return this.days[0] || null;
        if (selector === '[onclick="saveSubject()"]') return this.saveButton || null;
        return null;
    }
    focus() {}
}

class FakeBody extends FakeElement {
    constructor(elements) { super('subjectModalBody'); this.elements = elements; }
    set innerHTML(html) {
        this.html = html;
        for (const id of this.elements.keys()) {
            if (!['subjectModal', 'subjectModalBody', 'subjectModalTitle'].includes(id))
                this.elements.delete(id);
        }
        for (const tag of html.match(/<[^>]+>/g) || []) {
            const id = tag.match(/\bid="([^"]+)"/);
            if (!id) continue;
            const element = new FakeElement(id[1]);
            const value = tag.match(/\bvalue="([^"]*)"/);
            if (value) element.value = value[1]
                .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            if (/\bchecked(?:\s|>)/.test(tag)) element.checked = true;
            this.elements.set(element.id, element);
        }
        const days = [];
        for (const tag of html.match(/<input\b[^>]*class="day-check"[^>]*>/g) || []) {
            const value = tag.match(/\bvalue="([^"]+)"/);
            if (value) days.push({ value: value[1], checked: /\bchecked(?:\s|>)/.test(tag), focus() {} });
        }
        const dayGroup = this.elements.get('subDaysGroup');
        if (dayGroup) dayGroup.days = days;
        const select = html.match(/<select\b[^>]*id="subType"[^>]*>([\s\S]*?)<\/select>/);
        if (select) {
            const chosen = select[1].match(/<option\b[^>]*selected[^>]*>([^<]*)/);
            this.elements.get('subType').value = chosen ? chosen[1] : 'Lecture';
        }
        const textarea = html.match(/<textarea\b[^>]*id="subNotes"[^>]*>([\s\S]*?)<\/textarea>/);
        if (textarea) this.elements.get('subNotes').value = textarea[1];
    }
    get innerHTML() { return this.html; }
    querySelector(selector) {
        const id = selector.match(/^#(.+)$/);
        return id ? this.elements.get(id[1]) || null : null;
    }
}

function createHarness(initialSubjects = []) {
    const elements = new Map();
    const modal = new FakeElement('subjectModal');
    modal.saveButton = new FakeElement('saveSubjectButton');
    elements.set('subjectModal', modal);
    const body = new FakeBody(elements);
    elements.set(body.id, body);
    elements.set('subjectModalTitle', new FakeElement('subjectModalTitle'));
    const saved = { subjects: initialSubjects.map(subject => ({ ...subject })) };
    let nextId = 1;
    const events = [];
    const context = vm.createContext({
        document: {
            body: new FakeElement('body'),
            getElementById: id => elements.get(id) || null,
            querySelectorAll: () => [],
            dispatchEvent: event => events.push(event.type),
        },
        DB: {
            colors: ['#123456'],
            getSubject: id => saved.subjects.find(subject => subject.id === id) || null,
            getSubjects: () => saved.subjects,
            getActiveSemester: () => ({ id: 'semester-1', name: 'First Semester', schoolYear: '2026-2027' }),
            getActiveSemesterId: () => 'semester-1',
            uid: () => `new-${nextId++}`,
            async saveSubjectsAndSync(subjects) { saved.subjects = subjects; return { ok: true }; },
        },
        TimeField: {
            html: ({ id, value }) => `<input id="${id}" value="${value || ''}">`,
            init() {},
            validate() {},
        },
        bootstrap: {
            Modal: class {
                constructor() {}
                show() {}
                static getInstance() { return { hide() {} }; }
            },
        },
        Toast: { show() {} },
        escHtml: value => String(value ?? ''),
        fmtTime: value => value,
        CustomEvent: class { constructor(type) { this.type = type; } },
    });
    vm.runInContext(`${source}\n;({ openSubjectModal, saveSubject });`, context);
    const api = vm.runInContext('({ openSubjectModal, saveSubject })', context);
    function open(id) {
        api.openSubjectModal(id);
        const dayGroup = elements.get('subDaysGroup');
        if (dayGroup.days.length && !dayGroup.days.some(day => day.checked)) dayGroup.days[0].checked = true;
        const defaults = {
            subCode: 'CS101', subDesc: 'Introduction to Computing', subType: 'Lecture',
            subUnits: '3', subStart: '09:00', subEnd: '10:00', subProf: 'Professor',
            subEmail: 'professor@example.edu', subColor: '#123456', subNotes: '',
        };
        for (const [id, value] of Object.entries(defaults)) {
            const input = elements.get(id);
            if (input && !input.value) input.value = value;
        }
    }
    return { saved, elements, body, events, open, save: () => api.saveSubject() };
}

test('new subjects omit removed controls and keep the established section and online defaults', async () => {
    const harness = createHarness();
    harness.open();
    assert.doesNotMatch(harness.body.innerHTML, /subOnline|subSection|Online Class|Section/);
    await harness.save();

    assert.equal(harness.saved.subjects.length, 1);
    assert.equal(harness.saved.subjects[0].online, false);
    assert.equal(harness.saved.subjects[0].section, '');
    assert.equal(harness.saved.subjects[0].room, '');
    assert.equal(harness.saved.subjects[0].building, '');
    assert.deepEqual(harness.events, ['subjects:changed']);
});

test('editing preserves online, section, room, building, and unrelated subject properties', async () => {
    const original = {
        id: 'subject-1', code: 'CS101', desc: 'Intro', type: 'Lecture', units: 3,
        days: ['Mon'], start: '09:00', end: '10:00', room: '302', building: 'Engineering',
        section: 'BSCS-1A', online: true, archived: true, semesterId: 'old-semester',
        source: 'manual', setupStatus: 'custom-state', curriculumKey: 'keep-me', customProperty: { keep: true },
    };
    const harness = createHarness([original]);
    harness.open(original.id);

    assert.doesNotMatch(harness.body.innerHTML, /subOnline|subSection|Online Class|Section/);
    assert.equal(harness.elements.get('subRoom').value, '302');
    assert.equal(harness.elements.get('subBuilding').value, 'Engineering');
    harness.elements.get('subCode').value = 'CS102';
    await harness.save();

    const updated = harness.saved.subjects[0];
    assert.equal(updated.code, 'CS102');
    assert.equal(updated.online, true);
    assert.equal(updated.section, 'BSCS-1A');
    assert.equal(updated.room, '302');
    assert.equal(updated.building, 'Engineering');
    assert.equal(updated.archived, true);
    assert.equal(updated.semesterId, 'old-semester');
    assert.equal(updated.setupStatus, 'custom-state');
    assert.equal(updated.curriculumKey, 'keep-me');
    assert.deepEqual(updated.customProperty, { keep: true });
});

test('calendar subject editing no longer renders or reads Section and merges edits into existing records', () => {
    const calendar = fs.readFileSync('assets/js/modules/calendar.js', 'utf8');
    const modalStart = calendar.indexOf('function openScheduleModal(');
    const saveStart = calendar.indexOf('function saveScheduleEntry() {');
    const deleteStart = calendar.indexOf('function deleteScheduleEntry(');
    const modalSource = calendar.slice(modalStart, saveStart);
    const saveSource = calendar.slice(saveStart, deleteStart);
    const editBranch = saveSource.match(/if \(id\) \{([\s\S]*?)\n    \}\n    else/)[1];

    assert.doesNotMatch(modalSource, /Section|csSection/);
    assert.doesNotMatch(saveSource, /csSection/);
    assert.doesNotMatch(editBranch, /section:/);
    assert.match(editBranch, /subjects\[idx\]\s*=\s*\{\s*\.\.\.subjects\[idx\],\s*\.\.\.data\s*\}/);
    assert.match(saveSource, /section:\s*''\s*,\s*online:\s*false/);

    const original = {
        id: 'calendar-subject', code: 'MATH101', section: 'BSIT-1A', online: true,
        room: '201', building: 'Main', archived: true, customProperty: 'preserve',
    };
    const saved = { subjects: [{ ...original }] };
    const fields = {
        csId: original.id, csCode: 'MATH102', csDesc: 'Math', csType: 'Lecture', csUnits: '3',
        csStart: '09:00', csEnd: '10:00', csRoom: '201', csBuilding: 'Main', csProf: 'Professor',
        csEmail: '', csColor: '#123456', csNotes: '', csSemester: 'First Semester', csYear: '2026-2027',
    };
    const calendarContext = vm.createContext({
        csSaving: false,
        calSelectedDate: null,
        document: {
            getElementById: id => ({ value: fields[id] }),
            querySelectorAll: () => [{ value: 'Mon' }],
        },
        DB: {
            getActiveSemesterId: () => 'semester-1',
            getSubjects: () => saved.subjects,
            saveSubjects: subjects => { saved.subjects = subjects; },
            uid: () => 'new-calendar-subject',
        },
        TimeField: { validate: () => true },
        bootstrap: { Modal: { getInstance: () => ({ hide() {} }) } },
        Toast: { show() {} },
        renderCalendar() {},
    });
    vm.runInContext(`${saveSource}; saveScheduleEntry()`, calendarContext);
    assert.equal(saved.subjects[0].code, 'MATH102');
    assert.equal(saved.subjects[0].online, true);
    assert.equal(saved.subjects[0].section, 'BSIT-1A');
    assert.equal(saved.subjects[0].room, '201');
    assert.equal(saved.subjects[0].building, 'Main');
    assert.equal(saved.subjects[0].archived, true);
    assert.equal(saved.subjects[0].customProperty, 'preserve');
});

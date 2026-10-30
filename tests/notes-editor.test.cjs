const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'modules', 'notes.js'), 'utf8');

function text(value) {
    return { nodeType: 3, nodeValue: value, textContent: value };
}

function element(tagName, children = [], options = {}) {
    const classes = new Set(options.classes || []);
    const node = {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        childNodes: children,
        children: children.filter(child => child.nodeType === 1),
        type: options.type,
        checked: options.checked || false,
        href: options.href,
        attributes: Object.assign({}, options.attributes, options.checked ? { checked: '' } : {}),
        classList: {
            contains: name => classes.has(name),
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            toggle: (name, value) => value ? classes.add(name) : classes.delete(name)
        },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : (name === 'href' ? this.href : null); },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute(name) { delete this.attributes[name]; },
        closest(selector) {
            let current = this;
            while (current) {
                if (selector === '.md-checklist-item' && current.classList.contains('md-checklist-item'))
                    return current;
                current = current.parentElement;
            }
            return null;
        },
        querySelector(selector) {
            if (selector === 'input[type="checkbox"]')
                return this.children.find(child => child.tagName === 'INPUT' && child.type === 'checkbox') || null;
            if (selector === '.md-cl-text')
                return this.children.find(child => child.classList.contains('md-cl-text')) || null;
            return null;
        },
        querySelectorAll() { return []; }
    };
    children.forEach(child => { child.parentElement = node; });
    node.textContent = children.map(child => child.textContent || '').join('');
    return node;
}

function createHarness(markdown = '') {
    const editorListeners = {};
    const toolbarListeners = {};
    const commands = [];
    const toolbar = { addEventListener: (type, handler) => { toolbarListeners[type] = handler; } };
    const editor = {
        innerHTML: '',
        dataset: { markdown },
        attributes: {},
        children: [],
        childNodes: [],
        addEventListener: (type, handler) => { editorListeners[type] = handler; },
        setAttribute(name, value) { this.attributes[name] = value; },
        closest: () => ({ querySelector: () => toolbar }),
        contains: () => true,
        focus: () => { document.activeElement = editor; }
    };
    const elements = {
        nContent: editor,
        nId: { value: '' },
        nTitle: { value: 'A note' },
        nCategory: { value: 'Lecture' },
        nPinned: { checked: false },
        nFavorite: { checked: false },
        nSubject: { value: '' },
        nTask: { value: '' }
    };
    const range = {
        selectNodeContents: () => {},
        collapse: () => {},
        cloneRange() { return this; }
    };
    const selection = {
        rangeCount: 0,
        isCollapsed: true,
        removeAllRanges: () => {},
        addRange: () => {}
    };
    const document = {
        activeElement: null,
        getElementById: id => elements[id] || null,
        querySelector: () => null,
        createRange: () => range,
        createTextNode: textNode => text(textNode),
        execCommand: (command, ui, value) => { commands.push({ command, value }); return true; },
        queryCommandState: () => false
    };
    const notes = [];
    let capturedExport = '';
    const context = {
        document,
        window: { getSelection: () => selection, open: () => null },
        URL: {
            createObjectURL: blob => { capturedExport = blob.parts.join(''); return 'blob:note'; },
            revokeObjectURL: () => {}
        },
        Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; } },
        DB: {
            getNotes: () => notes.slice(),
            saveNotes: value => { notes.splice(0, notes.length, ...value); },
            getActiveSemesterId: () => 'semester-1',
            getSubjects: () => [],
            getTasks: () => [],
            uid: () => 'note-1'
        },
        Toast: { show: () => {} },
        bootstrap: { Modal: { getInstance: () => ({ hide: () => {} }) } },
        escapeHtml: value => String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
        calcWordCount: value => String(value || '').trim().split(/\s+/).filter(Boolean).length,
        calcReadingTime: () => '1 min',
        renderNotes: () => {},
        setTimeout: fn => fn(),
        prompt: () => null,
        console
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    context.renderNotes = () => {};
    context.__editor = editor;
    context.__editorListeners = editorListeners;
    context.__toolbarListeners = toolbarListeners;
    context.__commands = commands;
    context.__elements = elements;
    context.__notes = notes;
    context.__getExport = () => capturedExport;
    return context;
}

test('legacy Markdown opens as rendered WYSIWYG headings, emphasis, lists, and checkboxes', () => {
    const app = createHarness('# Heading\n\nA **bold** and *italic* ~~done~~ paragraph.\n\n- [ ] Todo\n- [x] Finished\n\n1. First\n2. Second');
    app.wireNoteEditor(app.__editor);

    assert.match(app.__editor.innerHTML, /<h4 class="md-h">Heading<\/h4>/);
    assert.match(app.__editor.innerHTML, /<strong>bold<\/strong>/);
    assert.match(app.__editor.innerHTML, /<em>italic<\/em>/);
    assert.match(app.__editor.innerHTML, /<del>done<\/del>/);
    assert.match(app.__editor.innerHTML, /<input class="md-checklist-input" type="checkbox"/);
    assert.match(app.__editor.innerHTML, /<ol><li>First<\/li><li>Second<\/li><\/ol>/);
    assert.doesNotMatch(app.__editor.innerHTML, /\*\*|\[ \]|\[x\]/);
    assert.equal(app.__editor.attributes.contenteditable, 'true');
});

test('toolbar actions dispatch rich-text commands instead of inserting Markdown markers', () => {
    const app = createHarness();
    app.wireNoteEditor(app.__editor);

    app.mdToggleInline('**');
    app.mdToggleInline('*');
    app.mdToggleInline('~~');
    app.mdInsertLine('## ');
    app.mdInsertBlock('1. item');
    app.mdInsertBlock('- item');

    assert.deepEqual(app.__commands.map(item => item.command), [
        'bold', 'italic', 'strikeThrough', 'formatBlock', 'insertOrderedList', 'insertUnorderedList'
    ]);
    assert.equal(app.__editor.innerHTML, '');
});

test('rich-text serialization preserves headings, paragraphs, inline formatting, and lists', () => {
    const app = createHarness();
    const documentContent = element('div', [
        element('h5', [text('Topic')]),
        element('p', [
            text('A '), element('strong', [text('bold')]), text(' and '),
            element('em', [text('italic')]), text(' '), element('del', [text('removed')]), text('.')
        ]),
        element('ul', [element('li', [text('One')]), element('li', [text('Two')])]),
        element('ol', [element('li', [text('First')]), element('li', [text('Second')])])
    ]);

    const markdown = app.serializeNoteEditor(documentContent);
    assert.equal(markdown, '## Topic\n\nA **bold** and *italic* ~~removed~~.\n\n- One\n- Two\n\n1. First\n2. Second');
    assert.match(app.renderMarkdown(markdown), /<h5 class="md-h">Topic<\/h5>/);
    assert.match(app.renderMarkdown(markdown), /<strong>bold<\/strong>/);
    assert.match(app.renderMarkdown(markdown), /<ol><li>First<\/li><li>Second<\/li><\/ol>/);
});

test('plain text typed directly in the editor root is included when saved', () => {
    const app = createHarness();
    app.__editor.childNodes = [text('A plain '), element('strong', [text('rich')]), text(' note.')];

    assert.equal(app.serializeNoteEditor(app.__editor), 'A plain **rich** note.');
});

test('checklist state persists across repeated note updates and reloads independently', () => {
    const app = createHarness();
    const firstCheckbox = element('input', [], { type: 'checkbox', checked: false });
    const secondCheckbox = element('input', [], { type: 'checkbox', checked: false });
    const checklist = element('ul', [
        element('li', [
            firstCheckbox,
            element('span', [text('First item')], { classes: ['md-cl-text'] })
        ]),
        element('li', [
            secondCheckbox,
            element('span', [text('Second item')], { classes: ['md-cl-text'] })
        ])
    ], { classes: ['md-checklist'] });
    app.__elements.nId.value = 'note-1';
    app.__elements.nPinned.checked = true;
    app.__elements.nFavorite.checked = true;
    app.__editor.children = [checklist];
    app.__editor.childNodes = [checklist];
    app.__notes.push({
        id: 'note-1', title: 'Checklist', content: '', category: 'Lecture',
        pinned: false, favorite: false, tags: [], updatedAt: Date.now()
    });

    firstCheckbox.checked = true;
    app.updateNoteChecklistInput(firstCheckbox);
    app.saveNote();

    assert.equal(app.__notes[0].content, '- [x] First item\n- [ ] Second item');
    assert.equal(app.__notes[0].pinned, true);
    assert.equal(app.__notes[0].favorite, true);
    let reopened = app.renderMarkdown(app.__notes[0].content, null, true);
    assert.equal((reopened.match(/type="checkbox"/g) || []).length, 2);
    assert.match(reopened, /type="checkbox"[^>]*checked/);
    assert.match(reopened, /md-cl-done">First item/);
    assert.doesNotMatch(reopened, /\[x\]|\[ \]/);

    const firstItemText = checklist.children[0].children[1].childNodes[0];
    firstItemText.nodeValue = 'First item edited';
    firstItemText.textContent = firstItemText.nodeValue;
    checklist.children[0].children[1].textContent = firstItemText.nodeValue;
    app.saveNote();
    assert.equal(app.__notes[0].content, '- [x] First item edited\n- [ ] Second item');

    firstCheckbox.checked = false;
    app.updateNoteChecklistInput(firstCheckbox);
    app.saveNote();
    reopened = app.renderMarkdown(app.__notes[0].content, null, true);
    assert.equal(app.__notes[0].content, '- [ ] First item edited\n- [ ] Second item');
    assert.doesNotMatch(reopened, /type="checkbox"[^>]*checked/);
});

test('numbered descriptions retain spaces, punctuation, and list boundaries through saves', () => {
    const app = createHarness();
    const ordered = element('ol', [
        element('li', [
            element('div', [text('Seeking')]),
            element('div', [text('The stage where we explore life and improve who we are.')])
        ]),
        element('li', [
            element('div', [text('Settling')]),
            element('div', [text('The stage where we find a path that fits us.')])
        ])
    ]);
    app.__editor.children = [ordered];
    app.__editor.childNodes = [ordered];
    app.__elements.nId.value = 'note-1';
    app.__notes.push({ id: 'note-1', title: 'Stages', content: '', category: 'Lecture', tags: [] });

    const originalContent = '1. Seeking The stage where we explore life and improve who we are.\n2. Settling The stage where we find a path that fits us.';
    assert.equal(app.serializeNoteEditor(app.__editor), originalContent);
    app.saveNote();
    for (let index = 0; index < 3; index++) {
        app.saveNote();
        assert.equal(app.__notes[0].content, originalContent);
    }
    assert.equal(app.renderMarkdown(app.__notes[0].content, null, true).match(/<li>/g).length, 2);
});

test('saving and reopening a note retains its rich-text Markdown representation', () => {
    const app = createHarness();
    app.__elements.nId = { value: '' };
    app.__editor.children = [element('p', [text('Paragraph'), element('strong', [text(' bold')])])];
    app.__editor.childNodes = app.__editor.children;
    app.ntCurrentTags = [];
    app.saveNote();

    assert.equal(app.__notes[0].content, 'Paragraph** bold**');
    const reopened = app.renderMarkdown(app.__notes[0].content, null, true);
    assert.match(reopened, /<strong> bold<\/strong>/);
});

test('PDF export keeps formatted paragraphs and lists in semantic HTML', () => {
    const app = createHarness();
    app.__notes.push({
        id: 'note-1', title: 'Export test',
        content: 'Paragraph.\n\n1. First\n2. Second',
        category: 'Lecture', tags: [], updatedAt: Date.now()
    });
    app.exportNotePdf('note-1');

    const html = app.__getExport();
    assert.match(html, /<p class="md-p">Paragraph\.<\/p>/);
    assert.match(html, /<ol><li>First<\/li><li>Second<\/li><\/ol>/);
    assert.match(html, /@page\{size:auto;margin:20mm\}/);
    assert.doesNotMatch(html, /<table\b/i);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/core/soft-navigation.js', 'utf8')
    .replace('export function initSoftNavigation()', 'function initSoftNavigation()')
    // Keep the production import() path but inject its host into this VM test.
    .replace('await import(moduleUrl.href)', 'await importModule(moduleUrl.href)');

class FakeEventTarget {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, callback) {
        const list = this.listeners.get(type) || [];
        list.push(callback);
        this.listeners.set(type, list);
    }
    removeEventListener(type, callback) {
        this.listeners.set(type, (this.listeners.get(type) || []).filter(listener => listener !== callback));
    }
    dispatchEvent(event) {
        event.target ||= this;
        for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
        return true;
    }
    listenerCount(type) { return (this.listeners.get(type) || []).length; }
}

class FakeScript extends FakeEventTarget {
    constructor() {
        super();
        this.tagName = 'SCRIPT';
        this.attributes = [];
        this.attributeValues = new Map();
        this.async = true;
        this.textContent = '';
        this.removed = false;
        this.src = '';
        this.type = '';
    }
    setAttribute(name, value) {
        const lower = name.toLowerCase();
        this.attributeValues.set(lower, String(value));
        const existing = this.attributes.find(attribute => attribute.name.toLowerCase() === lower);
        if (existing) existing.value = String(value);
        else this.attributes.push({ name, value: String(value) });
        if (lower === 'type') this.type = String(value);
        if (lower === 'src') this.src = String(value);
    }
    getAttribute(name) { return this.attributeValues.get(name.toLowerCase()) ?? null; }
    remove() { this.removed = true; }
}

class FakeElement extends FakeEventTarget {
    closest() { return null; }
}

class FakeDocument extends FakeEventTarget {
    constructor() {
        super();
        this.scripts = [];
        this.head = { appendChild: node => this.appendScript(node) };
        this.body = { children: [], classList: { add() {}, remove() {} }, appendChild() {} };
        this.appendBehavior = null;
    }
    createElement(tag) { return tag.toLowerCase() === 'script' ? new FakeScript() : new FakeElement(); }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    getElementById() { return null; }
    appendScript(script) {
        if (this.appendBehavior) this.appendBehavior(script);
        return script;
    }
}

function sourceScript({ src, type = '', text = '', attributes = {} }) {
    const script = {
        src: src || '',
        type,
        textContent: text,
        attributes: Object.entries({ ...(src ? { src } : {}), ...(type ? { type } : {}), ...attributes })
            .map(([name, value]) => ({ name, value: String(value) })),
        getAttribute(name) { return name.toLowerCase() === 'src' ? src || null : attributes[name] ?? null; },
    };
    return script;
}

function makeHarness({ appendBehavior, importModule } = {}) {
    const window = new FakeEventTarget();
    window.location = {
        href: 'https://planner.example/pages/app/dashboard.html',
        origin: 'https://planner.example',
        pathname: '/pages/app/dashboard.html',
        search: '',
        assign() {},
    };
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    const document = new FakeDocument();
    const context = vm.createContext({
        window,
        document,
        location: window.location,
        URL,
        AbortController,
        DOMException,
        EventTarget: FakeEventTarget,
        Element: FakeElement,
        CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
        requestAnimationFrame: callback => callback(),
        console: { error() {} },
        setTimeout,
        clearTimeout,
        importModule: importModule || (async () => {}),
    });
    document.appendBehavior = script => appendBehavior?.(script, context, window, document);
    const runtime = vm.runInContext(`${source}; ({ runPageScripts, loadedScripts, initSoftNavigation, onClick })`, context);
    return { ...runtime, context, window, document };
}

function loadEvent(script) { script.dispatchEvent({ type: 'load' }); }
function resourceError(script) { script.dispatchEvent({ type: 'error' }); }
function runtimeError(window, url, message = 'boom') {
    window.dispatchEvent({ type: 'error', filename: url, message, error: new Error(message) });
}

test('same-origin classic scripts use ordered real script elements with original security attributes', async () => {
    const order = [];
    const harness = makeHarness({ appendBehavior(script, context) {
        assert.equal(script.async, false);
        if (script.src.endsWith('/first.js')) {
            assert.equal(script.getAttribute('integrity'), 'sha384-test');
            assert.equal(script.getAttribute('crossorigin'), 'anonymous');
            assert.equal(script.getAttribute('referrerpolicy'), 'no-referrer');
            setImmediate(() => {
                vm.runInContext('window.executionOrder.push("first")', context);
                loadEvent(script);
            });
        } else {
            setImmediate(() => {
                vm.runInContext('window.executionOrder.push("second")', context);
                loadEvent(script);
            });
        }
    } });
    harness.window.executionOrder = order;
    const scripts = [
        sourceScript({ src: '/assets/first.js', attributes: { integrity: 'sha384-test', crossorigin: 'anonymous', referrerpolicy: 'no-referrer', async: '' } }),
        sourceScript({ src: '/assets/second.js' }),
    ];

    await harness.runPageScripts({ querySelectorAll: () => scripts }, new URL(harness.window.location.href), new AbortController().signal);

    assert.deepEqual(order, ['first', 'second']);
    assert.equal(harness.loadedScripts.has('https://planner.example/assets/first.js'), true);
    assert.equal(harness.loadedScripts.has('https://planner.example/assets/second.js'), true);
});

test('shared external classic scripts execute only once across revisits', async () => {
    let insertions = 0;
    const harness = makeHarness({ appendBehavior(script) {
        insertions++;
        setImmediate(() => loadEvent(script));
    } });
    const scripts = [sourceScript({ src: '/assets/shared.js' })];
    const page = { querySelectorAll: () => scripts };
    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    assert.equal(insertions, 1);
});

test('failed external loads are rejected and their URL is not marked loaded', async () => {
    const harness = makeHarness({ appendBehavior(script) { setImmediate(() => resourceError(script)); } });
    const src = 'https://planner.example/assets/fails.js';
    await assert.rejects(
        harness.runPageScripts({ querySelectorAll: () => [sourceScript({ src: '/assets/fails.js' })] }, new URL(harness.window.location.href), new AbortController().signal),
        /Failed to load script/,
    );
    assert.equal(harness.loadedScripts.has(src), false);
});

test('inline initializers execute on every visit without leaking repeated lexical declarations', async () => {
    const harness = makeHarness({ appendBehavior(script, context) {
        try { vm.runInContext(script.textContent, context); }
        catch (error) { runtimeError(harness.window, `${harness.window.location.href}#soft-navigation-inline`, error.message); }
    } });
    const inline = sourceScript({ text: 'let pageVisitLocal = 1; const pageVisitConstant = 2; window.inlineVisits = (window.inlineVisits || 0) + pageVisitLocal + pageVisitConstant;' });
    const page = { querySelectorAll: () => [inline] };
    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    assert.equal(harness.window.inlineVisits, 6);
});

test('inline handler functions are exposed globally and callable after soft navigation', async () => {
    const handler = { attributes: [{ name: 'onclick', value: 'openGradeInterpModal()' }] };
    const harness = makeHarness({ appendBehavior(script, context) {
        try { vm.runInContext(script.textContent, context); }
        catch (error) { runtimeError(harness.window, `${harness.window.location.href}#soft-navigation-inline`, error.message); }
    } });
    const page = {
        querySelectorAll(selector) {
            if (selector === '*') return [handler];
            return [sourceScript({ text: 'function openGradeInterpModal() { window.gradeModalOpened = true; } function privateInlineHelper() {}' })];
        },
    };

    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    assert.equal(typeof harness.window.openGradeInterpModal, 'function');
    assert.equal(harness.window.privateInlineHelper, undefined);
    vm.runInContext('window.openGradeInterpModal()', harness.context);
    assert.equal(harness.window.gradeModalOpened, true);
});

test('module imports remain ordered between classic scripts and inline initializers', async () => {
    const order = [];
    const harness = makeHarness({
        importModule: async url => { order.push(`module:${new URL(url).pathname}`); },
        appendBehavior(script, context) {
            if (script.src) {
                setImmediate(() => {
                    vm.runInContext('window.scriptOrder.push("classic")', context);
                    loadEvent(script);
                });
            } else {
                vm.runInContext('window.scriptOrder.push("inline")', context);
            }
        },
    });
    harness.window.scriptOrder = order;
    const page = { querySelectorAll: () => [
        sourceScript({ src: '/classic.js' }),
        sourceScript({ src: '/module.js', type: 'module' }),
        sourceScript({ text: 'window.scriptOrder.push("inline")' }),
        sourceScript({ src: '/last.js' }),
    ] };
    await harness.runPageScripts(page, new URL(harness.window.location.href), new AbortController().signal);
    assert.deepEqual(order, ['classic', 'module:/module.js', 'inline', 'classic']);
});

test('runtime exceptions from dynamically inserted classic scripts reject the runner', async () => {
    const harness = makeHarness({ appendBehavior(script, context, window) {
        setImmediate(() => {
            try { vm.runInContext('throw new Error("script exploded")', context, { filename: script.src }); }
            catch (error) { runtimeError(window, script.src, error.message); }
            loadEvent(script);
        });
    } });
    const src = 'https://planner.example/assets/runtime-error.js';
    await assert.rejects(
        harness.runPageScripts({ querySelectorAll: () => [sourceScript({ src: '/assets/runtime-error.js' })] }, new URL(harness.window.location.href), new AbortController().signal),
        /script exploded/,
    );
    assert.equal(harness.loadedScripts.has(src), false);
});

test('runtime exceptions from inline scripts reject the runner', async () => {
    const harness = makeHarness({ appendBehavior(script, context, window) {
        try { vm.runInContext(script.textContent, context); }
        catch (error) { runtimeError(window, `${window.location.href}#soft-navigation-inline`, error.message); }
    } });
    await assert.rejects(
        harness.runPageScripts({ querySelectorAll: () => [sourceScript({ text: 'throw new Error("inline failed")' })] }, new URL(harness.window.location.href), new AbortController().signal),
        /inline failed/,
    );
});

test('initializing soft navigation repeatedly does not duplicate persistent shell listeners', () => {
    const harness = makeHarness();
    harness.initSoftNavigation();
    harness.initSoftNavigation();
    assert.equal(harness.document.listenerCount('click'), 1);
    assert.equal(harness.window.listenerCount('popstate'), 1);
});

test('external load and runtime failures reach the existing full-page fallback', async t => {
    for (const failure of ['load', 'runtime']) {
        await t.test(`${failure} failure`, async () => {
            const assigned = [];
            let resolveFallback;
            const fallbackReached = new Promise(resolve => { resolveFallback = resolve; });
            const harness = makeHarness({ appendBehavior(script, context, window) {
                setImmediate(() => {
                    if (failure === 'load') resourceError(script);
                    else {
                        try { vm.runInContext('throw new Error("page script failed")', context, { filename: script.src }); }
                        catch (error) { runtimeError(window, script.src, error.message); }
                        loadEvent(script);
                    }
                });
            } });
            const currentMain = {
                className: 'main-content', id: 'main-content', children: [],
                querySelector: () => null,
                replaceChildren() {},
            };
            const destinationMain = {
                className: 'main-content', id: 'main-content', childNodes: [],
                ownerDocument: { title: 'Destination · QCU Planner' },
                querySelector: () => null,
            };
            const scripts = [sourceScript({ src: '/assets/page.js' })];
            const parsedPage = {
                title: 'Destination · QCU Planner',
                body: { children: [] },
                querySelector(selector) {
                    if (selector === '.main-content') return destinationMain;
                    if (selector === '#sidebar') return {};
                    if (selector === '.app-shell') return null;
                    return null;
                },
                querySelectorAll(selector) {
                    return selector.startsWith('script') ? scripts : [];
                },
            };
            harness.document.title = 'Current · QCU Planner';
            harness.document.querySelector = selector => selector === '.main-content' ? currentMain : null;
            harness.context.DOMParser = class { parseFromString() { return parsedPage; } };
            harness.context.fetch = async () => ({
                ok: true,
                status: 200,
                headers: { get: () => 'text/html; charset=utf-8' },
                text: async () => '<html></html>',
            });
            harness.window.history = { pushState() {} };
            harness.window.scrollTo = () => {};
            harness.window.matchMedia = () => ({ matches: true });
            harness.window.location.assign = destination => {
                assigned.push(destination);
                resolveFallback();
            };

            const anchor = {
                href: 'https://planner.example/pages/app/tasks.html',
                target: '',
                hasAttribute: () => false,
                getAttribute: name => name === 'href' ? '/pages/app/tasks.html' : null,
            };
            const event = {
                defaultPrevented: false, button: 0,
                metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
                target: { closest: () => anchor },
                preventDefault() { this.defaultPrevented = true; },
            };
            harness.onClick(event);
            await Promise.race([fallbackReached, new Promise(resolve => setTimeout(resolve, 250))]);
            assert.equal(event.defaultPrevented, true);
            assert.deepEqual(assigned, ['https://planner.example/pages/app/tasks.html']);
        });
    }
});

test('inline initializer runtime failures reach the full-page fallback', async () => {
    const assigned = [];
    let resolveFallback;
    const fallbackReached = new Promise(resolve => { resolveFallback = resolve; });
    const harness = makeHarness({ appendBehavior(script, context, window) {
        try { vm.runInContext(script.textContent, context); }
        catch (error) { runtimeError(window, 'https://planner.example/pages/app/tasks.html#soft-navigation-inline', error.message); }
    } });
    const currentMain = {
        className: 'main-content', id: 'main-content', children: [],
        querySelector: () => null,
        replaceChildren() {},
    };
    const destinationMain = {
        className: 'main-content', id: 'main-content', childNodes: [],
        ownerDocument: { title: 'Destination · QCU Planner' },
        querySelector: () => null,
    };
    const scripts = [sourceScript({ text: 'throw new Error("inline page script failed")' })];
    const parsedPage = {
        title: 'Destination · QCU Planner',
        body: { children: [] },
        querySelector(selector) {
            if (selector === '.main-content') return destinationMain;
            if (selector === '#sidebar') return {};
            return null;
        },
        querySelectorAll(selector) { return selector.startsWith('script') ? scripts : []; },
    };
    harness.document.title = 'Current · QCU Planner';
    harness.document.querySelector = selector => selector === '.main-content' ? currentMain : null;
    harness.context.DOMParser = class { parseFromString() { return parsedPage; } };
    harness.context.fetch = async () => ({
        ok: true, status: 200,
        headers: { get: () => 'text/html; charset=utf-8' },
        text: async () => '<html></html>',
    });
    harness.window.history = { pushState() {} };
    harness.window.scrollTo = () => {};
    harness.window.matchMedia = () => ({ matches: true });
    harness.window.location.assign = destination => { assigned.push(destination); resolveFallback(); };
    const anchor = {
        href: 'https://planner.example/pages/app/tasks.html', target: '',
        hasAttribute: () => false,
        getAttribute: name => name === 'href' ? '/pages/app/tasks.html' : null,
    };
    const event = {
        defaultPrevented: false, button: 0,
        metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
        target: { closest: () => anchor },
        preventDefault() { this.defaultPrevented = true; },
    };

    harness.onClick(event);
    await Promise.race([fallbackReached, new Promise(resolve => setTimeout(resolve, 250))]);
    assert.deepEqual(assigned, ['https://planner.example/pages/app/tasks.html']);
});

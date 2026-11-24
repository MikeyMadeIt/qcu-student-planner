const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const layoutSource = fs.readFileSync('assets/js/core/layout.js', 'utf8');
const helperStart = layoutSource.indexOf('function initSoftNavigationDiagnostics() {');
const helperEnd = layoutSource.indexOf('\nfunction initDesktopMainScrollFade', helperStart);
assert.notEqual(helperStart, -1, 'diagnostic initializer exists in layout.js');
assert.notEqual(helperEnd, -1, 'diagnostic initializer has a stable end marker');
const helperSource = layoutSource.slice(helperStart, helperEnd);

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.attributes = {};
        this.style = {};
        this.textContent = '';
        this.children = [];
        this.listeners = {};
        this.hidden = false;
        this.checked = false;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    select() {}
    remove() {}
    querySelector(selector) {
        if (selector === '[data-report]') return this.reportNode ||= new FakeElement('pre');
        if (selector === '[data-events]') return this.eventsNode ||= new FakeElement('pre');
        if (selector === '[data-copy]') return this.copyButton ||= new FakeElement('button');
        if (selector === '[data-pause]') return this.pauseToggle ||= new FakeElement('input');
        if (selector === '[data-continue]') return this.continueButton ||= new FakeElement('button');
        return null;
    }
}

function makeEnvironment(search) {
    const head = new FakeElement('head');
    const body = new FakeElement('body');
    const document = {
        head,
        body,
        createElement: tag => new FakeElement(tag),
        execCommand: () => true,
    };
    const window = { location: { search }, __spSoftNavigationInitialized: false };
    const clipboard = { copied: '', async writeText(value) { this.copied = value; } };
    const context = vm.createContext({
        window,
        document,
        navigator: { clipboard },
        URLSearchParams,
        URL,
        Date,
        Object,
        String,
    });
    const initialize = vm.runInContext(`${helperSource}; initSoftNavigationDiagnostics`, context);
    return { initialize, document, window, clipboard, head, body };
}

test('diagnostics stay disabled without debugNavigation=1 and do not alter page state', () => {
    const env = makeEnvironment('?other=1');
    assert.equal(env.initialize(), null);
    assert.equal(env.window.__spNavigationDiagnostics, undefined);
    assert.equal(env.head.children.length, 0);
    assert.equal(env.body.children.length, 0);
});

test('diagnostic report records import and navigation failures without sensitive URL data', async () => {
    const env = makeEnvironment('?debugNavigation=1');
    const diagnostics = env.initialize();
    assert.ok(diagnostics);
    assert.equal(env.body.children[0].id, 'sp-navigation-debug');

    diagnostics.record('module-import-failed', {
        initialized: false,
        errorName: 'TypeError',
        errorMessage: 'Failed to load https://example.test/path?access_token=private-value#fragment',
    });
    diagnostics.record('internal-link-intercepted', {
        intercepted: true,
        destination: '/pages/app/tasks.html?student=private-value#section',
    });
    diagnostics.record('destination-response', {
        destination: '/pages/app/tasks.html',
        fetchSucceeded: false,
        httpStatus: 503,
        contentType: 'text/html; charset=utf-8',
    });
    diagnostics.record('destination-shell-elements', {
        shellElements: 'destination .main-content=true, current .main-content=true, destination #sidebar=false',
    });
    diagnostics.record('swap-failed', {
        destination: '/pages/app/tasks.html',
        failedStage: 'destination-shell-validation',
        errorName: 'Error',
        errorMessage: 'Destination shell missing',
    });
    diagnostics.record('location-assign-fallback', {
        destination: '/pages/app/tasks.html',
        fallback: true,
        errorName: 'Error',
        errorMessage: 'Destination page could not be loaded',
    });

    const report = diagnostics.report();
    assert.match(report, /Module import: failed/);
    assert.match(report, /Internal link intercepted: yes/);
    assert.match(report, /Destination path: \/pages\/app\/tasks\.html/);
    assert.match(report, /Destination HTML fetch: failed/);
    assert.match(report, /HTTP status: 503/);
    assert.match(report, /destination #sidebar=false/);
    assert.match(report, /Failed stage: destination-shell-validation/);
    assert.match(report, /location\.assign\(\) fallback: triggered/);
    assert.doesNotMatch(report, /private-value|access_token=private-value|#fragment|\?student=/);

    await env.body.children[0].copyButton.listeners.click();
    assert.equal(env.clipboard.copied, report);
});

test('navigation diagnostics recorder is a no-op when the overlay is absent', () => {
    const softNavigation = fs.readFileSync('assets/js/core/soft-navigation.js', 'utf8');
    const start = softNavigation.indexOf('function recordNavigationDiagnostic(');
    const end = softNavigation.indexOf('\n}', start) + 2;
    const recorderSource = softNavigation.slice(start, end);
    const window = {};
    const recorder = vm.runInNewContext(`${recorderSource}; recordNavigationDiagnostic`, { window });
    assert.doesNotThrow(() => recorder('internal-link-intercepted', { intercepted: true }));
    assert.deepEqual(window, {});
});

test('pause disabled allows the caller to execute its fallback immediately', () => {
    const env = makeEnvironment('?debugNavigation=1');
    const diagnostics = env.initialize();
    const panel = env.body.children[0];
    const destination = 'https://planner.example/pages/app/tasks.html?filter=due#today';
    let assigned = '';
    const fallback = () => { assigned = destination; };

    assert.equal(panel.pauseToggle.checked, false);
    const paused = diagnostics.beforeFallback('/pages/app/tasks.html', fallback);
    if (!paused) fallback();

    assert.equal(paused, false);
    assert.equal(assigned, destination);
    assert.match(diagnostics.report(), /location\.assign\(\) fallback: triggered/);
});

test('pause enabled holds fallback until Continue navigation runs the original destination', () => {
    const env = makeEnvironment('?debugNavigation=1');
    const diagnostics = env.initialize();
    const panel = env.body.children[0];
    const originalDestination = 'https://planner.example/pages/app/tasks.html?filter=due#today';
    const assigned = [];
    const paused = diagnostics.beforeFallback('/pages/app/tasks.html', () => assigned.push(originalDestination));

    assert.equal(paused, false, 'pause starts disabled');
    panel.pauseToggle.checked = true;
    const held = diagnostics.beforeFallback('/pages/app/tasks.html', () => assigned.push(originalDestination));
    assert.equal(held, true);
    assert.deepEqual(assigned, []);
    assert.equal(panel.continueButton.hidden, false);
    assert.match(diagnostics.report(), /fallback: paused; awaiting Continue navigation/);

    panel.continueButton.listeners.click();
    assert.deepEqual(assigned, [originalDestination]);
    assert.equal(panel.continueButton.hidden, true);
    assert.match(diagnostics.report(), /location\.assign\(\) fallback: triggered/);
});

test('diagnostics disabled preserves the original immediate navigation fallback', async () => {
    const source = fs.readFileSync('assets/js/core/soft-navigation.js', 'utf8')
        .replace('export function initSoftNavigation()', 'function initSoftNavigation()');
    class FakeEventTarget {
        constructor() { this.listeners = {}; }
        addEventListener(name, callback) { this.listeners[name] = callback; }
    }
    class FakeElement extends FakeEventTarget {
        closest() { return null; }
    }
    const document = new FakeEventTarget();
    document.scripts = [];
    document.body = {};
    const selectors = [];
    document.querySelectorAll = selector => { selectors.push(selector); return []; };
    document.addEventListener = FakeEventTarget.prototype.addEventListener;
    const assigned = [];
    const window = new FakeEventTarget();
    window.location = {
        href: 'https://planner.example/pages/app/dashboard.html',
        origin: 'https://planner.example',
        pathname: '/pages/app/dashboard.html',
        search: '',
        assign: value => assigned.push(value),
    };
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    const context = vm.createContext({
        window,
        document,
        location: window.location,
        URL,
        AbortController,
        Element: FakeElement,
        EventTarget: FakeEventTarget,
        fetch: async () => ({ ok: false, status: 503, headers: { get: () => 'text/html' } }),
        console: { error() {} },
    });
    const initialize = vm.runInContext(`${source}; initSoftNavigation`, context);
    initialize();
    assert.ok(selectors.some(selector => selector.includes(':not(#sp-navigation-debug)')));

    const anchor = {
        href: 'https://planner.example/pages/app/tasks.html',
        target: '',
        hasAttribute: name => name === 'download' ? false : false,
        getAttribute: name => name === 'href' ? '/pages/app/tasks.html' : null,
    };
    const event = {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        target: { closest: () => anchor },
        preventDefault() { this.defaultPrevented = true; },
    };
    document.listeners.click(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(window.__spNavigationDiagnostics, undefined);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(assigned, ['https://planner.example/pages/app/tasks.html']);
});

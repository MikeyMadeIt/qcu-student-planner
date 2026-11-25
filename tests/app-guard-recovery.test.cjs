const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const guardPath = path.join(__dirname, '../assets/js/core/app-guard.js');
const authServicePath = path.join(__dirname, '../assets/js/services/auth-service.js');
const guardSource = fs.readFileSync(guardPath, 'utf8')
    .replace("import('../services/auth-service.js')", 'Promise.resolve({ AuthService: globalThis.__AuthService })')
    .replace("import('../utils/auth-routing.js')", 'Promise.resolve({ needsProfileDetails: globalThis.__needsProfileDetails })');
const authServiceSource = fs.readFileSync(authServicePath, 'utf8')
    .replace("import { getSupabase } from '../core/supabase-client.js';", 'const { getSupabase } = globalThis.__deps;')
    .replace('export const AUTH_NOT_CONFIGURED =', 'const AUTH_NOT_CONFIGURED =')
    .replace('export const AuthService =', 'const AuthService =') + '\nglobalThis.__AuthService = AuthService;';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function createElement() {
    return {
        children: [],
        listeners: {},
        parentNode: null,
        attributes: {},
        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter(item => item !== child);
            child.parentNode = null;
            return child;
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
    };
}

function findById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findById(child, id);
        if (found) return found;
    }
    return null;
}

function createQuery(result) {
    const query = {
        select() { return this; },
        eq() { return this; },
        maybeSingle() { return this; },
        abortSignal(signal) {
            signal.addEventListener('abort', () => {
                const error = signal.reason instanceof Error ? signal.reason : new Error('Aborted');
                error.name = 'AbortError';
                result.reject(error);
            }, { once: true });
            return this;
        },
        then(resolve, reject) { return result.promise.then(resolve, reject); },
    };
    return query;
}

function createRuntime({ sessions, profiles, initialSupabase = true, onRetryScriptLoad, cacheStorage = 'working', parserScript = false }) {
    let nextTimerId = 1;
    let now = 100000;
    const retryScripts = [];
    const deletedCacheUrls = [];
    const timers = new Map();
    const replacements = [];
    const reloads = [];
    const profileRequests = [];
    const scriptElements = [];
    const body = createElement();
    let originalParserScript = null;
    if (parserScript) {
        originalParserScript = createElement();
        originalParserScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
        body.appendChild(originalParserScript);
        scriptElements.push(originalParserScript);
    }
    const head = createElement();
    const appendHeadChild = head.appendChild.bind(head);
    head.appendChild = child => {
        appendHeadChild(child);
        if (child.src) {
            retryScripts.push(child);
            scriptElements.push(child);
            if (onRetryScriptLoad) onRetryScriptLoad(child, windowObject);
        }
        return child;
    };
    const removeHeadChild = head.removeChild.bind(head);
    head.removeChild = child => {
        scriptElements.splice(scriptElements.indexOf(child), 1);
        return removeHeadChild(child);
    };
    const document = {
        head,
        body,
        visibilityState: 'visible',
        listeners: {},
        documentElement: Object.assign(createElement(), {
            classList: {
                values: new Set(),
                add(value) { this.values.add(value); },
                remove(value) { this.values.delete(value); },
                contains(value) { return this.values.has(value); },
            },
        }),
        getElementById() { return null; },
        getElementsByTagName(name) { return name === 'script' ? scriptElements : []; },
        createElement,
        addEventListener(name, callback) { this.listeners[name] = callback; },
    };
    const supabase = {
        auth: {
            getSession() { return sessions.shift().promise; },
        },
        from() {
            const result = profiles.shift();
            profileRequests.push(result);
            return createQuery(result);
        },
    };
    const windowObject = {
        supabase: initialSupabase ? { createClient() {} } : undefined,
        addEventListener() {},
        caches: cacheStorage === 'unavailable' ? undefined : {
            async keys() {
                if (cacheStorage === 'throw-keys') throw new Error('Cache Storage unavailable');
                return ['qcu-planner-v10'];
            },
            async open() {
                if (cacheStorage === 'throw-open') throw new Error('Cache Storage unavailable');
                return { async delete(url) { deletedCacheUrls.push(url); return true; } };
            },
        },
    };
    const FakeDate = class extends Date { static now() { return now; } };
    const context = {
        __deps: { getSupabase: () => supabase },
        __needsProfileDetails: () => false,
        AbortController,
        Date: FakeDate,
        document,
        window: windowObject,
        location: {
            href: 'https://qcu-student-planner.vercel.app/pages/app/dashboard.html?preview=1',
            replace: value => replacements.push(value),
            reload() { reloads.push(this.href); },
        },
        sessionStorage: { setItem() {} },
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        console,
    };
    vm.createContext(context);
    vm.runInContext(authServiceSource, context, { filename: authServicePath });
    const signals = [];
    const originalGetCurrentProfile = context.__AuthService.getCurrentProfile;
    context.__AuthService.getCurrentProfile = options => {
        signals.push(options && options.signal);
        return originalGetCurrentProfile.call(context.__AuthService, options);
    };
    vm.runInContext(guardSource, context, { filename: guardPath });

    return {
        context,
        document,
        profileRequests,
        replacements,
        reloads,
        signals,
        timers,
        fireTimeout(delay) {
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(entry, `expected a ${delay}ms timer`);
            timers.delete(entry[0]);
            entry[1].callback();
        },
        expireLibraryWait() {
            now += 10001;
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === 30);
            assert.ok(entry, 'expected the Supabase-library polling timer');
            timers.delete(entry[0]);
            entry[1].callback();
        },
        retryScripts,
        deletedCacheUrls,
        windowObject,
        parserScript: originalParserScript,
    };
}

async function flushMicrotasks() {
    for (let i = 0; i < 10; i += 1) await new Promise(resolve => setImmediate(resolve));
}

test('protected page validation has a bounded timeout and applies cancellation to session and profile work', () => {
    assert.match(guardSource, /PROFILE_TIMEOUT_MS\s*=\s*15000/);
    assert.match(guardSource, /controller\.abort\(timeoutError\)/);
    assert.match(guardSource, /AuthService\.getCurrentProfile\(\{\s*signal:\s*controller\.signal\s*\}\)/);
    assert.match(authServiceSource, /async getCurrentProfile\(\{ signal \} = \{\}\)/);
    assert.match(authServiceSource, /awaitWithAbort\(supabase\.auth\.getSession\(\), signal\)/);
    assert.match(authServiceSource, /profileQuery\.abortSignal\(signal\)/);
    assert.match(authServiceSource, /awaitWithAbort\(profileQuery, signal\)/);
});

test('timed-out session work is cancelled, retry can succeed, and late results cannot update the page', async () => {
    const originalSession = deferred();
    const retrySession = deferred();
    const retryProfile = deferred();
    const runtime = createRuntime({
        sessions: [originalSession, retrySession],
        profiles: [retryProfile],
    });

    await flushMicrotasks();
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);

    runtime.fireTimeout(15000);
    await flushMicrotasks();
    assert.equal(runtime.signals[0].aborted, true);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /took too long/i);
    assert.equal(runtime.profileRequests.length, 0, 'timed-out session must not continue into profile lookup');

    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 2);

    retrySession.resolve({ data: { session: { user: { id: 'planner-user' } } } });
    await flushMicrotasks();
    assert.equal(runtime.profileRequests.length, 1);

    retryProfile.resolve({
        data: { role: 'student', account_status: 'approved' },
        error: null,
    });
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
    assert.deepEqual(runtime.replacements, []);

    originalSession.resolve({ data: { session: { user: { id: 'late-user' } } } });
    await flushMicrotasks();
    assert.equal(runtime.profileRequests.length, 1, 'late cancelled session must not start a profile query');
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
    assert.deepEqual(runtime.replacements, [], 'stale results must not redirect or change the page');
});

test('timed-out profile work is aborted and a late profile result cannot override the retry', async () => {
    const originalProfile = deferred();
    const retryProfile = deferred();
    const runtime = createRuntime({
        sessions: [
            { promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) },
            { promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) },
        ],
        profiles: [originalProfile, retryProfile],
    });

    await flushMicrotasks();
    assert.equal(runtime.profileRequests.length, 1);
    const originalSignal = runtime.signals[0];

    runtime.fireTimeout(15000);
    await flushMicrotasks();
    assert.equal(originalSignal.aborted, true);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);

    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 2);
    assert.equal(runtime.profileRequests.length, 2);

    retryProfile.resolve({ data: { role: 'student', account_status: 'approved' }, error: null });
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);

    originalProfile.resolve({ data: { role: 'suspended', account_status: 'suspended' }, error: null });
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
    assert.deepEqual(runtime.replacements, [], 'stale profile data must not redirect the approved retry');
});

test('repeated retry clicks do not overlap a pending profile validation', async () => {
    const initialProfile = deferred();
    const retryProfile = deferred();
    const runtime = createRuntime({
        sessions: [
            { promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) },
            { promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) },
        ],
        profiles: [initialProfile, retryProfile],
    });

    await flushMicrotasks();
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.profileRequests.length, 1);

    initialProfile.resolve({ data: null, error: { message: 'Failed to fetch' } });
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    assert.equal(retryButton.disabled, false);

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 2);
    assert.equal(runtime.profileRequests.length, 2);
    assert.equal(retryButton.disabled, true, 'the retry control stays disabled during validation');

    retryButton.listeners.click();
    retryButton.listeners.click();
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 2, 'repeated clicks must not start another AuthService request');
    assert.equal(runtime.profileRequests.length, 2, 'only one profile request may remain active');

    retryProfile.resolve({ data: { role: 'student', account_status: 'approved' }, error: null });
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
    assert.deepEqual(runtime.replacements, [], 'the successful retry must leave the approved student on the dashboard');
    assert.equal(runtime.signals.length, 2);
    assert.equal(runtime.profileRequests.length, 2);
});


test('retry after Supabase library timeout reloads only the missing SDK and can reveal the dashboard', async () => {
    const runtime = createRuntime({
        initialSupabase: false,
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
        onRetryScriptLoad(script, windowObject) {
            windowObject.supabase = { createClient() {} };
            script.onload();
        },
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /services did not finish loading/i);
    assert.equal(runtime.signals.length, 0, 'profile validation must not run without the Supabase SDK');

    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();

    assert.equal(runtime.retryScripts.length, 1);
    assert.equal(runtime.retryScripts[0].src, 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    assert.deepEqual(runtime.deletedCacheUrls, [runtime.retryScripts[0].src]);
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.profileRequests.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
});


test('cache failure, script error, and missing global recover on a later SDK load', async () => {
    let loadCount = 0;
    const runtime = createRuntime({
        initialSupabase: false,
        cacheStorage: 'throw-keys',
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
        onRetryScriptLoad(script, windowObject) {
            loadCount += 1;
            if (loadCount === 1) {
                script.onerror();
            } else if (loadCount === 2) {
                script.onload(); // HTTP load event without the expected UMD global.
            } else if (loadCount === 3) {
                windowObject.supabase = { createClient() {} };
                script.onload();
            }
        },
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 1, 'cache errors must not prevent a script request');
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /could not load planner services/i);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 2);
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /could not load planner services/i);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 3);
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.profileRequests.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);

    // Late events from settled older scripts cannot replace the active SDK state.
    runtime.retryScripts[1].onerror();
    runtime.retryScripts[0].onload();
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
});


test('a stale SDK event cannot replace a newer active load', async () => {
    const runtime = createRuntime({
        initialSupabase: false,
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
        onRetryScriptLoad(script) {
            if (runtime.retryScripts.length === 1) script.onerror();
        },
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 1);

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 2);
    assert.equal(retryButton.disabled, true);

    runtime.retryScripts[0].onload();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 2, 'the stale event must not clear or replace the active second script');
    assert.equal(retryButton.disabled, true);
    assert.equal(runtime.windowObject.supabase, undefined);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);

    runtime.windowObject.supabase = { createClient() {} };
    runtime.retryScripts[1].onload();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.profileRequests.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
});

test('an unavailable Cache Storage API does not block the SDK network request', async () => {
    const runtime = createRuntime({
        initialSupabase: false,
        cacheStorage: 'unavailable',
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
        onRetryScriptLoad(script, windowObject) {
            windowObject.supabase = { createClient() {} };
            script.onload();
        },
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    findById(runtime.document.body, 'appGuardRecovery').children[0].children[2].listeners.click();
    await flushMicrotasks();

    assert.equal(runtime.retryScripts.length, 1);
    assert.equal(runtime.signals.length, 1);
    assert.equal(runtime.profileRequests.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
});

test('a permanently pending SDK request offers explicit reload without injecting a competitor', async () => {
    const runtime = createRuntime({
        initialSupabase: false,
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 1);
    retryButton.listeners.click();
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 1, 'clicks during an active SDK attempt must not inject another script');

    runtime.expireLibraryWait();
    await flushMicrotasks();
    assert.equal(retryButton.disabled, false);
    assert.equal(retryButton.textContent, 'Reload dashboard');
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /reload the dashboard/i);
    assert.deepEqual(runtime.reloads, [], 'the dashboard must not reload until the student clicks');
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 1, 'a timed-out pending request must not be raced by a second script');
    assert.deepEqual(runtime.deletedCacheUrls, [runtime.retryScripts[0].src, runtime.retryScripts[0].src]);
    assert.deepEqual(runtime.reloads, [runtime.context.location.href]);
    assert.equal(runtime.signals.length, 0, 'protected content remains hidden until a fresh page verifies the account');
    assert.equal(runtime.profileRequests.length, 0);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);
});


test('a stalled parser-inserted SDK offers reload and preserves the dashboard URL', async () => {
    const runtime = createRuntime({
        initialSupabase: false,
        parserScript: true,
        sessions: [{ promise: Promise.resolve({ data: { session: { user: { id: 'planner-user' } } } }) }],
        profiles: [{ promise: Promise.resolve({ data: { role: 'student', account_status: 'approved' }, error: null }) }],
    });

    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    assert.equal(retryButton.textContent, 'Reload dashboard');
    assert.equal(runtime.retryScripts.length, 0, 'the parser-inserted pending request must not be duplicated');
    assert.deepEqual(runtime.reloads, [], 'the dashboard must not reload automatically');
    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.retryScripts.length, 0);
    assert.deepEqual(runtime.reloads, [runtime.context.location.href]);
    assert.deepEqual(runtime.deletedCacheUrls, ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js']);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);
    assert.equal(runtime.signals.length, 0);
});

test('Cache Storage failure does not block explicit dashboard reload recovery', async () => {
    const runtime = createRuntime({ initialSupabase: false, parserScript: true, cacheStorage: 'throw-keys', sessions: [], profiles: [] });
    await flushMicrotasks();
    runtime.expireLibraryWait();
    await flushMicrotasks();
    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    assert.equal(retryButton.textContent, 'Reload dashboard');

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.deepEqual(runtime.reloads, [runtime.context.location.href]);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), true);
    assert.equal(runtime.retryScripts.length, 0);
});

test('a second validation timeout can be retried and late results from both timed-out attempts stay inert', async () => {
    const firstSession = deferred();
    const secondSession = deferred();
    const thirdSession = deferred();
    const thirdProfile = deferred();
    const runtime = createRuntime({
        sessions: [firstSession, secondSession, thirdSession],
        profiles: [thirdProfile],
    });

    await flushMicrotasks();
    const firstSignal = runtime.signals[0];
    runtime.fireTimeout(15000);
    await flushMicrotasks();
    assert.equal(firstSignal.aborted, true);

    const retryButton = findById(runtime.document.body, 'appGuardRecovery').children[0].children[2];
    retryButton.listeners.click();
    await flushMicrotasks();
    const secondSignal = runtime.signals[1];
    assert.equal(retryButton.disabled, true);

    runtime.fireTimeout(15000);
    await flushMicrotasks();
    assert.equal(secondSignal.aborted, true);
    assert.equal(retryButton.disabled, false);
    assert.match(findById(runtime.document.body, 'appGuardRecoveryMessage').textContent, /took too long/i);

    retryButton.listeners.click();
    await flushMicrotasks();
    assert.equal(runtime.signals.length, 3);
    thirdSession.resolve({ data: { session: { user: { id: 'planner-user' } } } });
    await flushMicrotasks();
    thirdProfile.resolve({ data: { role: 'student', account_status: 'approved' }, error: null });
    await flushMicrotasks();
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);

    firstSession.resolve({ data: { session: { user: { id: 'late-first' } } } });
    secondSession.resolve({ data: { session: { user: { id: 'late-second' } } } });
    await flushMicrotasks();
    assert.equal(runtime.profileRequests.length, 1);
    assert.equal(runtime.document.documentElement.classList.contains('app-guard-pending'), false);
    assert.equal(findById(runtime.document.body, 'appGuardRecovery'), null);
    assert.deepEqual(runtime.replacements, []);
});

test('getCurrentProfile remains compatible with callers that do not pass a signal', async () => {
    const profile = { id: 'planner-user', role: 'student', account_status: 'approved' };
    const supabase = {
        auth: { getSession: async () => ({ data: { session: { user: { id: profile.id } } } }) },
        from() {
            return {
                select() { return this; },
                eq() { return this; },
                maybeSingle: async () => ({ data: profile, error: null }),
            };
        },
    };
    const context = { __deps: { getSupabase: () => supabase }, console };
    vm.createContext(context);
    vm.runInContext(authServiceSource, context, { filename: authServicePath });

    const result = await context.__AuthService.getCurrentProfile();
    assert.equal(result.ok, true);
    assert.equal(result.data, profile);
});

test('protected content stays hidden on validation failures and retry attempts are guarded', () => {
    assert.match(guardSource, /document\.documentElement\.classList\.add\(HIDE_CLASS\)/);
    assert.match(guardSource, /function reveal\(\)[\s\S]*?classList\.remove\(HIDE_CLASS\)/);
    assert.match(guardSource, /setAttribute\('role', 'alert'\)/);
    assert.match(guardSource, /retry\.addEventListener\('click', handleRecoveryAction\)/);
    assert.match(guardSource, /location\.reload\(\)/);
    assert.match(guardSource, /if \(checking\) return/);
    assert.match(guardSource, /NETWORK_ERROR/);
    assert.match(guardSource, /NO_SESSION[\s\S]*?NO_PROFILE[\s\S]*?ACCOUNT_UNAUTHORIZED/);
});

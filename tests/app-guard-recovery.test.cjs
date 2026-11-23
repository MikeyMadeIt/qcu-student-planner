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

function createRuntime({ sessions, profiles }) {
    let nextTimerId = 1;
    const timers = new Map();
    const replacements = [];
    const profileRequests = [];
    const document = {
        head: createElement(),
        body: createElement(),
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
    const context = {
        __deps: { getSupabase: () => supabase },
        __needsProfileDetails: () => false,
        AbortController,
        document,
        window: {
            supabase: { createClient() {} },
            addEventListener() {},
        },
        location: { replace: value => replacements.push(value) },
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
        signals,
        timers,
        fireTimeout(delay) {
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(entry, `expected a ${delay}ms timer`);
            timers.delete(entry[0]);
            entry[1].callback();
        },
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
    assert.match(guardSource, /retry\.addEventListener\('click', check\)/);
    assert.match(guardSource, /if \(checking\) return/);
    assert.match(guardSource, /NETWORK_ERROR/);
    assert.match(guardSource, /NO_SESSION[\s\S]*?NO_PROFILE[\s\S]*?ACCOUNT_UNAUTHORIZED/);
    assert.doesNotMatch(guardSource, /location\.reload\s*\(/);
});

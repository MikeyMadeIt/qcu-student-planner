const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerSource = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
const sdkUrl = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

function makeWorker(fetchImpl, initialEntries = []) {
    const listeners = {};
    const operations = [];
    const clone = response => {
        if (!response) return response;
        const copy = response.clone();
        Object.defineProperties(copy, {
            url: { value: response.url },
            redirected: { value: response.redirected },
        });
        return copy;
    };
    const entries = new Map(initialEntries.map(([url, response]) => [url, clone(response)]));
    const getKey = request => typeof request === 'string' ? request : request.url;
    const cache = {
        async match(request) {
            operations.push(['cache.match', getKey(request)]);
            return clone(entries.get(getKey(request)));
        },
        async put(request, response) {
            operations.push(['cache.put', getKey(request)]);
            entries.set(getKey(request), clone(response));
        },
        async delete(request) {
            operations.push(['cache.delete', getKey(request)]);
            return entries.delete(getKey(request));
        },
    };
    const caches = {
        async open(name) {
            assert.equal(name, 'qcu-planner-v10');
            return cache;
        },
        async match(request) {
            operations.push(['caches.match', getKey(request)]);
            return clone(entries.get(getKey(request)));
        },
        async keys() { return ['qcu-planner-v10']; },
        async delete() { return true; },
    };
    const self = {
        location: { origin: 'https://qcu-student-planner.vercel.app' },
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
        addEventListener(type, listener) { listeners[type] = listener; },
    };
    vm.runInNewContext(workerSource, { self, caches, fetch: fetchImpl, URL, Request, Response, Promise });

    return {
        entries,
        operations,
        async fetch(request) {
            let responsePromise;
            listeners.fetch({
                request,
                respondWith(value) { responsePromise = Promise.resolve(value); },
            });
            assert.ok(responsePromise, `service worker did not intercept ${request.url}`);
            return responsePromise;
        },
    };
}

function sdkResponse(body = 'window.supabase = { createClient() {} };', {
    url = sdkUrl,
    redirected = false,
    status = 200,
    contentType = 'application/javascript; charset=utf-8',
} = {}) {
    const response = new Response(body, { status, headers: { 'Content-Type': contentType } });
    Object.defineProperties(response, {
        url: { value: url },
        redirected: { value: redirected },
    });
    return response;
}

test('valid Supabase SDK network response is returned and cached', async () => {
    const fetched = [];
    const worker = makeWorker(async request => {
        fetched.push({
            url: request.url,
            method: request.method,
            mode: request.mode,
            credentials: request.credentials,
            redirect: request.redirect,
            cache: request.cache,
            headers: Array.from(request.headers.entries()),
        });
        return sdkResponse('valid network SDK');
    });

    const response = await worker.fetch(new Request(sdkUrl, {
        mode: 'cors',
        headers: {
            Authorization: 'Bearer should-not-be-forwarded',
            'X-Private-Header': 'should-not-be-forwarded',
        },
    }));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'valid network SDK');
    assert.deepEqual(fetched, [{
        url: sdkUrl,
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-cache',
        headers: [['accept', 'application/javascript, text/javascript;q=0.9, */*;q=0.1']],
    }]);
    assert.equal(await worker.entries.get(sdkUrl).clone().text(), 'valid network SDK');
});

test('redirect mode rejects SDK redirects without caching a response', async () => {
    let redirectMode;
    const worker = makeWorker(async request => {
        redirectMode = request.redirect;
        throw new TypeError('Redirect was rejected.');
    });

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(redirectMode, 'error');
    assert.equal(response.status, 502);
    assert.equal(worker.entries.has(sdkUrl), false);
});

test('a final response URL different from the pinned SDK URL is rejected', async () => {
    const worker = makeWorker(async () => sdkResponse('redirected JavaScript', {
        url: 'https://cdn.jsdelivr.net/npm/another-package/other.js',
        redirected: true,
    }));

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 502);
    assert.equal(worker.entries.has(sdkUrl), false);
});

test('simultaneous requests share one validated SDK fetch and cannot race the cache', async () => {
    let resolveNetwork;
    let signalNetworkStarted;
    const networkStarted = new Promise(resolve => { signalNetworkStarted = resolve; });
    let networkCalls = 0;
    const worker = makeWorker(async () => {
        networkCalls += 1;
        signalNetworkStarted();
        if (networkCalls === 1) {
            return new Promise(resolve => { resolveNetwork = resolve; });
        }
        return new Response('<html>invalid racing response</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        });
    });

    const first = worker.fetch(new Request(sdkUrl, { headers: { Authorization: 'Bearer secret' } }));
    await networkStarted;
    const second = worker.fetch(new Request(sdkUrl));

    assert.equal(networkCalls, 1);
    resolveNetwork(sdkResponse('valid shared SDK'));
    const [firstResponse, secondResponse] = await Promise.all([first, second]);

    assert.equal(await firstResponse.text(), 'valid shared SDK');
    assert.equal(await secondResponse.text(), 'valid shared SDK');
    assert.equal(networkCalls, 1);
    assert.equal(await worker.entries.get(sdkUrl).clone().text(), 'valid shared SDK');
});

test('HTTP 200 HTML response is rejected and never cached', async () => {
    const worker = makeWorker(async () => new Response('<html>error page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    }));

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 502);
    assert.match(await response.text(), /SDK is unavailable/);
    assert.equal(worker.entries.has(sdkUrl), false);
});

test('unexpected JavaScript MIME types are rejected and never cached', async () => {
    const worker = makeWorker(async () => new Response('not a JavaScript MIME type', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }));

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 502);
    assert.equal(worker.entries.has(sdkUrl), false);
});

test('valid cached SDK response is used when the network fails', async () => {
    const worker = makeWorker(async () => { throw new TypeError('Network unavailable'); }, [[sdkUrl, sdkResponse('cached SDK')]]);

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'cached SDK');
});

test('invalid cached SDK response is deleted and never served', async () => {
    const worker = makeWorker(async () => { throw new TypeError('Network unavailable'); }, [[sdkUrl, new Response('<html>cached error</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
    })]]);

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 502);
    assert.match(await response.text(), /SDK is unavailable/);
    assert.equal(worker.entries.has(sdkUrl), false);
    assert.ok(worker.operations.some(([operation, url]) => operation === 'cache.delete' && url === sdkUrl));
});

test('network failure without a valid cached SDK fails safely', async () => {
    const worker = makeWorker(async () => { throw new TypeError('Network unavailable'); });

    const response = await worker.fetch(new Request(sdkUrl));
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.match(await response.text(), /SDK is unavailable/);
});

test('unrelated jsDelivr resources retain cache-first behavior', async () => {
    const otherUrl = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
    let networkCalls = 0;
    const worker = makeWorker(async () => {
        networkCalls += 1;
        throw new Error('cache-first entry should avoid the network');
    }, [[otherUrl, new Response('cached Bootstrap bundle', { status: 200 })]]);

    const response = await worker.fetch(new Request(otherUrl));
    assert.equal(await response.text(), 'cached Bootstrap bundle');
    assert.equal(networkCalls, 0);
});

test('only the exact SDK URL uses the dedicated network-first route', async () => {
    const queryUrl = `${sdkUrl}?cache-variant=1`;
    let networkCalls = 0;
    const worker = makeWorker(async () => {
        networkCalls += 1;
        throw new Error('query variant should retain generic cache-first behavior');
    }, [[queryUrl, new Response('cached query variant', { status: 200 })]]);

    const response = await worker.fetch(new Request(queryUrl));
    assert.equal(await response.text(), 'cached query variant');
    assert.equal(networkCalls, 0);
    assert.ok(worker.operations.some(([operation, url]) => operation === 'caches.match' && url === queryUrl));
    assert.ok(!worker.operations.some(([operation, url]) => operation === 'cache.match' && url === queryUrl));
});

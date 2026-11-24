const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workerSource = fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8');
const iconCssUrl = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css';
const iconFontUrl = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2?dd67030699838ea613ee6dbda90effa6';

function makeWorker(fetchImpl, initialEntries = []) {
    const listeners = {};
    const entries = new Map(initialEntries.map(([url, response]) => [url, response.clone()]));
    const clone = response => response && response.clone();
    const getKey = request => typeof request === 'string' ? request : request.url;
    const cache = {
        async match(request) { return clone(entries.get(getKey(request))); },
        async put(request, response) { entries.set(getKey(request), response.clone()); },
    };
    const caches = {
        async open(name) {
            assert.equal(name, 'qcu-planner-v8');
            return cache;
        },
        async match(request) { return clone(entries.get(getKey(request))); },
        async keys() { return ['qcu-planner-v8']; },
        async delete() { return true; },
    };
    const self = {
        location: { origin: 'https://qcu-student-planner.vercel.app' },
        clients: { claim: async () => {} },
        skipWaiting: async () => {},
        addEventListener(type, listener) { listeners[type] = listener; },
    };
    vm.runInNewContext(workerSource, { self, caches, fetch: fetchImpl, URL, Response, Promise });

    return {
        entries,
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

function validCss(body = '/* valid icon css */') {
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}

function validFont(body = 'valid woff2 bytes') {
    return new Response(body, { status: 200, headers: { 'Content-Type': 'font/woff2' } });
}

test('successful Bootstrap Icons CSS and WOFF2 responses update the v8 cache', async () => {
    const fetched = [];
    const worker = makeWorker(async (request, options) => {
        fetched.push({ url: request.url, cache: options.cache });
        return request.url.includes('.css') ? validCss('new css') : validFont('new font');
    });

    const css = await worker.fetch(new Request(iconCssUrl, { mode: 'cors' }));
    const font = await worker.fetch(new Request(iconFontUrl, { mode: 'cors' }));

    assert.equal(await css.text(), 'new css');
    assert.equal(await font.text(), 'new font');
    assert.deepEqual(fetched, [
        { url: iconCssUrl, cache: 'no-cache' },
        { url: iconFontUrl, cache: 'no-cache' },
    ]);
    assert.equal(await (await worker.entries.get(iconCssUrl).clone()).text(), 'new css');
    assert.equal(await (await worker.entries.get(iconFontUrl).clone()).text(), 'new font');
});

test('HTTP errors and invalid content types fall back without replacing a valid cached response', async () => {
    for (const networkResponse of [
        new Response('upstream error', { status: 503, headers: { 'Content-Type': 'text/css' } }),
        new Response('<html>not css</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    ]) {
        const worker = makeWorker(async () => networkResponse.clone(), [[iconCssUrl, validCss('last good css')]]);
        const response = await worker.fetch(new Request(iconCssUrl, { mode: 'cors' }));

        assert.equal(await response.text(), 'last good css');
        assert.equal(await (await worker.entries.get(iconCssUrl).clone()).text(), 'last good css');
    }
});

test('network failures use a valid cached font and fail normally when no fallback exists', async () => {
    const cachedWorker = makeWorker(async () => { throw new TypeError('Network unavailable'); }, [[iconFontUrl, validFont('cached font')]]);
    const cachedResponse = await cachedWorker.fetch(new Request(iconFontUrl, { mode: 'cors' }));
    assert.equal(await cachedResponse.text(), 'cached font');

    const uncachedWorker = makeWorker(async () => { throw new TypeError('Network unavailable'); });
    await assert.rejects(uncachedWorker.fetch(new Request(iconFontUrl, { mode: 'cors' })), /Network unavailable/);
});

test('other CDN resources keep their existing cache-first behavior', async () => {
    const otherCdnUrl = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
    let networkCalls = 0;
    const worker = makeWorker(async () => {
        networkCalls += 1;
        throw new Error('should use the cache-first hit');
    }, [[otherCdnUrl, new Response('cached bootstrap js', { status: 200 })]]);

    const response = await worker.fetch(new Request(otherCdnUrl));
    assert.equal(await response.text(), 'cached bootstrap js');
    assert.equal(networkCalls, 0);
});

test('every Bootstrap Icons stylesheet reference opts into CORS validation', () => {
    function htmlFiles(directory) {
        return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            if (entry.name === '.git' || entry.name === 'node_modules') return [];
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return htmlFiles(fullPath);
            return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
        });
    }

    const references = [];
    for (const file of htmlFiles(path.join(__dirname, '..'))) {
        const html = fs.readFileSync(file, 'utf8');
        const links = html.match(/<link\b[^>]*href=["']https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap-icons@1\.11\.3\/font\/bootstrap-icons\.css["'][^>]*>/gi) || [];
        links.forEach(link => references.push({ file, link }));
    }

    assert.ok(references.length > 0);
    for (const { file, link } of references) {
        assert.match(link, /crossorigin=["']anonymous["']/i, `${file} icon stylesheet must use anonymous CORS`);
    }
});

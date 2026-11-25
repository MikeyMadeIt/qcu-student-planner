/* QCU Student Planner service worker.
   - Network-first for pages, scripts and styles so updates are never held back by the cache.
   - Cache-first only for images, icons and pinned CDN files.
   - Auth and admin pages and non-GET requests are never cached. */

const CACHE = 'qcu-planner-v10';
const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
let supabaseSdkInFlight = null;
const PRECACHE = [
    'manifest.json',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/icons/lucide-sprite.svg',
];
const NEVER_CACHE = ['/pages/auth/', '/pages/admin/'];
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => { }));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys()
        .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

function store(req, res) {
    if (res && res.status === 200 && !/no-store/i.test(res.headers.get('Cache-Control') || '')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
}

function isSupabaseSdkRequest(url) {
    return url.href === SUPABASE_SDK_URL;
}

function isValidSupabaseSdkResponse(response) {
    if (!response || response.status !== 200 || response.type === 'opaque' ||
        response.redirected || response.url !== SUPABASE_SDK_URL) return false;

    const contentType = (response.headers.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
    return [
        'application/javascript',
        'text/javascript',
        'application/ecmascript',
        'text/ecmascript',
        'application/x-javascript',
    ].includes(contentType);
}

function createSupabaseSdkRequest() {
    return new Request(SUPABASE_SDK_URL, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-cache',
        headers: {
            Accept: 'application/javascript, text/javascript;q=0.9, */*;q=0.1',
        },
    });
}

function supabaseSdkNetworkFirst() {
    if (supabaseSdkInFlight) {
        return supabaseSdkInFlight.then((response) => response.clone());
    }

    const request = supabaseSdkNetworkFirstOnce();
    supabaseSdkInFlight = request;
    return request.then((response) => response.clone()).finally(() => {
        if (supabaseSdkInFlight === request) supabaseSdkInFlight = null;
    });
}

async function supabaseSdkNetworkFirstOnce() {
    const sdkRequest = createSupabaseSdkRequest();
    let cache = null;
    let cached = null;

    try {
        cache = await caches.open(CACHE);
        cached = await cache.match(sdkRequest);
        if (cached && !isValidSupabaseSdkResponse(cached)) {
            await cache.delete(sdkRequest);
            cached = null;
        }
    } catch (error) {
        // Cache Storage is optional for this route; still try the network.
        cache = null;
        cached = null;
    }

    try {
        // This fixed request avoids forwarding headers or credentials from the
        // intercepted page request and makes the cross-origin response readable.
        const response = await fetch(sdkRequest);
        if (!isValidSupabaseSdkResponse(response)) {
            throw new Error('Invalid Supabase SDK response.');
        }

        if (cache) {
            try {
                await cache.put(sdkRequest, response.clone());
            } catch (error) {
                // A valid network response remains usable if caching fails.
            }
        }
        return response;
    } catch (error) {
        if (cached && isValidSupabaseSdkResponse(cached)) return cached;
        return new Response('Supabase SDK is unavailable.', {
            status: 502,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET')
        return;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const isCdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

    if (isSupabaseSdkRequest(url)) {
        event.respondWith(supabaseSdkNetworkFirst(req));
        return;
    }

    if (!sameOrigin && !isCdn)
        return;
    if (sameOrigin && NEVER_CACHE.some((p) => url.pathname.includes(p)))
        return;
    const isStatic = isCdn || /\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);
    if (isStatic) {
        event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
        return;
    }
    event.respondWith(fetch(req).then((res) => store(req, res)).catch(() => caches.match(req).then((hit) => hit || new Response('Offline', { status: 503 }))));
});
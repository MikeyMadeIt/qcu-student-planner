/* QCU Student Planner service worker.
   - Network-first for pages, scripts and styles so updates are never held back by the cache.
   - Cache-first only for images, icons and pinned CDN files.
   - Auth and admin pages and non-GET requests are never cached. */

const CACHE = 'qcu-planner-v7';
const PRECACHE = [
    'manifest.json',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/images/branding/qcu-logo.webp',
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

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET')
        return;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const isCdn = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
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

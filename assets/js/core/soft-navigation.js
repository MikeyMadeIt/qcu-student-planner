/*
 * App-shell navigation for the existing multi-page student/admin app.
 * HTML documents remain directly addressable; this layer only intercepts
 * same-origin links inside the signed-in app shell.
 */
const loadedScripts = new Set(
    [...document.scripts].map(script => script.src).filter(Boolean).map(url => new URL(url, location.href).href)
);
let navigationSequence = 0;
let activeNavigation = null;
let pageScope = null;
const originalSetInterval = window.setInterval.bind(window);

function recordNavigationDiagnostic(eventName, details) {
    try { window.__spNavigationDiagnostics?.record(eventName, details); } catch (error) { /* Diagnostics must not affect navigation. */ }
}

window.setInterval = function (callback, delay, ...args) {
    const timer = originalSetInterval(callback, delay, ...args);
    if (pageScope) pageScope.intervals.push(timer);
    return timer;
};

function installPageListenerScope() {
    if (window.__spPageListenerScopeInstalled) return;
    window.__spPageListenerScopeInstalled = true;
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        const persistentShellTarget = window.__spPersistentEvents === true || (this === window || this === document
            ? false
            : this instanceof Element && Boolean(this.closest('#shellBar, #sidebar, #mobileAppNavMenu')));
        if (!pageScope || persistentShellTarget || (options && typeof options === 'object' && options.signal))
            return original.call(this, type, listener, options);
        const scopedOptions = typeof options === 'boolean'
            ? { capture: options, signal: pageScope.controller.signal }
            : { ...(options || {}), signal: pageScope.controller.signal };
        return original.call(this, type, listener, scopedOptions);
    };
}

function isAppRoute(url) {
    return url.origin === location.origin && /\/pages\/(app|admin)\/[^/]+\.html$/.test(url.pathname);
}

function closeMobileNavigation() {
    const menu = document.getElementById('mobileAppNavMenu');
    if (menu?.classList.contains('is-open') && typeof closeMobileAppNavMenu === 'function')
        closeMobileAppNavMenu();
}

function updateShellForRoute(main, destinationMain, url) {
    const pathname = url.pathname;
    const activeHref = pathname.slice(pathname.lastIndexOf('/') + 1);
    const documentTitle = destinationMain.ownerDocument.title.split('·')[0].trim();
    const title = destinationMain.querySelector('.page-title, .shell-page-title, h1')?.textContent?.trim()
        || destinationMain.querySelector('.section-title')?.textContent?.trim()
        || documentTitle
        || document.title.split('·')[0].trim();
    const titleNode = document.getElementById('shellPageTitle');
    if (titleNode) {
        titleNode.textContent = title;
        titleNode.title = title;
    }
    document.title = destinationMain.ownerDocument.title || 'QCU Student Planner';

    document.querySelectorAll('#sidebar .nav-link[href], #mobileAppNavMenu a[href]').forEach(link => {
        let linkUrl;
        try { linkUrl = new URL(link.getAttribute('href'), location.href); } catch { return; }
        const selected = linkUrl.pathname.endsWith('/' + activeHref);
        link.classList.toggle('active', selected);
        if (selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    const activeSidebarLink = document.querySelector('#sidebar .nav-link.active');
    const activeSidebarGroup = activeSidebarLink && activeSidebarLink.closest('.sidebar-nav-group');
    if (activeSidebarGroup) {
        document.querySelectorAll('#sidebar .sidebar-nav-group').forEach(group => {
            const toggle = group.querySelector('.nav-group-toggle');
            const items = group.querySelector('.sidebar-group-items');
            if (!toggle || !items) return;
            const expanded = group === activeSidebarGroup;
            if (toggle) toggle.setAttribute('aria-expanded', String(expanded));
            if (items) items.hidden = !expanded;
        });
    }
    main.className = destinationMain.className;
    main.id = destinationMain.id || 'main-content';
}

async function updatePageStyles(pageDocument, currentUrl, signal) {
    const styles = [...pageDocument.querySelectorAll('head link[rel="stylesheet"][href]')]
        .map(link => new URL(link.getAttribute('href'), currentUrl))
        .filter(url => url.origin === location.origin && /\/assets\/css\/pages\//.test(url.pathname));
    const keep = new Set();
    const pending = [];

    styles.forEach(url => {
        let link = [...document.querySelectorAll('link[data-soft-nav-style]')]
            .find(item => item.href === url.href);
        if (link) {
            keep.add(link);
            return;
        }
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url.href;
        link.media = 'print'; // Fetch and parse without applying against the old page.
        link.dataset.softNavStyle = 'true';
        keep.add(link);
        pending.push(new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve();
            };
            const timeout = setTimeout(finish, 2500);
            link.addEventListener('load', finish, { once: true });
            link.addEventListener('error', finish, { once: true });
            signal.addEventListener('abort', finish, { once: true });
            document.head.appendChild(link);
        }));
    });

    await Promise.all(pending);
    if (signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
    keep.forEach(link => { link.media = 'all'; });
    document.querySelectorAll('link[data-soft-nav-style]').forEach(link => {
        if (!keep.has(link)) link.remove();
    });
}

function exposeClassicFunctions(source, context) {
    const names = new Set();
    const pattern = /^(?:\s*)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
    let match;
    while ((match = pattern.exec(source))) names.add(match[1]);
    if (!names.size) return;
    const assignments = [...names].map(name => `if (typeof ${name} === 'function') window[${JSON.stringify(name)}] = ${name};`).join('\n');
    try {
        window.__spPersistentEvents = /\/assets\/js\/core\//.test(context);
        new Function(`${source}\n${assignments}\n//# sourceURL=${context}`)();
    }
    catch (error) { console.error(`Could not initialize ${context}`, error); throw error; }
    finally { window.__spPersistentEvents = false; }
}

async function runPageScripts(pageDocument, pageUrl, signal) {
    const scripts = [...pageDocument.querySelectorAll('script[src], script:not([src])')];
    for (const script of scripts) {
        if (signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
        if (script.src) {
            const src = new URL(script.getAttribute('src'), pageUrl).href;
            if (script.type === 'module') {
                const moduleUrl = new URL(src);
                moduleUrl.searchParams.set('soft-nav', String(++navigationSequence));
                await import(moduleUrl.href);
                if (signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
                continue;
            }
            if (loadedScripts.has(src)) continue;
            loadedScripts.add(src);
            if (!new URL(src).origin || new URL(src).origin !== location.origin) {
                await new Promise((resolve, reject) => {
                    window.__spPersistentEvents = true;
                    const external = document.createElement('script');
                    external.src = src;
                    external.onload = () => { window.__spPersistentEvents = false; resolve(); };
                    external.onerror = error => { window.__spPersistentEvents = false; reject(error); };
                    document.head.appendChild(external);
                });
                continue;
            }
            const response = await fetch(src, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(`Failed to load ${src}`);
            const source = await response.text();
            exposeClassicFunctions(source, src);
        } else if (!script.type || script.type === 'text/javascript') {
            const source = script.textContent.trim();
            if (source) {
                try { new Function(`${source}\n//# sourceURL=${pageUrl.href}#inline`)(); }
                catch (error) { console.error('Could not run page initialization script', error); throw error; }
            }
        }
    }
}

async function swapTo(url, { history = true } = {}) {
    let stage = 'destination-fetch';
    recordNavigationDiagnostic('swap-started', { destination: url.pathname, fetchSucceeded: false });
    try {
    if (activeNavigation) activeNavigation.abort();
    const controller = new AbortController();
    activeNavigation = controller;
    const response = await fetch(url.href, { credentials: 'same-origin', signal: controller.signal });
    const contentType = response.headers.get('content-type') || '(missing)';
    const htmlResponse = response.ok && contentType.toLowerCase().includes('text/html');
    recordNavigationDiagnostic('destination-response', {
        destination: url.pathname,
        fetchSucceeded: htmlResponse,
        httpStatus: response.status,
        contentType,
    });
    if (!htmlResponse)
        throw new Error('Destination page could not be loaded as HTML.');
    const html = await response.text();
    if (controller.signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
    stage = 'destination-shell-validation';
    const pageDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = pageDocument.querySelector('.main-content');
    const currentMain = document.querySelector('.main-content');
    const hasSidebar = Boolean(pageDocument.querySelector('#sidebar'));
    const shellElements = `destination .main-content=${Boolean(nextMain)}, current .main-content=${Boolean(currentMain)}, destination #sidebar=${hasSidebar}`;
    recordNavigationDiagnostic('destination-shell-elements', { destination: url.pathname, shellElements });
    if (!nextMain || !currentMain || !hasSidebar)
        throw new Error('Destination does not use the shared app shell.');

    const currentPath = location.pathname;
    stage = 'destination-styles';
    await updatePageStyles(pageDocument, url, controller.signal);
    if (controller.signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
    stage = 'shell-update';
    document.dispatchEvent(new CustomEvent('sp:pageleave', { detail: { from: currentPath, to: url.pathname } }));
    if (pageScope) {
        pageScope.controller.abort();
        pageScope.intervals.forEach(window.clearInterval.bind(window));
    }
    pageScope = { controller: new AbortController(), intervals: [] };
    document.body.classList.add('soft-navigation-active');
    const shellBar = currentMain.querySelector('#shellBar');
    const mobileMenu = document.getElementById('mobileAppNavMenu');
    if (mobileMenu?.classList.contains('is-open') && typeof closeMobileAppNavMenuForNavigation === 'function')
        closeMobileAppNavMenuForNavigation();
    else closeMobileNavigation();
    const contentNodes = [...nextMain.childNodes].map(node => node.cloneNode(true));
    stage = 'page-content-replacement';
    currentMain.replaceChildren(...(shellBar ? [shellBar] : []), ...contentNodes);
    updateShellForRoute(currentMain, nextMain, url);

    document.querySelectorAll('[data-soft-nav-overlay]:not(#sp-navigation-debug)').forEach(node => {
        if (node.id === 'mobileAppNavMenu')
            node.removeAttribute('data-soft-nav-overlay');
        else node.remove();
    });
    document.querySelectorAll('.modal-backdrop, .date-picker-panel').forEach(node => node.remove());
    document.body.classList.remove('modal-open');
    const nextShell = pageDocument.querySelector('.app-shell');
    if (nextShell) {
        [...pageDocument.body.children].filter(node => node !== nextShell).forEach(node => {
            const copy = node.cloneNode(true);
            copy.dataset.softNavOverlay = 'true';
            document.body.appendChild(copy);
        });
    }

    stage = 'history-and-scroll';
    if (history) window.history.pushState({ softNavigation: true }, '', url.href);
    if (url.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView());
    else window.scrollTo({ top: 0, behavior: 'auto' });

    stage = 'destination-scripts';
    window.__spSoftNavigating = true;
    window.__spSoftRouteActive = true;
    try {
        await runPageScripts(pageDocument, url, controller.signal);
        if (typeof enhanceSelects === 'function') enhanceSelects(currentMain);
        if (window.DatePicker && typeof window.DatePicker.init === 'function') window.DatePicker.init(currentMain);
    } finally {
        window.__spSoftNavigating = false;
    }
    document.dispatchEvent(new CustomEvent('sp:pageenter', { detail: { path: url.pathname } }));
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        [...currentMain.children].filter(node => node.id !== 'shellBar').forEach(node => {
            if (typeof node.animate === 'function')
                node.animate([{ opacity: 0.94 }, { opacity: 1 }], {
                    duration: 120, easing: 'ease-out'
                });
        });
    }
    activeNavigation = null;
    recordNavigationDiagnostic('swap-succeeded', { destination: url.pathname });
    } catch (error) {
        recordNavigationDiagnostic('swap-failed', {
            destination: url.pathname,
            failedStage: stage,
            errorName: error?.name || 'Error',
            errorMessage: error?.message || String(error),
        });
        throw error;
    }
}

function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#')) return;
    const url = new URL(anchor.href, location.href);
    if (!isAppRoute(url) || url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    recordNavigationDiagnostic('internal-link-intercepted', { intercepted: true, destination: url.pathname });
    swapTo(url).catch(error => {
        if (error.name === 'AbortError') return;
        console.error('Soft navigation failed; using the page route directly.', error);
        if (window.__spNavigationDiagnostics?.beforeFallback(url.pathname, () => location.assign(url.href))) return;
        location.assign(url.href);
    });
}

export function initSoftNavigation() {
    if (window.__spSoftNavigationInitialized) return;
    window.__spSoftNavigationInitialized = true;
    installPageListenerScope();
    document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/pages/"]').forEach(link => {
        link.dataset.softNavStyle = 'true';
    });
    // The mobile menu and desktop sidebar profile popover are part of the
    // persistent shell even though layout.js mounts them directly on body.
    document.querySelectorAll('body > :not(.app-shell):not(#mobileAppNavMenu):not(#sp-navigation-debug)')
        .forEach(node => node.dataset.softNavOverlay = 'true');
    document.addEventListener('click', onClick);
    if (window.MutationObserver && document.body) {
        new MutationObserver(records => {
            if (!window.DatePicker || typeof window.DatePicker.init !== 'function') return;
            records.forEach(record => record.addedNodes.forEach(node => {
                if (node.nodeType === 1) window.DatePicker.init(node);
            }));
        }).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('popstate', () => {
        const url = new URL(location.href);
        if (!isAppRoute(url)) {
            if (window.__spNavigationDiagnostics?.beforeFallback(url.pathname, () => location.assign(url.href))) return;
            location.assign(url.href);
            return;
        }
        swapTo(url, { history: false }).catch(error => {
            if (window.__spNavigationDiagnostics?.beforeFallback(url.pathname, () => location.reload())) return;
            location.reload();
        });
    });
}

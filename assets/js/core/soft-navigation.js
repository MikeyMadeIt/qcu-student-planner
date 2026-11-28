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
// The page (path + query, never the #hash) that is currently shown.
let currentRoute = '';
const originalSetInterval = window.setInterval.bind(window);

function routeKey(url) {
    return url.pathname + url.search;
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

function copyScriptAttributes(source, destination) {
    for (const attribute of source.attributes || []) {
        const name = attribute.name.toLowerCase();
        // Dynamic scripts are ordered explicitly below; the source's async
        // setting must not re-enable parallel execution.
        if (name === 'src' || name === 'async') continue;
        destination.setAttribute(attribute.name, attribute.value);
    }
}

function scriptRuntimeError(event, expectedUrl) {
    if (event.target !== window) return null;
    // An empty filename cannot be safely attributed to this script (browsers
    // use it for opaque cross-origin errors and unrelated global failures).
    if (!event.filename) return null;
    try {
        if (new URL(event.filename, location.href).href !== expectedUrl) return null;
    } catch { return null; }
    const cause = event.error;
    const error = new Error(event.message || cause?.message || 'Uncaught script runtime error.');
    error.name = cause?.name || 'Error';
    return error;
}

function appendClassicExternalScript(source, src, signal) {
    return new Promise((resolve, reject) => {
        const external = document.createElement('script');
        copyScriptAttributes(source, external);
        external.async = false;
        external.src = src;

        let settled = false;
        let runtimeError = null;
        const previousPersistentEvents = window.__spPersistentEvents === true;
        const persistentScript = new URL(src).origin !== location.origin
            || /\/assets\/js\/core\//.test(new URL(src).pathname);
        const cleanup = () => {
            window.removeEventListener('error', onRuntimeError, true);
            external.removeEventListener('load', onLoad);
            external.removeEventListener('error', onError);
            signal.removeEventListener('abort', onAbort);
            window.__spPersistentEvents = previousPersistentEvents;
        };
        const finish = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            if (error) reject(error);
            else resolve();
        };
        const onRuntimeError = event => {
            const error = scriptRuntimeError(event, src);
            if (error) runtimeError = error;
        };
        const onLoad = () => {
            if (signal.aborted) {
                finish(new DOMException('Navigation superseded.', 'AbortError'));
                return;
            }
            finish(runtimeError);
        };
        const onError = () => finish(new Error(`Failed to load script: ${src}`));
        const onAbort = () => {
            // Removing this exact pending element prevents it from being used
            // by a superseded navigation. It is never treated as a loaded URL.
            external.remove();
            finish(new DOMException('Navigation superseded.', 'AbortError'));
        };

        window.addEventListener('error', onRuntimeError, true);
        external.addEventListener('load', onLoad, { once: true });
        external.addEventListener('error', onError, { once: true });
        signal.addEventListener('abort', onAbort, { once: true });
        if (persistentScript) window.__spPersistentEvents = true;
        if (signal.aborted) {
            onAbort();
            return;
        }
        try { document.head.appendChild(external); }
        catch (error) { finish(error); }
    });
}

function inlineHandlerFunctionNames(pageDocument) {
    const names = new Set();
    pageDocument.querySelectorAll('*').forEach(element => {
        for (const attribute of element.attributes || []) {
            if (!/^on/i.test(attribute.name)) continue;
            const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
            let match;
            while ((match = pattern.exec(attribute.value))) names.add(match[1]);
        }
    });
    return names;
}

function declaredInlineHandlerFunctions(source, handlerNames) {
    // Only expose named declarations that an inline HTML handler actually
    // calls. Keep all other declarations and bindings inside the wrapper.
    const names = [];
    for (const name of handlerNames) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const declaration = new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s+${escapedName}\\s*\\(`);
        if (declaration.test(source)) names.push(name);
    }
    return names;
}

function appendInlineClassicScript(source, pageUrl, handlerNames) {
    const inline = document.createElement('script');
    copyScriptAttributes(source, inline);
    inline.async = false;
    // A function body preserves the isolated lexical scope that the previous
    // Function constructor provided, while the browser executes this as a real
    // inline script under the site's existing script-src policy.
    const exposed = declaredInlineHandlerFunctions(source, handlerNames)
        .map(name => `window[${JSON.stringify(name)}] = ${name};`).join('\n');
    inline.textContent = `(function () {\n${source}\n${exposed}\n}).call(window);\n//# sourceURL=${pageUrl.origin}${pageUrl.pathname}#soft-navigation-inline`;

    let runtimeError = null;
    // This listener covers synchronous execution while appendChild runs.
    // Errors from later callbacks are deliberately outside navigation failure
    // handling because they cannot be reliably attributed to this initializer.
    const onRuntimeError = event => {
        const error = scriptRuntimeError(event, `${pageUrl.origin}${pageUrl.pathname}#soft-navigation-inline`);
        if (error) runtimeError = error;
    };
    window.addEventListener('error', onRuntimeError, true);
    try { document.head.appendChild(inline); }
    catch (error) { runtimeError = error; }
    finally {
        window.removeEventListener('error', onRuntimeError, true);
        inline.remove();
    }
    if (runtimeError) throw runtimeError;
}

async function runPageScripts(pageDocument, pageUrl, signal) {
    const scripts = [...pageDocument.querySelectorAll('script[src], script:not([src])')];
    const handlerNames = inlineHandlerFunctionNames(pageDocument);
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
            await appendClassicExternalScript(script, src, signal);
            loadedScripts.add(src);
        } else if (!script.type || script.type === 'text/javascript') {
            const source = script.textContent.trim();
            if (source) appendInlineClassicScript(source, pageUrl, handlerNames);
        }
    }
}

async function swapTo(url, { history = true } = {}) {
    if (activeNavigation) activeNavigation.abort();
    const controller = new AbortController();
    activeNavigation = controller;
    const response = await fetch(url.href, { credentials: 'same-origin', signal: controller.signal });
    const contentType = response.headers.get('content-type') || '(missing)';
    const htmlResponse = response.ok && contentType.toLowerCase().includes('text/html');
    if (!htmlResponse)
        throw new Error('Destination page could not be loaded as HTML.');
    const html = await response.text();
    if (controller.signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
    const pageDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = pageDocument.querySelector('.main-content');
    const currentMain = document.querySelector('.main-content');
    const hasSidebar = Boolean(pageDocument.querySelector('#sidebar'));
    if (!nextMain || !currentMain || !hasSidebar)
        throw new Error('Destination does not use the shared app shell.');

    const currentPath = location.pathname;
    await updatePageStyles(pageDocument, url, controller.signal);
    if (controller.signal.aborted) throw new DOMException('Navigation superseded.', 'AbortError');
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
    currentMain.replaceChildren(...(shellBar ? [shellBar] : []), ...contentNodes);
    updateShellForRoute(currentMain, nextMain, url);
    currentRoute = routeKey(url);

    document.querySelectorAll('[data-soft-nav-overlay]').forEach(node => {
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

    if (history) window.history.pushState({ softNavigation: true }, '', url.href);
    if (url.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView());
    else window.scrollTo({ top: 0, behavior: 'auto' });

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
}
function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('href')?.startsWith('#')) return;
    const url = new URL(anchor.href, location.href);
    if (!isAppRoute(url) || url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    swapTo(url).catch(error => {
        if (error.name === 'AbortError') return;
        console.error('Soft navigation failed; using the page route directly.', error);
        location.assign(url.href);
    });
}

export function initSoftNavigation() {
    if (window.__spSoftNavigationInitialized) return;
    window.__spSoftNavigationInitialized = true;
    installPageListenerScope();
    currentRoute = routeKey(new URL(location.href));
    document.querySelectorAll('link[rel="stylesheet"][href*="/assets/css/pages/"]').forEach(link => {
        link.dataset.softNavStyle = 'true';
    });
    // The mobile menu and desktop sidebar profile popover are part of the
    // persistent shell even though layout.js mounts them directly on body.
    document.querySelectorAll('body > :not(.app-shell):not(#mobileAppNavMenu):not(#desktopFloatingTools):not(#pomodoroWidget)')
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
            location.assign(url.href);
            return;
        }
        // Only the #hash changed (for example a table-of-contents link): the browser has
        // already scrolled to the section, so do not reload the page content.
        if (routeKey(url) === currentRoute) return;
        swapTo(url, { history: false }).catch(error => {
            location.reload();
        });
    });
}
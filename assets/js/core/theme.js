// Theme management. Loaded in <head> so the saved theme is applied before first paint.

(function () {
    var KEY = 'sp_settings';
    var THEMES = ['dark', 'light', 'amoled'];
    function read() { try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
    }
    catch (e) {
        return {};
    } }
    function write(patch) {
        try {
            var s = read();
            for (var k in patch)
                s[k] = patch[k];
            localStorage.setItem(KEY, JSON.stringify(s));
        }
        catch (e) { }
    }
    window.applyTheme = function () {
        var s = read();
        var theme = THEMES.indexOf(s.theme) > -1 ? s.theme : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-accent', s.accent || 'blue');
        document.documentElement.setAttribute('data-density', s.compact ? 'compact' : 'comfortable');
        document.documentElement.setAttribute('data-motion', s.reduceMotion ? 'reduced' : 'full');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta)
            meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : theme === 'amoled' ? '#000000' : '#0F172A');
    };
    var transitionTimer = null;
    function motionOk() {
        var root = document.documentElement;
        if (root.getAttribute('data-motion') === 'reduced')
            return false;
        try {
            return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return true;
        }
    }
    function fallbackTransition(fn) {
        var root = document.documentElement;
        root.classList.add('theme-transition');
        fn();
        window.clearTimeout(transitionTimer);
        transitionTimer = window.setTimeout(function () {
            root.classList.remove('theme-transition');
        }, 420);
    }
    // originEvent (a click/pointer event, optional) anchors a soft circular
    // reveal at the point the person actually tapped, so the new theme
    // washes outward from the toggle instead of the whole page snapping or
    // flatly cross-fading. Falls back cleanly where the browser or the
    // person's motion settings don't support it.
    function withTransition(fn, originEvent) {
        if (!motionOk()) {
            fn();
            return;
        }
        var root = document.documentElement;
        if (typeof document.startViewTransition === 'function') {
            var x = (originEvent && typeof originEvent.clientX === 'number') ? originEvent.clientX : window.innerWidth / 2;
            var y = (originEvent && typeof originEvent.clientY === 'number') ? originEvent.clientY : window.innerHeight / 2;
            var radius = Math.ceil(Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            ));
            root.style.setProperty('--theme-switch-x', x + 'px');
            root.style.setProperty('--theme-switch-y', y + 'px');
            root.style.setProperty('--theme-switch-radius', radius + 'px');
            var transition = document.startViewTransition(function () { fn(); });
            root.classList.add('theme-switch-reveal');
            transition.finished.then(function () {
                root.classList.remove('theme-switch-reveal');
            }, function () {
                root.classList.remove('theme-switch-reveal');
            });
            return;
        }
        fallbackTransition(fn);
    }
    // Fired once the theme attribute has actually been written to <html>.
    // With the View Transitions path, startViewTransition()'s callback runs
    // asynchronously (after it captures the "before" snapshot), so any UI
    // that mirrors data-theme (active outlines on the theme swatches, etc.)
    // can't just read the attribute right after calling setTheme() — it has
    // to wait for this event instead, or it'll show the previous theme.
    function notifyThemeChanged() {
        try { document.dispatchEvent(new CustomEvent('sp:themechange')); } catch (e) { }
    }
    window.setTheme = function (theme, originEvent) { withTransition(function () { write({ theme: theme }); window.applyTheme(); notifyThemeChanged(); }, originEvent); };
    // Accent swaps only recolor a handful of elements, not the whole page,
    // so they get the plain cross-fade rather than the full circular reveal.
    window.setAccent = function (accent) { if (motionOk()) { fallbackTransition(function () { write({ accent: accent }); window.applyTheme(); notifyThemeChanged(); }); } else { write({ accent: accent }); window.applyTheme(); notifyThemeChanged(); } };
    window.cycleTheme = function (originEvent) {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        window.setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length], originEvent);
    };
    window.applyTheme();
})();

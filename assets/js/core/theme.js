/* Theme management. Loaded in <head> so the saved theme is applied before first paint.
   Reads/writes the same local settings record as data/storage.js (browser-local only). */

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
        document.documentElement.setAttribute('data-accent', s.accent || 'amber');
        document.documentElement.setAttribute('data-density', s.compact ? 'compact' : 'comfortable');
        document.documentElement.setAttribute('data-motion', s.reduceMotion ? 'reduced' : 'full');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta)
            meta.setAttribute('content', theme === 'light' ? '#f1f5f9' : theme === 'amoled' ? '#000000' : '#0F172A');
    };
    window.setTheme = function (theme) { write({ theme: theme }); window.applyTheme(); };
    window.setAccent = function (accent) { write({ accent: accent }); window.applyTheme(); };
    window.cycleTheme = function () {
        var cur = document.documentElement.getAttribute('data-theme') || 'dark';
        window.setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
    };
    window.applyTheme();
})();

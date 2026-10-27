/* Wires every [data-theme-toggle] button to the shared theme system in theme.js.
   Toggles between light and dark; AMOLED counts as dark. */

(function () {
    function isDark() {
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    function syncButtons() {
        var label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';

        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        });
    }

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        button.addEventListener('click', function () {
            window.setTheme(isDark() ? 'light' : 'dark');
            syncButtons();
        });
    });

    window.addEventListener('storage', function (event) {
        if (event.key === 'sp_settings') {
            window.applyTheme();
            syncButtons();
        }
    });

    syncButtons();
})();

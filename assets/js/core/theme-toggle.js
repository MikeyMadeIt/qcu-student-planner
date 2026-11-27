// Wires every [data-theme-toggle] button to the shared theme system in theme.js.

(function () {
    var authThemeCycle = document.body.classList.contains('auth-page');

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'dark';
    }

    function isDark() {
        return currentTheme() !== 'light';
    }

    function syncButtons() {
        var theme = currentTheme();
        var label;

        if (authThemeCycle) {
            label = theme === 'dark' ? 'Switch to light theme'
                : theme === 'light' ? 'Switch to AMOLED theme'
                    : 'Switch to dark theme';
        } else {
            label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
        }

        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        });
    }

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        button.addEventListener('click', function (event) {
            if (authThemeCycle && typeof window.cycleTheme === 'function') {
                window.cycleTheme(event);
            } else {
                window.setTheme(isDark() ? 'light' : 'dark', event);
            }
            syncButtons();
        });
    });

    document.addEventListener('sp:themechange', syncButtons);

    window.addEventListener('storage', function (event) {
        if (event.key === 'sp_settings') {
            window.applyTheme();
            syncButtons();
        }
    });

    syncButtons();
})();

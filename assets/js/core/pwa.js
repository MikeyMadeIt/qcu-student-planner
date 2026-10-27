/* ---------- INIT ON EVERY PAGE ---------- */

document.addEventListener('DOMContentLoaded', () => {
    registerSW();
    setupInstallPrompt();
});

/* ---------- PWA ---------- */

function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../../service-worker.js').catch(() => { });
    }
}

let deferredInstallPrompt = null;

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        let fab = document.getElementById('installFab');
        if (!fab) {
            fab = document.createElement('button');
            fab.id = 'installFab';
            fab.className = 'install-fab';
            fab.setAttribute('aria-label', 'Install app');
            fab.innerHTML = '<i class="bi bi-download" aria-hidden="true"></i> Install App';
            fab.onclick = async () => {
                fab.style.display = 'none';
                if (deferredInstallPrompt) {
                    deferredInstallPrompt.prompt();
                    await deferredInstallPrompt.userChoice;
                    deferredInstallPrompt = null;
                }
            };
            document.body.appendChild(fab);
        }
        fab.style.display = 'flex';
    });
    window.addEventListener('appinstalled', () => { const fab = document.getElementById('installFab'); if (fab)
        fab.remove(); Toast.show('App installed'); });
}

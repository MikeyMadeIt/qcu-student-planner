/* ---------- INIT ON EVERY PAGE ---------- */

document.addEventListener('DOMContentLoaded', () => {
    registerSW();
});

/* ---------- PWA ---------- */

function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../../service-worker.js').catch(() => { });
    }
}

/* Install support. The browser's install prompt is captured silently on every
   page; the only UI for it lives in Settings -> App Installation, which reads
   and drives it through window.PWAInstall. */

let deferredInstallPrompt = null;
const installListeners = [];

function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function notifyInstallChange() {
    installListeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
}

window.PWAInstall = {
    isInstalled: isAppInstalled,
    canInstall: () => !!deferredInstallPrompt && !isAppInstalled(),
    isIos: () => /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    onChange(fn) { installListeners.push(fn); },
    async install() {
        if (!deferredInstallPrompt)
            return 'unavailable';
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        notifyInstallChange();
        return choice.outcome;
    },
};

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        notifyInstallChange();
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        notifyInstallChange();
        if (window.Toast)
            Toast.show('App installed');
    });
}

setupInstallPrompt();

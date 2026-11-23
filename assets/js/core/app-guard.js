// Protected-page guard for pages/app/*.html. Keep protected content hidden
// until the Planner session and account status have both been verified.
(function () {
    'use strict';

    var HIDE_CLASS = 'app-guard-pending';
    var PROFILE_TIMEOUT_MS = 15000;
    var checking = false;
    var attempt = 0;
    var recovery = null;

    if (!document.getElementById('appGuardStyle')) {
        var style = document.createElement('style');
        style.id = 'appGuardStyle';
        style.textContent = '.' + HIDE_CLASS + '{visibility:hidden !important;}' +
            '#appGuardRecovery{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#172033;font:16px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;visibility:visible!important;}' +
            '#appGuardRecovery .app-guard-panel{width:min(100%,460px);padding:28px;border:1px solid #d9e0ea;border-radius:16px;background:#fff;box-shadow:0 16px 48px rgba(15,23,42,.12);}' +
            '#appGuardRecovery h1{margin:0 0 10px;font-size:1.35rem;}' +
            '#appGuardRecovery p{margin:0 0 20px;color:#526078;}' +
            '#appGuardRecovery button{min-height:44px;padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font:inherit;font-weight:600;cursor:pointer;}' +
            '#appGuardRecovery button:disabled{opacity:.65;cursor:wait;}' +
            '@media(prefers-color-scheme:dark){#appGuardRecovery{background:#111827;color:#f3f4f6}#appGuardRecovery .app-guard-panel{background:#1f2937;border-color:#374151}#appGuardRecovery p{color:#cbd5e1}}';
        document.head.appendChild(style);
    }
    document.documentElement.classList.add(HIDE_CLASS);

    function reveal() {
        removeRecovery();
        document.documentElement.classList.remove(HIDE_CLASS);
    }

    function bounceToLogin(reason) {
        try {
            if (reason) sessionStorage.setItem('qcu.appGuardDeniedReason', reason);
        } catch (error) { /* ignore unavailable session storage */ }
        location.replace('../auth/login.html');
    }

    function waitForSupabaseLibrary(timeoutMs) {
        var deadline = Date.now() + timeoutMs;
        return new Promise(function (resolve, reject) {
            (function poll() {
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    resolve();
                } else if (Date.now() > deadline) {
                    reject(makeGuardError('SUPABASE_TIMEOUT'));
                } else {
                    setTimeout(poll, 30);
                }
            })();
        });
    }

    function makeGuardError(code) {
        var error = new Error(code);
        error.code = code;
        return error;
    }

    function ensureRecovery() {
        if (recovery) return recovery;

        var root = document.createElement('section');
        root.id = 'appGuardRecovery';
        root.setAttribute('role', 'alert');
        root.setAttribute('aria-live', 'assertive');

        var panel = document.createElement('div');
        panel.className = 'app-guard-panel';
        var title = document.createElement('h1');
        title.textContent = 'We couldn’t verify your account';
        var message = document.createElement('p');
        message.id = 'appGuardRecoveryMessage';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry verification';
        retry.addEventListener('click', check);

        panel.appendChild(title);
        panel.appendChild(message);
        panel.appendChild(retry);
        root.appendChild(panel);
        (document.body || document.documentElement).appendChild(root);

        recovery = { root: root, message: message, retry: retry };
        return recovery;
    }

    function showRecovery(message) {
        var ui = ensureRecovery();
        ui.message.textContent = message;
        ui.retry.disabled = false;
        ui.retry.textContent = 'Retry verification';
    }

    function showChecking() {
        if (!recovery) return;
        recovery.message.textContent = 'Checking your Planner session and account status…';
        recovery.retry.disabled = true;
        recovery.retry.textContent = 'Checking…';
    }

    function removeRecovery() {
        if (!recovery) return;
        if (recovery.root.parentNode) recovery.root.parentNode.removeChild(recovery.root);
        recovery = null;
    }

    function isNetworkFailure(result) {
        var message = String(result && result.message || '').toLowerCase();
        return result && result.code === 'NETWORK_ERROR' ||
            /failed to fetch|network|load failed|offline|timed? out|could not reach/.test(message);
    }

    function failureMessage(error, result) {
        if (error && error.code === 'PROFILE_TIMEOUT') {
            return 'Account verification took too long. Check your connection and try again.';
        }
        if (error && error.code === 'SUPABASE_TIMEOUT') {
            return 'Planner services did not finish loading. Check your connection and try again.';
        }
        if (isNetworkFailure(result) || error && error.code === 'NETWORK_ERROR') {
            return 'We couldn’t reach Planner services. Check your connection and try again.';
        }
        return 'Your protected planner content is still hidden because your account could not be verified. Please try again.';
    }

    function validateProfile(AuthService, controller) {
        var timer;
        var timeout = new Promise(function (resolve, reject) {
            timer = setTimeout(function () {
                var timeoutError = makeGuardError('PROFILE_TIMEOUT');
                controller.abort(timeoutError);
                reject(timeoutError);
            }, PROFILE_TIMEOUT_MS);
        });

        return Promise.race([
            AuthService.getCurrentProfile({ signal: controller.signal }),
            timeout,
        ]).finally(function () {
            clearTimeout(timer);
        });
    }

    function check() {
        if (checking) return;
        checking = true;
        document.documentElement.classList.add(HIDE_CLASS);
        var thisAttempt = ++attempt;
        var controller = new AbortController();
        showChecking();

        waitForSupabaseLibrary(10000)
            .then(function () {
                return Promise.all([
                    import('../services/auth-service.js'),
                    import('../utils/auth-routing.js'),
                ]);
            })
            .then(function (modules) {
                if (thisAttempt !== attempt) return null;
                var AuthService = modules[0].AuthService;
                var needsProfileDetails = modules[1].needsProfileDetails;
                return validateProfile(AuthService, controller).then(function (profileResult) {
                    return { profileResult: profileResult, needsProfileDetails: needsProfileDetails };
                });
            })
            .then(function (validation) {
                if (thisAttempt !== attempt || !validation) return;

                var profileResult = validation.profileResult;
                if (!profileResult.ok) {
                    if (profileResult.code === 'NO_SESSION' || profileResult.code === 'NO_PROFILE' || profileResult.code === 'ACCOUNT_UNAUTHORIZED') {
                        bounceToLogin('Please sign in to continue.');
                        return;
                    }
                    showRecovery(failureMessage(null, profileResult));
                    return;
                }

                var profile = profileResult.data;
                if (profile.role === 'admin' && profile.account_status === 'approved') {
                    location.replace('../admin/dashboard.html');
                    return;
                }

                if (profile.account_status !== 'approved') {
                    bounceToLogin(
                        profile.account_status === 'pending'
                            ? (validation.needsProfileDetails(profile)
                                ? 'Please finish setting up your account before continuing.'
                                : 'Your account is still awaiting administrator review.')
                            : profile.account_status === 'rejected'
                                ? ('Your registration was not approved.' + (profile.rejection_reason ? ' Reason: ' + profile.rejection_reason : ''))
                                : 'Your account has been suspended. Contact an administrator for help.'
                    );
                    return;
                }

                reveal();
            })
            .catch(function (error) {
                if (thisAttempt !== attempt) return;
                showRecovery(failureMessage(error));
            })
            .finally(function () {
                if (thisAttempt !== attempt) return;
                checking = false;
            });
    }

    check();

    window.addEventListener('pageshow', function (event) {
        if (event.persisted) check();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
    });
})();

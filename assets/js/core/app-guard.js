// Protected-page guard for pages/app/*.html.
//
// Those pages are classic (non-module) scripts, so unlike the admin side
// (admin-guard.js's requireAdmin(), imported and awaited before anything
// renders) nothing was stopping a signed-out visitor, or a pending/
// rejected/suspended account, from opening a pages/app/*.html URL directly:
// the page shell — and any planner data already cached in localStorage from
// a previous session — would just render, no server round trip involved.
//
// This file is a classic script (loaded first, before anything else) that
// hides the page synchronously, then dynamic-imports the real auth modules
// to check the session + account status, and either reveals the page or
// bounces away. Keeping it a classic <script> (not type="module") means it
// can sit as the very first tag in <head>, before even theme.js, so the
// hide-on-load CSS below is guaranteed to apply before first paint.
(function () {
    'use strict';

    var HIDE_CLASS = 'app-guard-pending';

    if (!document.getElementById('appGuardStyle')) {
        var style = document.createElement('style');
        style.id = 'appGuardStyle';
        style.textContent = '.' + HIDE_CLASS + '{visibility:hidden !important;}';
        document.head.appendChild(style);
    }
    document.documentElement.classList.add(HIDE_CLASS);

    function reveal() {
        document.documentElement.classList.remove(HIDE_CLASS);
    }

    // Always land on login.html for anything that isn't a clean "approved
    // student" go — including pending/rejected/suspended. login.html's own
    // auth-session-guard.js already knows how to re-route a pending/approved
    // account correctly, so sending everything non-clean through there (with
    // a reason stashed for display) is simpler and safer than duplicating
    // that routing table here.
    function bounceToLogin(reason) {
        try {
            if (reason) sessionStorage.setItem('qcu.appGuardDeniedReason', reason);
        } catch (error) { /* ignore */ }
        location.replace('../auth/login.html');
    }

    // app-guard.js is deliberately the very first script on the page (ahead
    // of even theme.js) so the hide-on-load CSS above wins the race against
    // first paint. But that means the Supabase UMD <script> tag — loaded
    // near the bottom of these pages, the same way every other page here
    // does it — hasn't run yet when this fires. auth-service.js's
    // getSupabase() throws immediately if window.supabase isn't there yet,
    // so wait for it (page stays hidden the whole time; no flash either way).
    function waitForSupabaseLibrary(timeoutMs) {
        var deadline = Date.now() + timeoutMs;
        return new Promise(function (resolve, reject) {
            (function poll() {
                if (window.supabase && typeof window.supabase.createClient === 'function') {
                    resolve();
                } else if (Date.now() > deadline) {
                    reject(new Error('Supabase library failed to load.'));
                } else {
                    setTimeout(poll, 30);
                }
            })();
        });
    }

    function check() {
        waitForSupabaseLibrary(10000).then(function () {
            return Promise.all([
                import('../services/auth-service.js'),
                import('../utils/auth-routing.js'),
            ]);
        }).then(function (modules) {
            var AuthService = modules[0].AuthService;
            var needsProfileDetails = modules[1].needsProfileDetails;

            return AuthService.getCurrentProfile().then(function (profileResult) {
                if (!profileResult.ok) {
                    bounceToLogin('Please sign in to continue.');
                    return;
                }

                var profile = profileResult.data;

                if (profile.role === 'admin' && profile.account_status === 'approved') {
                    // Admins have their own area; don't trap them in the
                    // student shell if they land here (e.g. a stale bookmark).
                    location.replace('../admin/dashboard.html');
                    return;
                }

                if (profile.account_status !== 'approved') {
                    bounceToLogin(
                        profile.account_status === 'pending'
                            ? (needsProfileDetails(profile)
                                ? 'Please finish setting up your account before continuing.'
                                : 'Your account is still awaiting administrator review.')
                            : profile.account_status === 'rejected'
                                ? ('Your registration was not approved.' + (profile.rejection_reason ? ' Reason: ' + profile.rejection_reason : ''))
                                : 'Your account has been suspended. Contact an administrator for help.'
                    );
                    return;
                }

                reveal();
            });
        }).catch(function () {
            // Covers both a real expired/invalid session and a failure to
            // even load the auth modules (offline, CDN blocked, etc.) — in
            // every case the safe default is "don't show a protected page",
            // and login.html can give a more specific error on retry.
            bounceToLogin('Your session has expired. Please sign in again.');
        });
    }

    check();

    // Covers the same back-button/bfcache case auth-session-guard.js handles
    // on login.html, but inverted here: landing back on a protected page via
    // bfcache after signing out (or after the account's status changed)
    // should re-run the check, not just show whatever was cached in memory.
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) check();
    });

    // Belt-and-suspenders for a tab that was simply backgrounded (not
    // bfcached) while, in another tab, the person signed out or an admin
    // changed their account status.
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
    });
})();

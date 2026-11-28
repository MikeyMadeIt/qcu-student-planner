// Authentication service boundary (ES module), backed by Supabase Auth + the `profiles` table.

import { getSupabase } from '../core/supabase-client.js';

export const AUTH_NOT_CONFIGURED = 'AUTH_NOT_CONFIGURED';

function fail(message, code) {
    return { ok: false, code, message };
}

function ok(data) {
    return { ok: true, data };
}

function abortError(signal) {
    if (signal && signal.reason instanceof Error) return signal.reason;
    const error = new Error('The operation was aborted.');
    error.name = 'AbortError';
    return error;
}

function awaitWithAbort(value, signal) {
    if (!signal) return Promise.resolve(value);
    if (signal.aborted) return Promise.reject(abortError(signal));

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback, result) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            callback(result);
        };
        const onAbort = () => finish(reject, abortError(signal));

        signal.addEventListener('abort', onAbort, { once: true });
        Promise.resolve(value).then(
            result => finish(resolve, result),
            error => finish(reject, error),
        );
    });
}

// Maps a Supabase/Postgres error into a message safe to show a user. Known cases get a
function readableAuthError(error) {
    if (!error) return 'Something went wrong. Please try again.';

    console.error('Auth/DB error:', error);

    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Could not reach the server. Check your connection and try again.';
    if (msg.includes('permission denied') || error.code === '42501') {
        return 'You are not allowed to submit these details right now (your account may no longer be pending). Reload the page and try again, or contact an administrator.';
    }
    if (msg.includes('could not find the function') || msg.includes('does not exist') || error.code === 'PGRST202' || error.code === '42883') {
        return "The server is missing part of its setup (a required database function). An administrator needs to run the project's Supabase migrations, then try again.";
    }
    if (msg.includes('column') && msg.includes('does not exist')) {
        return "The server's database is missing a required column. An administrator needs to run the project's latest Supabase migration, then try again.";
    }

    return error.message ? `We could not process that request: ${error.message}` : 'We could not process that request. Please try again.';
}

// Google sign-in fails for very different reasons than a password login (almost always a
function readableOAuthError(error) {
    if (!error) return 'Something went wrong starting Google sign-in. Please try again.';

    console.error('Google sign-in error:', error);

    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
        return 'Google sign-in is turned off for this project. In Supabase: Authentication → Providers → Google, make sure it is enabled and has a Client ID and Client Secret saved.';
    }
    if (msg.includes('requested path is invalid') || (msg.includes('redirect') && (msg.includes('not allowed') || msg.includes('invalid')))) {
        return "This site's sign-in address isn't on the allowed list. In Supabase: Authentication → URL Configuration → Redirect URLs, add this site's /pages/auth/callback.html address.";
    }
    if (msg.includes('access_denied') || msg.includes('user denied') || msg.includes('cancelled') || msg.includes('canceled')) {
        return 'Google sign-in was cancelled.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
        return 'Could not reach the server. Check your connection and try again.';
    }
    if (msg.includes('database error saving new user') || msg.includes('unexpected_failure')) {
        return 'Your Google account signed in, but the server could not create your student profile. An administrator needs to check the Supabase database setup (the profiles trigger/migrations).';
    }

    return `Google sign-in could not start: ${error.message || 'unknown error'}. Check the Google provider setup in Supabase.`;
}

export const AuthService = {
    async signInWithGoogle() {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: new URL('callback.html', location.href).href,
                    queryParams: { prompt: 'select_account' },
                },
            });

            if (error) return fail(readableOAuthError(error), 'AUTH_ERROR');

            return ok({});
        } catch (error) {
            return fail(readableOAuthError(error), 'AUTH_ERROR');
        }
    },

    async waitForOAuthSession(timeoutMs = 8000) {
        const supabase = getSupabase();

        const { data: immediate } = await supabase.auth.getSession();
        if (immediate.session) return immediate.session;

        return new Promise(resolve => {
            let settled = false;
            const timer = setTimeout(() => finish(null), timeoutMs);

            function finish(session) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                subscription.unsubscribe();
                resolve(session);
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (session) finish(session);
            });
        });
    },

    async completeProfile({ fullName, program, campus, yearLevel }) {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();

            if (!sessionData.session) return fail('Your session has expired. Please sign in again.', 'NO_SESSION');

            const { error } = await supabase.rpc('submit_profile_details', {
                p_full_name: fullName || null,
                p_course: program || null,
                p_year_level: yearLevel || null,
                p_school: campus || null,
            });

            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');

            return ok({});
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async checkVerificationStatus() {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();

            if (!sessionData.session) {
                return { ok: true, message: 'Log in again to check your account status.' };
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('account_status, rejection_reason')
                .eq('id', sessionData.session.user.id)
                .maybeSingle();

            if (error || !profile) {
                return { ok: true, message: 'We could not check your status right now. Please try again shortly.' };
            }

            if (profile.account_status === 'approved') {
                return { ok: true, message: 'Your account has been approved. You can log in now.', approved: true };
            }
            if (profile.account_status === 'rejected') {
                return { ok: true, message: `Your registration was not approved.${profile.rejection_reason ? ` Reason: ${profile.rejection_reason}` : ''}` };
            }
            if (profile.account_status === 'suspended') {
                return { ok: true, message: 'Your account has been suspended. Contact an administrator for help.' };
            }

            return { ok: true, message: 'Your account is still awaiting administrator review.' };
        } catch (error) {
            return { ok: true, message: 'We could not check your status right now. Please try again shortly.' };
        }
    },

    async signOut() {
        try {
            if (typeof window !== 'undefined' && window.CloudSync && typeof window.CloudSync.waitForPendingSync === 'function') {
                try { await window.CloudSync.waitForPendingSync(); } catch (e) { /* ignore */ }
                const syncStatus = typeof window.CloudSync.getSyncStatus === 'function'
                    ? window.CloudSync.getSyncStatus()
                    : null;
                if (syncStatus && syncStatus.pending) {
                    return fail('Your changes are still syncing. Wait a moment and try signing out again.', 'SYNC_PENDING');
                }
                if (syncStatus && syncStatus.error) {
                    return fail('Some changes could not be saved. Retry synchronization before signing out so your local data is not lost.', 'SYNC_FAILED');
                }
            }
            const supabase = getSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');
            if (typeof DB !== 'undefined' && typeof DB.clearPrivateCacheOnSignOut === 'function') {
                DB.clearPrivateCacheOnSignOut();
            }
            return ok({});
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async getCurrentProfile({ signal } = {}) {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await awaitWithAbort(supabase.auth.getSession(), signal);

            if (!sessionData.session) return fail('Not signed in.', 'NO_SESSION');
            if (signal && signal.aborted) throw abortError(signal);

            let profileQuery = supabase
                .from('profiles')
                .select('*')
                .eq('id', sessionData.session.user.id)
                .maybeSingle();

            // The protected-page guard supplies a signal so a timed-out
            // validation can be cancelled before the student retries. Other
            // callers keep the existing no-argument behavior.
            if (signal && typeof profileQuery.abortSignal === 'function') {
                profileQuery = profileQuery.abortSignal(signal);
            }

            const { data: profile, error } = await awaitWithAbort(profileQuery, signal);

            if (error) {
                const errorMessage = String(error.message || '').toLowerCase();
                if (error.status === 401 || error.status === 403 || error.code === '42501') {
                    return fail('Your session or account is not authorized.', 'ACCOUNT_UNAUTHORIZED');
                }
                if (/failed to fetch|network|load failed|offline|timeout|timed out/.test(errorMessage)) {
                    return fail('Could not reach the server. Check your connection and try again.', 'NETWORK_ERROR');
                }
                return fail('Could not load your profile.', 'PROFILE_ERROR');
            }
            if (!profile) return fail('Could not load your profile.', 'NO_PROFILE');

            return ok(profile);
        } catch (error) {
            // Cancellation belongs to the caller; keep it distinct from
            // authentication and profile failures so stale work cannot be
            // mistaken for a result that should update the page.
            if (signal && signal.aborted) throw abortError(signal);
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },
};

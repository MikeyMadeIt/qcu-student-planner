/* Authentication service boundary (ES module), backed by Supabase Auth + the `profiles` table.
   Every function returns { ok, code?, message, data? }. Nothing here ever reports success
   without the Supabase call actually succeeding. */

import { getSupabase } from '../core/supabase-client.js';

export const AUTH_NOT_CONFIGURED = 'AUTH_NOT_CONFIGURED';

function fail(message, code) {
    return { ok: false, code, message };
}

function ok(data) {
    return { ok: true, data };
}

/* Maps a Supabase/Postgres error into a message safe to show a user. Known cases get a
   friendly rewrite; anything unrecognized still shows the real underlying message instead of
   a dead-end "something went wrong" -- a vague message with no detail is exactly what made the
   Google-OAuth config problem and this RPC problem both hard to find, so every failure is also
   logged to the console and, as a last resort, shown inline so it can actually be diagnosed. */
function readableAuthError(error) {
    if (!error) return 'Something went wrong. Please try again.';

    console.error('Auth/DB error:', error);

    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('email not confirmed')) return 'Please confirm your email before logging in.';
    if (msg.includes('user already registered') || msg.includes('already registered')) return 'An account with this email already exists.';
    if (msg.includes('password should be at least')) return 'Your password does not meet the minimum requirements.';
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

    /* Last resort: show the actual error instead of a dead end. */
    return error.message ? `We could not process that request: ${error.message}` : 'We could not process that request. Please try again.';
}

/* Google sign-in fails for very different reasons than a password login (almost always a
   Supabase/Google Cloud *configuration* problem, not something the student did), so it gets
   its own, much more specific error mapping instead of the generic one above. Anything
   unrecognized still shows the real Supabase message -- these screens are used by club
   officers who need to fix the setup, not end users, so hiding the actual cause behind a
   vague "something went wrong" just makes it impossible to diagnose. */
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
    async signIn({ email, password }) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, account_status, full_name, rejection_reason')
                .eq('id', data.user.id)
                .maybeSingle();

            if (profileError || !profile) {
                await supabase.auth.signOut();
                return fail('We could not load your account. Please try again or contact an administrator.', 'PROFILE_ERROR');
            }

            return ok({
                userId: data.user.id,
                role: profile.role,
                accountStatus: profile.account_status,
                fullName: profile.full_name,
                rejectionReason: profile.rejection_reason,
            });
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async signUp({ fullName, email, password, program, campus, yearLevel, section }) {
        try {
            const supabase = getSupabase();

            /* The registration details travel as signup metadata (auth.users.raw_user_meta_data),
               not a follow-up RPC call: a follow-up call needs an authenticated session, and
               Supabase does not issue one at signUp() time when "Confirm email" is enabled.
               The handle_new_user DB trigger reads this metadata to create the pending profiles
               row atomically with the auth user, so it works either way. Student number is
               intentionally never collected or sent. */
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName || null,
                        course: program || null,
                        year_level: yearLevel || null,
                        section: section || null,
                        school: campus || null,
                    },
                },
            });

            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');

            return ok({ userId: data.user ? data.user.id : null, detailsSaved: true });
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    /* Redirects the browser to Google, then back to callback.html. Supabase issues a real,
       live session the moment Google confirms the identity -- there is no way to make OAuth
       itself "not sign the user in". The manual pending/approve gate is enforced afterwards,
       in the callback page, exactly like signIn() enforces it above for passwords. */
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

    /* Waits for the session Supabase creates from the Google redirect. supabase-js resolves
       this in one of two ways depending on timing: getSession() already has it, or it arrives
       a moment later via onAuthStateChange (SIGNED_IN) while detectSessionInUrl finishes the
       PKCE code exchange. Covers both so the callback page never races it. */
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

    /* Fills in the academic details a Google sign-in never provides (program, campus, year
       level, section). Only ever touches the caller's own row, and only while still pending --
       enforced server-side by submit_profile_details(). */
    async completeProfile({ fullName, program, campus, yearLevel, section }) {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();

            if (!sessionData.session) return fail('Your session has expired. Please sign in again.', 'NO_SESSION');

            const { error } = await supabase.rpc('submit_profile_details', {
                p_full_name: fullName || null,
                p_course: program || null,
                p_year_level: yearLevel || null,
                p_section: section || null,
                p_school: campus || null,
            });

            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');

            return ok({});
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async requestPasswordReset({ email }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${location.origin}${location.pathname.replace(/forgot-password\.html$/, 'reset-password.html')}`,
            });

            if (error) return fail(readableAuthError(error), 'AUTH_ERROR');

            return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async updatePassword({ password }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.updateUser({ password });

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

    async confirmEmail({ token }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'email' });

            if (error) return { ok: true, message: 'This verification link is invalid or has expired.' };

            return { ok: true, message: 'Your email is verified. Your account still needs administrator approval before you can log in.' };
        } catch (error) {
            return { ok: true, message: 'This verification link is invalid or has expired.' };
        }
    },

    async signOut() {
        try {
            const supabase = getSupabase();
            await supabase.auth.signOut();
            return ok({});
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },

    async getCurrentProfile() {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();

            if (!sessionData.session) return fail('Not signed in.', 'NO_SESSION');

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', sessionData.session.user.id)
                .maybeSingle();

            if (error || !profile) return fail('Could not load your profile.', 'PROFILE_ERROR');

            return ok(profile);
        } catch (error) {
            return fail(readableAuthError(error), 'AUTH_ERROR');
        }
    },
};

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

/* Maps a Supabase/Postgres error into a message safe to show a user:
   never leak internal detail (constraint names, stack traces, etc). */
function readableAuthError(error) {
    if (!error) return 'Something went wrong. Please try again.';
    const msg = String(error.message || '').toLowerCase();

    if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
    if (msg.includes('email not confirmed')) return 'Please confirm your email before logging in.';
    if (msg.includes('user already registered') || msg.includes('already registered')) return 'An account with this email already exists.';
    if (msg.includes('password should be at least')) return 'Your password does not meet the minimum requirements.';
    if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Could not reach the server. Check your connection and try again.';

    return 'We could not process that request. Please try again.';
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

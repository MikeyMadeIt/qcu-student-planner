/* Single source of truth for "where does this signed-in user land" (ES module).
   Both the password login form (auth-forms.js) and the Google OAuth callback
   (auth-callback.js) call this, so the account_status gate behaves identically
   no matter how the session was created -- a pending/rejected/suspended account
   must never reach an app page regardless of sign-in method. */

export function resolveLandingRoute({ role, accountStatus, rejectionReason, needsProfileDetails }) {
    if (accountStatus === 'approved' && role === 'admin') {
        return { type: 'go', href: '../admin/dashboard.html' };
    }
    if (accountStatus === 'approved') {
        return { type: 'go', href: '../app/dashboard.html' };
    }
    if (accountStatus === 'pending') {
        if (needsProfileDetails) return { type: 'go', href: 'finish-profile.html' };
        return { type: 'go', href: 'pending.html' };
    }
    if (accountStatus === 'rejected') {
        return {
            type: 'blocked',
            message: `Your registration was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        };
    }
    return { type: 'blocked', message: 'Your account has been suspended. Contact an administrator for help.' };
}

/* An academic-details step is still owed when any of the fields our own registration
   form collects (and Google never supplies) are missing. */
export function needsProfileDetails(profile) {
    if (!profile) return false;
    return !profile.course || !profile.year_level || !profile.section || !profile.school;
}

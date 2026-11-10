// Single source of truth for "where does this signed-in user land" (ES module).

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

// An academic-details step is still owed when any of the fields our own registration
export function needsProfileDetails(profile) {
    if (!profile) return false;
    return !profile.course || !profile.year_level || !profile.school;
}

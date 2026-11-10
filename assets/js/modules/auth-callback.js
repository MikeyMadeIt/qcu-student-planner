// pages/auth/callback.html entry point (ES module). This is the one place a Google OAuth

import { AuthService } from '../services/auth-service.js';
import { resolveLandingRoute, needsProfileDetails } from '../utils/auth-routing.js';
import { $ } from '../utils/auth-ui.js';

function showFailure(text) {
    const title = $('[data-callback-title]');
    const message = $('[data-callback-message]');
    const actions = $('[data-callback-actions]');
    const spinner = $('[data-callback-spinner]');

    if (spinner) spinner.hidden = true;
    if (title) title.textContent = 'Sign-in unavailable';
    if (message) {
        message.hidden = false;
        message.textContent = text;
    }
    if (actions) actions.hidden = false;
}

function readOAuthError() {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const raw = query.get('error_description') || hash.get('error_description') || query.get('error') || hash.get('error');

    return raw ? raw.replace(/\+/g, ' ') : '';
}

async function loadProfileWithRetry() {
    let result = await AuthService.getCurrentProfile();
    let attempts = 0;

    while (!result.ok && attempts < 4) {
        await new Promise(resolve => setTimeout(resolve, 400));
        result = await AuthService.getCurrentProfile();
        attempts += 1;
    }

    return result;
}

async function handleCallback() {
    const oauthError = readOAuthError();

    if (oauthError) {
        showFailure(oauthError);
        return;
    }

    const session = await AuthService.waitForOAuthSession();

    if (!session) {
        showFailure('We could not complete Google sign-in. Please try again.');
        return;
    }

    const profileResult = await loadProfileWithRetry();

    if (!profileResult.ok) {
        showFailure('We could not load your account. Please try again or contact an administrator.');
        return;
    }

    const profile = profileResult.data;
    const destination = resolveLandingRoute({
        role: profile.role,
        accountStatus: profile.account_status,
        rejectionReason: profile.rejection_reason,
        needsProfileDetails: needsProfileDetails(profile),
    });

    if (destination.type === 'go') {
        location.replace(destination.href);
        return;
    }

    await AuthService.signOut();
    showFailure(destination.message);
}

export function initAuthCallback() {
    if (document.body.dataset.authCallback === undefined) return;
    handleCallback();
}

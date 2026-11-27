// Status page: pending account approval.

import { AuthService } from '../services/auth-service.js';
import { APP_CONFIG } from '../core/config.js';
import { $, $$, setLoading } from '../utils/auth-ui.js';

function consumeRegistrationPreviewFlag() {
    try {
        const wasSubmitted = sessionStorage.getItem(APP_CONFIG.registrationPreviewFlag) === '1';
        sessionStorage.removeItem(APP_CONFIG.registrationPreviewFlag);
        return wasSubmitted;
    } catch (error) {
        return false;
    }
}

function showSubmittedState() {
    $('[data-state-default]').hidden = true;
    $('[data-state-submitted]').hidden = false;
}

async function checkVerification(button, output) {
    setLoading(button, true);

    const result = await AuthService.checkVerificationStatus();

    output.hidden = false;
    output.className = 'auth-alert info';
    output.textContent = result.message;

    setLoading(button, false);
}

async function returnToLogin(link) {
    if (link.dataset.signingOut === 'true') return;

    link.dataset.signingOut = 'true';
    link.classList.add('is-loading');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('aria-busy', 'true');

    let result;
    try {
        result = await AuthService.signOut();
    } catch (error) {
        result = { ok: false, message: 'Could not sign out right now. Please try again.' };
    }

    if (result.ok) {
        location.replace(APP_CONFIG.routes.login);
        return;
    }

    const submittedState = $('[data-state-submitted]');
    const output = submittedState && !submittedState.hidden
        ? $('[data-status-signout-message]', submittedState)
        : $('[data-status-message]');
    if (output) {
        output.hidden = false;
        output.className = 'auth-alert error';
        output.textContent = result.message || 'Could not sign out right now. Please try again.';
    }

    delete link.dataset.signingOut;
    link.classList.remove('is-loading');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('aria-busy');
}

export function initStatusPage() {
    const page = document.body.dataset.statusPage;

    if (!page) return;

    const output = $('[data-status-message]');
    const button = $('[data-status-action]');

    if (page === 'pending' && consumeRegistrationPreviewFlag()) {
        showSubmittedState();
    }

    if (button) button.addEventListener('click', () => checkVerification(button, output));
    $$('[data-status-login]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            returnToLogin(link);
        });
    });
}

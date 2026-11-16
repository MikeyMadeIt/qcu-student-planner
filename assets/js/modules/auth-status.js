// Status page: pending account approval.

import { AuthService } from '../services/auth-service.js';
import { APP_CONFIG } from '../core/config.js';
import { $, setLoading } from '../utils/auth-ui.js';

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

export function initStatusPage() {
    const page = document.body.dataset.statusPage;

    if (!page) return;

    const output = $('[data-status-message]');
    const button = $('[data-status-action]');

    if (page === 'pending' && consumeRegistrationPreviewFlag()) {
        showSubmittedState();
        return;
    }

    if (button) button.addEventListener('click', () => checkVerification(button, output));
}

// Single-step authentication forms: login, forgot password and reset password.

import { AuthService } from '../services/auth-service.js';
import { validators } from '../utils/validation.js';
import { resolveLandingRoute } from '../utils/auth-routing.js';
import {
    $,
    $$,
    readValue,
    setFieldError,
    setLoading,
    setupPasswordRequirements,
    showAlert,
} from '../utils/auth-ui.js';

const REMEMBER_EMAIL_KEY = 'qcuRememberedEmail';

// "Remember me" only affects what's pre-filled next time it never touches
function applyRememberedEmail(form) {
    const emailInput = $('[name="email"]', form);
    const rememberInput = $('[name="rememberMe"]', form);

    if (!emailInput || !rememberInput) return;

    try {
        const saved = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (saved) {
            emailInput.value = saved;
            rememberInput.checked = true;
        }
    } catch (error) {
    }
}

function persistRememberedEmail(form) {
    const emailInput = $('[name="email"]', form);
    const rememberInput = $('[name="rememberMe"]', form);

    if (!emailInput || !rememberInput) return;

    try {
        if (rememberInput.checked) {
            window.localStorage.setItem(REMEMBER_EMAIL_KEY, emailInput.value.trim());
        } else {
            window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
    } catch (error) {
    }
}

const RULES = {
    email: input => validators.email(readValue(input)),
    password: input => validators.password(readValue(input)),
    newPassword: input => validators.newPassword(readValue(input)),
    confirm: (input, form) => validators.confirm(readValue(input), $('[name="password"]', form).value),
};

const SUBMIT_HANDLERS = {
    login: form => AuthService.signIn({
        email: readValue($('[name="email"]', form)),
        password: $('[name="password"]', form).value,
    }),
    forgot: form => AuthService.requestPasswordReset({
        email: readValue($('[name="email"]', form)),
    }),
    reset: form => AuthService.updatePassword({
        password: $('[name="password"]', form).value,
    }),
};

function validateInput(input, form) {
    const rule = RULES[input.dataset.rule];

    if (!rule) return true;

    const message = rule(input, form);
    setFieldError(input, message);

    return !message;
}

function attachLiveValidation(inputs, form) {
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateInput(input, form));

        input.addEventListener('input', () => {
            if (input.getAttribute('aria-invalid') === 'true') validateInput(input, form);
        });
    });

    const password = $('[name="password"]', form);
    const confirm = $('[name="confirmPassword"]', form);

    if (password && confirm) {
        password.addEventListener('input', () => {
            if (confirm.value) validateInput(confirm, form);
        });
    }
}

async function submitForm(form, submitButton) {
    const type = form.dataset.authForm;
    const inputs = $$('[data-rule]', form);

    showAlert(form, '');

    const results = inputs.map(input => validateInput(input, form));

    if (results.includes(false)) {
        inputs.find(input => input.getAttribute('aria-invalid') === 'true').focus();
        return;
    }

    setLoading(submitButton, true);

    try {
        const result = await SUBMIT_HANDLERS[type](form);

        if (!result.ok) {
            showAlert(form, result.message, 'info');
            return;
        }

        if (type === 'login') {
            const { role, accountStatus, rejectionReason, needsProfileDetails } = result.data;
            const destination = resolveLandingRoute({ role, accountStatus, rejectionReason, needsProfileDetails });

            if (destination.type === 'go') {
                persistRememberedEmail(form);
                location.href = destination.href;
            } else {
                showAlert(form, destination.message, 'error');
            }
            return;
        }

        if (type === 'forgot') {
            showAlert(form, result.data.message, 'info');
            return;
        }

        if (type === 'reset') {
            showAlert(form, 'Your password has been updated. Redirecting to log in\u2026', 'info');
            setTimeout(() => { location.href = 'login.html'; }, 1500);
            return;
        }
    } catch (error) {
        showAlert(form, 'Something went wrong. Please try again.');
    } finally {
        setLoading(submitButton, false);
    }
}

function setupForm(form) {
    const inputs = $$('[data-rule]', form);
    const submitButton = $('[type="submit"]', form);

    if (form.dataset.authForm === 'login') applyRememberedEmail(form);

    setupPasswordRequirements($('[data-requirements]', form), $('[name="password"]', form));
    attachLiveValidation(inputs, form);

    form.addEventListener('submit', event => {
        event.preventDefault();
        submitForm(form, submitButton);
    });
}

// Surfaces the reason a guard (app-guard.js on pages/app/*, admin-guard.js on
// pages/admin/*) just bounced the person back here — e.g. "your session has
// expired" or "your account is still awaiting review" — instead of silently
// dropping them on the login screen with no explanation.
function showGuardDenialIfAny() {
    const loginForm = $('[data-auth-form="login"]');
    if (!loginForm) return;

    let reason = null;
    try {
        reason = sessionStorage.getItem('qcu.appGuardDeniedReason') || sessionStorage.getItem('qcu.adminDeniedReason');
        sessionStorage.removeItem('qcu.appGuardDeniedReason');
        sessionStorage.removeItem('qcu.adminDeniedReason');
    } catch (error) { /* ignore */ }

    if (reason) showAlert(loginForm, reason, 'info');
}

export function initAuthForms() {
    $$('[data-auth-form]').forEach(setupForm);
    showGuardDenialIfAny();
}

// "Continue with Google" button on login.html / register.html. Clicking it redirects the
export function initGoogleButton() {
    const button = $('[data-google-signin]');

    if (!button) return;

    button.addEventListener('click', async () => {
        setLoading(button, true);

        const result = await AuthService.signInWithGoogle();

        if (!result.ok) {
            setLoading(button, false);
            const card = button.closest('.auth-card');
            if (card) showAlert(card, result.message);
        }
    });
}

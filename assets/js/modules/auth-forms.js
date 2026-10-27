/* Single-step authentication forms: login, forgot password and reset password. */

import { AuthService } from '../services/auth-service.js';
import { validators } from '../utils/validation.js';
import {
    $,
    $$,
    readValue,
    setFieldError,
    setLoading,
    setupPasswordRequirements,
    showAlert,
} from '../utils/auth-ui.js';

const RULES = {
    email: input => validators.email(readValue(input)),
    password: input => validators.password(readValue(input)),
    newPassword: input => validators.newPassword(readValue(input)),
    confirm: (input, form) => validators.confirm(readValue(input), $('[name="password"]', form).value),
};

/* Integration point: each handler forwards the validated values to the auth service. */
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

        /* A successful result will be handled here once the real auth service is connected. */
        if (!result.ok) showAlert(form, result.message, 'info');
    } catch (error) {
        showAlert(form, 'Something went wrong. Please try again.');
    } finally {
        setLoading(submitButton, false);
    }
}

function setupForm(form) {
    const inputs = $$('[data-rule]', form);
    const submitButton = $('[type="submit"]', form);

    setupPasswordRequirements($('[data-requirements]', form), $('[name="password"]', form));
    attachLiveValidation(inputs, form);

    form.addEventListener('submit', event => {
        event.preventDefault();
        submitForm(form, submitButton);
    });
}

export function initAuthForms() {
    $$('[data-auth-form]').forEach(setupForm);
}

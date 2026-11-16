// Small DOM helpers shared by every authentication page (ES module).

import { normalizeText, normalizeEmail } from './sanitize.js';

export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function setFieldError(input, message) {
    const field = input.closest('.auth-field');
    const errorElement = field && $('.auth-error', field);

    input.setAttribute('aria-invalid', message ? 'true' : 'false');

    if (errorElement) {
        errorElement.textContent = message;
        errorElement.hidden = !message;
    }
}

export function showAlert(container, message, kind = 'error') {
    const box = $('[data-alert]', container);

    if (!box) return;

    box.className = `auth-alert ${kind}`;
    box.textContent = message;
    box.hidden = !message;
}

export function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.classList.toggle('is-loading', isLoading);
    button.setAttribute('aria-busy', String(isLoading));
}

export function readValue(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'password') return input.value;
    if (input.type === 'email') return normalizeEmail(input.value);
    return normalizeText(input.value);
}


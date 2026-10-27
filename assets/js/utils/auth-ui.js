/* Small DOM helpers shared by every authentication page (ES module). */

import { normalizeText, normalizeEmail } from './sanitize.js';
import { PASSWORD_RULES } from './validation.js';

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

export function setupPasswordToggles(root = document) {
    $$('[data-toggle-password]', root).forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.togglePassword);
            const shouldShow = input.type === 'password';

            input.type = shouldShow ? 'text' : 'password';
            button.setAttribute('aria-pressed', String(shouldShow));
            button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
            $('i', button).className = shouldShow ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    });
}

export function setupPasswordRequirements(list, passwordInput) {
    if (!list || !passwordInput) return;

    list.innerHTML = PASSWORD_RULES.map(rule => `
        <li data-rule-id="${rule.id}">
            <i class="bi bi-circle" aria-hidden="true"></i>
            <span>${rule.label}</span>
            <span class="visually-hidden" data-state>not met</span>
        </li>`).join('');

    function update() {
        PASSWORD_RULES.forEach(rule => {
            const isMet = rule.test(passwordInput.value);
            const item = $(`[data-rule-id="${rule.id}"]`, list);

            item.classList.toggle('met', isMet);
            $('i', item).className = isMet ? 'bi bi-check-circle-fill' : 'bi bi-circle';
            $('[data-state]', item).textContent = isMet ? 'met' : 'not met';
        });
    }

    passwordInput.addEventListener('input', update);
    update();
}

/* Client-side validation (ES module).
   This only improves form usability. It is NOT security: the server must re-validate everything. */

import { APP_CONFIG } from '../core/config.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULES = [
    {
        id: 'length',
        label: `At least ${APP_CONFIG.passwordMinLength} characters`,
        test: value => value.length >= APP_CONFIG.passwordMinLength,
    },
    {
        id: 'upper',
        label: 'One uppercase letter',
        test: value => /[A-Z]/.test(value),
    },
    {
        id: 'lower',
        label: 'One lowercase letter',
        test: value => /[a-z]/.test(value),
    },
    {
        id: 'number',
        label: 'One number',
        test: value => /\d/.test(value),
    },
];

export function isEmail(value) {
    return EMAIL_PATTERN.test(value);
}

export function passwordIssues(value) {
    return PASSWORD_RULES.filter(rule => !rule.test(value)).map(rule => rule.id);
}

/* Each validator returns an error message, or '' when valid. */
export const validators = {
    email: value => {
        if (!value) return 'Enter your personal email address.';
        return isEmail(value) ? '' : 'Enter a valid email address, for example name@example.com.';
    },

    password: value => (value ? '' : 'Enter your password.'),

    newPassword: value => {
        if (!value) return 'Create a password.';
        return passwordIssues(value).length ? 'Your password does not meet all the requirements.' : '';
    },

    confirm: (value, original) => {
        if (!value) return 'Enter your password again.';
        return value === original ? '' : 'The passwords do not match.';
    },

    select: label => value => (value ? '' : `Select your ${label}.`),

    consent: message => checked => (checked ? '' : message),
};

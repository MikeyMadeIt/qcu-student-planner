// Client-side validation (ES module).

export const validators = {
    select: label => value => (value ? '' : `Select your ${label}.`),

    consent: message => checked => (checked ? '' : message),

    fullName: value => {
        if (!value.trim()) return 'Enter your full name.';
        if (value.trim().length < 2) return 'Enter your full name.';
        return /^[a-zA-Z\u00C0-\u017F‘’\d.,'\"\- ]+$/.test(value.trim()) ? '' : 'Use letters, numbers, and standard punctuation for your full name.';

    },

};

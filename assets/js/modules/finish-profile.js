/* pages/auth/finish-profile.html entry point (ES module). Only reached by a Google sign-in
   whose profile is still missing program/campus/year level/section -- password sign-ups always
   collect these during register-wizard.js and never see this page. */

import { AuthService } from '../services/auth-service.js';
import { APP_CONFIG } from '../core/config.js';
import { loadRegistrationOptions } from '../data/registration-options.js';
import { validators } from '../utils/validation.js';
import { needsProfileDetails } from '../utils/auth-routing.js';
import {
    $,
    $$,
    readValue,
    setFieldError,
    setLoading,
    showAlert,
} from '../utils/auth-ui.js';

const FIELD_RULES = {
    fullName: value => validators.fullName(value),
    program: validators.select('program'),
    campus: validators.select('campus'),
    yearLevel: validators.select('year level'),
    section: value => validators.section(value),
    acceptTerms: validators.consent('Accept the Terms and Conditions and Privacy Notice to continue.'),
};

function createOption(value, label = value) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
}

function fillSelect(select, options) {
    const placeholder = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (placeholder) select.appendChild(placeholder);
    options.forEach(option => select.appendChild(option));
}

function buildProgramOptions(colleges) {
    return colleges.map(college => {
        const group = document.createElement('optgroup');
        group.label = college.college;
        college.programs.forEach(program => {
            group.appendChild(createOption(program.code, `${program.title} (${program.code})`));
        });
        return group;
    });
}

async function populateOptions(form) {
    try {
        const options = await loadRegistrationOptions();
        fillSelect(form.elements.program, buildProgramOptions(options.colleges));
        fillSelect(form.elements.campus, options.campuses.map(campus => createOption(campus)));
        fillSelect(form.elements.yearLevel, options.yearLevels.map(level => createOption(level)));
    } catch (error) {
        showAlert(form, 'The program, campus and year level lists could not be loaded. Reload the page to try again.');
    }
}

function validateField(form, name) {
    const input = form.elements[name];
    const message = FIELD_RULES[name](readValue(input), form);
    setFieldError(input, message);
    return !message;
}

function attachFieldListeners(form) {
    Object.keys(FIELD_RULES).forEach(name => {
        const input = form.elements[name];
        const isCheckbox = input.type === 'checkbox';
        input.addEventListener(isCheckbox || input.tagName === 'SELECT' ? 'change' : 'blur', () => validateField(form, name));
        if (!isCheckbox) {
            input.addEventListener('input', () => {
                if (input.getAttribute('aria-invalid') === 'true') validateField(form, name);
            });
        }
    });
}

function showSubmittedConfirmation() {
    try {
        sessionStorage.setItem(APP_CONFIG.registrationPreviewFlag, '1');
    } catch (error) {
        /* pending.html falls back to its default message. */
    }
    location.href = APP_CONFIG.routes.pending;
}

async function submitDetails(form, submitButton) {
    const results = Object.keys(FIELD_RULES).map(name => validateField(form, name));

    if (results.includes(false)) {
        const firstInvalid = Object.keys(FIELD_RULES).find(name => form.elements[name].getAttribute('aria-invalid') === 'true');
        if (firstInvalid) form.elements[firstInvalid].focus();
        return;
    }

    setLoading(submitButton, true);
    showAlert(form, '');

    const result = await AuthService.completeProfile({
        fullName: readValue(form.elements.fullName),
        program: form.elements.program.value,
        campus: form.elements.campus.value,
        yearLevel: form.elements.yearLevel.value,
        section: readValue(form.elements.section),
    });

    if (!result.ok) {
        showAlert(form, result.message);
        setLoading(submitButton, false);
        return;
    }

    showSubmittedConfirmation();
}

async function guardAndPrefill(form) {
    const profileResult = await AuthService.getCurrentProfile();

    if (!profileResult.ok) {
        location.replace(APP_CONFIG.routes.login);
        return;
    }

    const profile = profileResult.data;

    if (profile.account_status !== 'pending') {
        /* Already decided one way or another (or approved) -- this step no longer applies. */
        if (profile.account_status === 'approved') {
            location.replace(profile.role === 'admin' ? '../admin/dashboard.html' : APP_CONFIG.routes.dashboard);
        } else {
            location.replace(APP_CONFIG.routes.login);
        }
        return;
    }

    if (!needsProfileDetails(profile)) {
        location.replace(APP_CONFIG.routes.pending);
        return;
    }

    if (profile.full_name) form.elements.fullName.value = profile.full_name;

    form.hidden = false;
    $('[data-finish-profile-loading]')?.setAttribute('hidden', '');
}

export function initFinishProfile() {
    const form = $('[data-finish-profile-form]');

    if (!form) return;

    attachFieldListeners(form);
    populateOptions(form);
    guardAndPrefill(form);

    form.addEventListener('submit', event => {
        event.preventDefault();
        submitDetails(form, $('[data-submit]', form));
    });
}

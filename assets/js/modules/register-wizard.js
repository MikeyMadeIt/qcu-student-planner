/* Three-step registration wizard (ES module).
   Frontend only: nothing is stored or sent. The submit step calls AuthService.signUp, which is the
   backend integration point. */

import { AuthService, AUTH_NOT_CONFIGURED } from '../services/auth-service.js';
import { APP_CONFIG } from '../core/config.js';
import { loadRegistrationOptions } from '../data/registration-options.js';
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

const TOTAL_STEPS = 3;

/* Fields to validate on each step, in display order. */
const STEP_FIELDS = {
    1: ['email', 'password', 'confirmPassword'],
    2: ['program', 'campus', 'yearLevel'],
    3: ['acceptTerms', 'acknowledgePrivacy'],
};

const FIELD_RULES = {
    email: (value) => validators.email(value),
    password: (value) => validators.newPassword(value),
    confirmPassword: (value, form) => validators.confirm(value, form.elements.password.value),
    program: validators.select('program'),
    campus: validators.select('campus'),
    yearLevel: validators.select('year level'),
    acceptTerms: validators.consent('Accept the Terms and Conditions to continue.'),
    acknowledgePrivacy: validators.consent('Acknowledge the Privacy Notice to continue.'),
};

let currentStep = 1;
let isSubmitting = false;

/* ---------- Validation ---------- */

function validateField(form, name) {
    const input = form.elements[name];
    const message = FIELD_RULES[name](readValue(input), form);

    setFieldError(input, message);

    return !message;
}

function validateStep(form, step) {
    const results = STEP_FIELDS[step].map(name => validateField(form, name));
    const firstInvalid = STEP_FIELDS[step].find(name => form.elements[name].getAttribute('aria-invalid') === 'true');

    if (firstInvalid) form.elements[firstInvalid].focus();

    return !results.includes(false);
}

function findFirstInvalidStep(form) {
    for (let step = 1; step <= TOTAL_STEPS; step += 1) {
        const hasError = STEP_FIELDS[step].some(name => FIELD_RULES[name](readValue(form.elements[name]), form));

        if (hasError) return step;
    }

    return null;
}

/* ---------- Step display ---------- */

function updateStepper(stepper) {
    $$('[data-step-indicator]', stepper).forEach(item => {
        const step = Number(item.dataset.stepIndicator);
        const isCurrent = step === currentStep;
        const isComplete = step < currentStep;

        item.classList.toggle('is-current', isCurrent);
        item.classList.toggle('is-complete', isComplete);

        if (isCurrent) {
            item.setAttribute('aria-current', 'step');
        } else {
            item.removeAttribute('aria-current');
        }

        $('[data-step-status]', item).textContent = isComplete ? 'completed' : isCurrent ? 'current step' : 'not started';
        $('.stepper-marker', item).innerHTML = isComplete
            ? '<i class="bi bi-check-lg" aria-hidden="true"></i>'
            : String(step);
    });
}

function showStep(form, stepper, step, { moveFocus = true } = {}) {
    currentStep = step;

    $$('[data-step]', form).forEach(panel => {
        panel.hidden = Number(panel.dataset.step) !== step;
    });

    updateStepper(stepper);
    showAlert(form, '');

    if (!moveFocus) return;

    const heading = $(`[data-step="${step}"] [data-step-heading]`, form);

    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ---------- Dropdown options ---------- */

function fillSelect(select, options) {
    const placeholder = select.querySelector('option[value=""]');

    select.innerHTML = '';
    select.appendChild(placeholder);

    options.forEach(option => select.appendChild(option));
}

function createOption(value, label = value) {
    const option = document.createElement('option');

    option.value = value;
    option.textContent = label;

    return option;
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
    const status = $('[data-options-status]', form);

    try {
        const options = await loadRegistrationOptions();

        fillSelect(form.elements.program, buildProgramOptions(options.colleges));
        fillSelect(form.elements.campus, options.campuses.map(campus => createOption(campus)));
        fillSelect(form.elements.yearLevel, options.yearLevels.map(level => createOption(level)));
    } catch (error) {
        status.hidden = false;
        status.textContent = 'The program, campus and year level lists could not be loaded. Reload the page to try again.';
    }
}

/* ---------- Submission ---------- */

function collectRegistration(form) {
    return {
        email: readValue(form.elements.email),
        password: form.elements.password.value,
        program: form.elements.program.value,
        campus: form.elements.campus.value,
        yearLevel: form.elements.yearLevel.value,
        acceptedTerms: form.elements.acceptTerms.checked,
        acknowledgedPrivacy: form.elements.acknowledgePrivacy.checked,
    };
}

function showSubmittedConfirmation() {
    try {
        sessionStorage.setItem(APP_CONFIG.registrationPreviewFlag, '1');
    } catch (error) {
        /* The confirmation page falls back to its default message. */
    }

    location.href = APP_CONFIG.routes.pending;
}

async function submitRegistration(form, stepper, submitButton) {
    if (isSubmitting) return;

    const invalidStep = findFirstInvalidStep(form);

    if (invalidStep) {
        showStep(form, stepper, invalidStep);
        validateStep(form, invalidStep);
        showAlert(form, 'Please complete this step before submitting your registration.');
        return;
    }

    isSubmitting = true;
    setLoading(submitButton, true);

    try {
        const registration = collectRegistration(form);
        setSelectedProgram(registration.program);
        const result = await AuthService.signUp(registration);

        /* Until the backend exists the service reports AUTH_NOT_CONFIGURED. That still shows the
           frontend-only confirmation, which states plainly that nothing was created or sent. */
        if (result.ok || result.code === AUTH_NOT_CONFIGURED) {
            showSubmittedConfirmation();
            return;
        }

        showAlert(form, result.message);
    } catch (error) {
        showAlert(form, 'Something went wrong. Please try again.');
    }

    isSubmitting = false;
    setLoading(submitButton, false);
}

/* ---------- Setup ---------- */

function attachFieldListeners(form) {
    Object.keys(FIELD_RULES).forEach(name => {
        const input = form.elements[name];
        const isCheckbox = input.type === 'checkbox';

        input.addEventListener(isCheckbox ? 'change' : 'blur', () => validateField(form, name));

        input.addEventListener('input', () => {
            if (input.getAttribute('aria-invalid') === 'true') validateField(form, name);
        });

        if (input.tagName === 'SELECT') {
            input.addEventListener('change', () => validateField(form, name));
        }
    });

    form.elements.password.addEventListener('input', () => {
        if (form.elements.confirmPassword.value) validateField(form, 'confirmPassword');
    });
}

function attachNavigation(form, stepper) {
    $$('[data-step-next]', form).forEach(button => {
        button.addEventListener('click', () => {
            if (validateStep(form, currentStep)) showStep(form, stepper, currentStep + 1);
        });
    });

    $$('[data-step-back]', form).forEach(button => {
        button.addEventListener('click', () => showStep(form, stepper, currentStep - 1));
    });

    form.addEventListener('submit', event => {
        event.preventDefault();

        if (currentStep < TOTAL_STEPS) {
            if (validateStep(form, currentStep)) showStep(form, stepper, currentStep + 1);
            return;
        }

        submitRegistration(form, stepper, $('[data-submit]', form));
    });
}

export function initRegisterWizard() {
    const form = $('[data-register-wizard]');

    if (!form) return;

    const stepper = $('[data-stepper]');

    setupPasswordRequirements($('[data-requirements]', form), form.elements.password);
    attachFieldListeners(form);
    attachNavigation(form, stepper);
    populateOptions(form);
    showStep(form, stepper, 1, { moveFocus: false });
}

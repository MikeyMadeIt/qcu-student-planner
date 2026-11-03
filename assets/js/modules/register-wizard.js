/* Three-step registration wizard (ES module).
   The submit step calls AuthService.signUp, which creates the Supabase Auth user and records
   the submitted program/campus/year on the pending profile row via the submit_profile_details RPC. */

import { AuthService } from '../services/auth-service.js';
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
    1: ['fullName', 'email', 'password', 'confirmPassword'],
    2: ['program', 'campus', 'yearLevel', 'section'],
    3: ['acceptTerms', 'acknowledgePrivacy'],
};

const FIELD_RULES = {
    fullName: (value) => validators.fullName(value),
    email: (value) => validators.email(value),
    password: (value) => validators.newPassword(value),
    confirmPassword: (value, form) => validators.confirm(value, form.elements.password.value),
    program: validators.select('program'),
    campus: validators.select('campus'),
    yearLevel: validators.select('year level'),
    section: (value) => validators.section(value),
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

/* Last-resort popup: loadRegistrationOptions() already falls back to an embedded copy of the
   data, so this only fires if that embedded fallback is itself somehow malformed. Built as a
   minimal Bootstrap modal (Bootstrap's JS bundle is loaded on this page) rather than the old
   inline banner, so the failure is impossible to miss. */
function ensureOptionsErrorModal() {
    if (document.getElementById('optionsErrorModal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="modal fade" id="optionsErrorModal" tabindex="-1" aria-modal="true" role="alertdialog" aria-labelledby="optionsErrorTitle" aria-describedby="optionsErrorMessage">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-pad text-center">
          <div class="confirm-icon-wrap" style="background:rgba(251,113,133,.15)">
            <i class="bi bi-exclamation-triangle-fill confirm-icon" style="color:#fb7185" aria-hidden="true"></i>
          </div>
          <h5 id="optionsErrorTitle" class="mb-1">Couldn't load program options</h5>
          <p class="text-soft mb-0 confirm-message" id="optionsErrorMessage">The program, campus and year level lists could not be loaded.</p>
          <div class="d-flex gap-2 mt-3">
            <button type="button" class="btn btn-ghost flex-grow-1" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-accent flex-grow-1" id="optionsErrorRetryBtn">Try again</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
}

function showOptionsErrorModal(form) {
    ensureOptionsErrorModal();

    const retryButton = document.getElementById('optionsErrorRetryBtn');
    const freshButton = retryButton.cloneNode(true);
    retryButton.parentNode.replaceChild(freshButton, retryButton);
    freshButton.addEventListener('click', () => {
        bootstrap.Modal.getInstance(document.getElementById('optionsErrorModal'))?.hide();
        populateOptions(form);
    });

    const modal = new bootstrap.Modal(document.getElementById('optionsErrorModal'));
    modal.show();
}

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
    const submitButtons = $$('[data-step-next], [data-submit]', form);

    status.hidden = true;
    status.innerHTML = '';
    submitButtons.forEach(button => { button.disabled = false; });

    try {
        const options = await loadRegistrationOptions();

        fillSelect(form.elements.program, buildProgramOptions(options.colleges));
        fillSelect(form.elements.campus, options.campuses.map(campus => createOption(campus)));
        fillSelect(form.elements.yearLevel, options.yearLevels.map(level => createOption(level)));
    } catch (error) {
        /* True last resort: loadRegistrationOptions() already has its own embedded fallback, so
           reaching here means even that fallback failed to apply (e.g. it was malformed). Keep an
           accessible, mostly-hidden status message for assistive tech, and surface the real,
           user-visible error as a popup instead of inline page text. */
        submitButtons.forEach(button => { button.disabled = true; });
        status.hidden = false;
        status.textContent = 'The program, campus and year level lists could not be loaded.';
        showOptionsErrorModal(form);
    }
}

/* ---------- Submission ---------- */

function collectRegistration(form) {
    return {
        fullName: readValue(form.elements.fullName),
        email: readValue(form.elements.email),
        password: form.elements.password.value,
        program: form.elements.program.value,
        campus: form.elements.campus.value,
        yearLevel: form.elements.yearLevel.value,
        section: readValue(form.elements.section),
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
        const result = await AuthService.signUp(registration);

        if (result.ok) {
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

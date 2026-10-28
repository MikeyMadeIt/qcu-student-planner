/* Data access for the registration dropdown options (ES module).
   Today this reads a static JSON file (assets/data/registration-options.json). A future backend
   can replace the fetch call. If the fetch fails for any reason (network error, bad status, a
   relative fetch() blocked under file:// or a different base path, malformed JSON, ...), we fall
   back to an embedded copy of the same data below so the registration form always has options to
   show, instead of leaving the user stuck on a broken step. */

import { APP_CONFIG } from '../core/config.js';

/* Keep this in sync with assets/data/registration-options.json. Shape matches exactly what
   populateOptions() in register-wizard.js expects: { campuses, yearLevels, colleges }. */
const FALLBACK_OPTIONS = {
    campuses: [
        'San Bartolome',
        'Batasan',
        'San Francisco',
    ],
    yearLevels: [
        '1st Year',
        '2nd Year',
        '3rd Year',
        '4th Year',
    ],
    colleges: [
        {
            college: 'College of Accountancy',
            programs: [
                { code: 'BSA', title: 'Bachelor of Science in Accountancy' },
            ],
        },
        {
            college: 'College of Business Administration',
            programs: [
                { code: 'BS Entrep', title: 'Bachelor of Science in Entrepreneurship' },
                { code: 'BSMA', title: 'Bachelor of Science in Management Accounting' },
            ],
        },
        {
            college: 'College of Computer Studies',
            programs: [
                { code: 'BSCS', title: 'Bachelor of Science in Computer Science' },
                { code: 'BSIT', title: 'Bachelor of Science in Information Technology' },
                { code: 'BSIS', title: 'Bachelor of Science in Information Systems' },
                { code: 'BSCpE', title: 'Bachelor of Science in Computer Engineering' },
            ],
        },
        {
            college: 'College of Engineering',
            programs: [
                { code: 'BSIE', title: 'Bachelor of Science in Industrial Engineering' },
                { code: 'BSECE', title: 'Bachelor of Science in Electronics Engineering' },
            ],
        },
        {
            college: 'College of Education',
            programs: [
                { code: 'BECEd', title: 'Bachelor of Early Childhood Education' },
            ],
        },
    ],
};

export async function loadRegistrationOptions() {
    try {
        const response = await fetch(APP_CONFIG.registrationOptionsUrl);

        if (!response.ok) {
            throw new Error(`Options request failed with status ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.warn('Registration options could not be fetched; using the built-in fallback list.', error);
        return FALLBACK_OPTIONS;
    }
}

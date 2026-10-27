/* Data access for the registration dropdown options (ES module).
   Today this reads a static JSON file. A future backend can replace the fetch call. */

import { APP_CONFIG } from '../core/config.js';

export async function loadRegistrationOptions() {
    const response = await fetch(APP_CONFIG.registrationOptionsUrl);

    if (!response.ok) {
        throw new Error(`Options request failed with status ${response.status}`);
    }

    return response.json();
}

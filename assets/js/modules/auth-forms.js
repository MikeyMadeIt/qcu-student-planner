// Google sign-in button shared by every auth page that shows one (login, finish-profile).

import { AuthService } from '../services/auth-service.js';
import { $, showAlert, setLoading } from '../utils/auth-ui.js';

// "Continue with Google" button on login.html. Clicking it redirects the
// browser to Google, then back to callback.html once the person signs in.
export function initGoogleButton() {
    const button = $('[data-google-signin]');

    if (!button) return;

    button.addEventListener('click', async () => {
        setLoading(button, true);

        const result = await AuthService.signInWithGoogle();

        if (!result.ok) {
            setLoading(button, false);
            const card = button.closest('.auth-card');
            if (card) showAlert(card, result.message);
        }
    });
}

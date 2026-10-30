/* Entry point for every authentication page (ES module). */

import { setupPasswordToggles } from '../utils/auth-ui.js';
import { initAuthForms, initGoogleButton } from './auth-forms.js';
import { initRegisterWizard } from './register-wizard.js';
import { initStatusPage } from './auth-status.js';
import { initAuthCallback } from './auth-callback.js';
import { initFinishProfile } from './finish-profile.js';

setupPasswordToggles();
initAuthForms();
initGoogleButton();
initRegisterWizard();
initStatusPage();
initAuthCallback();
initFinishProfile();

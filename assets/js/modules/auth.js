/* Entry point for every authentication page (ES module). */

import { setupPasswordToggles } from '../utils/auth-ui.js';
import { initAuthForms } from './auth-forms.js';
import { initRegisterWizard } from './register-wizard.js';
import { initStatusPage } from './auth-status.js';

setupPasswordToggles();
initAuthForms();
initRegisterWizard();
initStatusPage();

// Entry point for every authentication page (ES module).

import { initGoogleButton } from './auth-forms.js';
import { initStatusPage } from './auth-status.js';
import { initAuthCallback } from './auth-callback.js';
import { initFinishProfile } from './finish-profile.js';
import { initAuthSessionGuard } from './auth-session-guard.js';

initGoogleButton();
initStatusPage();
initAuthCallback();
initFinishProfile();
initAuthSessionGuard();

// pages/auth/login.html entry point (ES module). This fixes the specific
// "back button logs me out" complaint:
//
//   dashboard.html --(back)--> Google's account picker --(back)--> login.html
//
// Nothing in that flow actually signs the person out — the Supabase session
// is still sitting there untouched. The problem is purely that landing back
// on login.html shows the signed-OUT screen with no attempt to check whether
// a session already exists, so it *looks and feels* like a forced logout.
// Two extra wrinkles make this worse than a normal page load:
//   1. Browsers often restore login.html from the back/forward cache (bfcache)
//      on a back-navigation instead of re-running everything from scratch, so
//      a plain top-of-script check isn't guaranteed to run at the moment the
//      person actually lands on the page.
//   2. The Google OAuth hop also leaves its own page(s) in the back/forward
//      history, which we can't remove retroactively — so this fixes the
//      symptom (showing a false "logged out" screen) rather than trying to
//      rewrite history we don't control.
//
// Fix: on every "did the person just arrive at this page" moment (initial
// load AND bfcache restore via pageshow), check for a live session. If one
// exists, skip the login screen and go straight to the same place
// callback.html would have sent them — no re-authentication needed.

import { AuthService } from '../services/auth-service.js';
import { getSupabase } from '../core/supabase-client.js';
import { resolveLandingRoute, needsProfileDetails } from '../utils/auth-routing.js';

let checking = false;

async function bounceIfAlreadySignedIn() {
    if (checking) return;
    checking = true;

    try {
        // A plain, immediate check — unlike callback.html we're not waiting
        // on a fresh OAuth redirect to land, just asking "is there already
        // a live session right now". No artificial delay for the normal
        // (not-signed-in) visitor.
        const { data: sessionData } = await getSupabase().auth.getSession();
        if (!sessionData || !sessionData.session) return;

        const profileResult = await AuthService.getCurrentProfile();
        if (!profileResult.ok) return;

        const profile = profileResult.data;
        const destination = resolveLandingRoute({
            role: profile.role,
            accountStatus: profile.account_status,
            rejectionReason: profile.rejection_reason,
            needsProfileDetails: needsProfileDetails(profile),
        });

        // Only act on a clean "go". A blocked/pending account should still
        // see the normal login screen rather than being silently bounced.
        if (destination.type === 'go') {
            location.replace(destination.href);
        }
    } catch (error) {
        // Fall through silently — worst case, the person just sees the
        // normal login screen and can sign in again. That's the existing
        // behavior, not a regression.
    } finally {
        checking = false;
    }
}

export function initAuthSessionGuard() {
    if (document.body.dataset.authSessionGuard === undefined) return;

    bounceIfAlreadySignedIn();

    // Covers the back-button case specifically: a bfcache restore fires
    // pageshow with event.persisted === true instead of re-running this
    // module from the top.
    window.addEventListener('pageshow', event => {
        if (event.persisted) bounceIfAlreadySignedIn();
    });

    // Belt-and-suspenders for browsers/situations where bfcache doesn't
    // kick in and the tab is just reused: re-check when the tab regains
    // focus/visibility after having been backgrounded.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') bounceIfAlreadySignedIn();
    });
}

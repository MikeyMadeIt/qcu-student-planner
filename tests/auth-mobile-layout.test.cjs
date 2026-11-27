const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const login = fs.readFileSync('pages/auth/login.html', 'utf8');
const callback = fs.readFileSync('pages/auth/callback.html', 'utf8');
const finishProfile = fs.readFileSync('pages/auth/finish-profile.html', 'utf8');
const authCss = fs.readFileSync('assets/css/pages/auth.css', 'utf8');

test('mobile login retains QCU sign-in, email, legal links, and independent-project notice', () => {
  assert.match(login, /images\/logo\/kyusiyu-student-planner\.png/);
  assert.match(login, /data-theme-toggle/);
  assert.match(login, /data-google-signin/);
  assert.match(login, /Sign in to continue/);
  assert.match(login, /lastname\.firstname\.middlename@gmail\.com/);
  assert.match(login, /independent student-developed project[\s\S]*?Quezon City University/);
  assert.match(login, /legal-policies\.html#terms-of-service/);
  assert.match(login, /legal-policies\.html#privacy-policy/);
  assert.match(authCss, /@media \(max-width: 575\.98px\)/);
  assert.match(authCss, /min-height: 100dvh/);
  assert.match(authCss, /env\(safe-area-inset-top/);
  assert.match(authCss, /\.auth-login-intro\s*\{\s*display:\s*none;/);
  assert.match(authCss, /\.auth-login-main > \.auth-login-card\s*\{\s*display:\s*contents;/);
  assert.match(authCss, /\.auth-login-card > \.auth-hint\s*\{\s*order:\s*4;/);
  assert.match(authCss, /\.auth-login-card > \.auth-independent-note\s*\{\s*order:\s*5;/);
  assert.match(authCss, /\.auth-login-card > \[data-google-signin\]\s*\{\s*order:\s*6;/);
  assert.match(authCss, /\.auth-login-card > \.auth-consent-mobile\s*\{\s*order:\s*7;/);
});

test('finish profile keeps its required fields and uses a mobile-only readiness state', () => {
  for (const name of ['fullName', 'program', 'campus', 'yearLevel', 'acceptTerms']) {
    assert.match(finishProfile, new RegExp(`name="${name}"`));
  }
  assert.match(finishProfile, /data-finish-profile-form/);
  assert.match(finishProfile, /data-finish-profile-loading/);
  assert.match(authCss, /\.auth-profile-main:not\(\.is-profile-ready\) \.auth-profile-content\s*\{\s*display:\s*none;/);
  assert.match(finishProfile, /data-theme-toggle/);
});

function createCallbackContext(profile) {
  const progress = [];
  const elements = Object.fromEntries([
    '[data-callback-title]', '[data-callback-subtitle]', '[data-callback-message]',
    '[data-callback-actions]', '[data-callback-spinner]',
  ].map(selector => [selector, {
    hidden: selector === '[data-callback-message]' || selector === '[data-callback-actions]' ? true : false,
    set textContent(value) { this._textContent = value; progress.push([selector, value]); },
    get textContent() { return this._textContent || ''; },
    setAttribute(name) { if (name === 'hidden') this.hidden = true; },
  }]));
  const location = { search: '', hash: '', replace: value => { location.destination = value; } };
  const context = {
    URLSearchParams,
    location,
    document: { body: { dataset: { authCallback: 'true' } } },
    AuthService: {
      waitForOAuthSession: async () => ({ user: { id: 'user-1' } }),
      getCurrentProfile: async () => ({ ok: true, data: profile }),
      signOut: async () => { context.signedOut = true; },
    },
    $: selector => elements[selector],
    progress,
  };
  vm.createContext(context);
  const routingSource = fs.readFileSync('assets/js/utils/auth-routing.js', 'utf8').replace(/export /g, '');
  vm.runInContext(routingSource, context);
  const callbackSource = fs.readFileSync('assets/js/modules/auth-callback.js', 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace('export function initAuthCallback()', 'function initAuthCallback()');
  vm.runInContext(callbackSource, context);
  return context;
}

test('callback shows distinct verification stages and preserves approval routing', async () => {
  const context = createCallbackContext({ role: 'student', account_status: 'approved', course: 'BSIT', year_level: '1', school: 'Main' });
  await context.handleCallback();
  const titles = context.progress.filter(([selector]) => selector === '[data-callback-title]').map(([, value]) => value);
  assert.deepEqual(titles, ['Verifying your sign-in', 'Loading your profile', 'Checking account access']);
  assert.equal(context.location.destination, '../app/dashboard.html');

  const pending = createCallbackContext({ role: 'student', account_status: 'pending', course: '', year_level: '', school: '' });
  await pending.handleCallback();
  assert.equal(pending.location.destination, 'finish-profile.html');

  const rejected = createCallbackContext({ role: 'student', account_status: 'rejected', rejection_reason: 'Not eligible', course: 'BSIT', year_level: '1', school: 'Main' });
  await rejected.handleCallback();
  assert.equal(rejected.signedOut, true);
});

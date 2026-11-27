const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('assets/js/services/auth-service.js', 'utf8')
  .replace("import { getSupabase } from '../core/supabase-client.js';", '')
  .replace('export const AUTH_NOT_CONFIGURED', 'const AUTH_NOT_CONFIGURED')
  .replace('export const AuthService', 'const AuthService');

function makeService({ syncStatus, signOutError = null }) {
  const calls = { signOut: 0, clearCache: 0 };
  const context = vm.createContext({
    getSupabase: () => ({ auth: { signOut: async () => { calls.signOut++; return { error: signOutError }; } } }),
    window: { CloudSync: {
      waitForPendingSync: async () => {},
      getSyncStatus: () => syncStatus,
    } },
    DB: { clearPrivateCacheOnSignOut: () => { calls.clearCache++; } },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    URL,
  });
  vm.runInContext(`${source}\n;({ AuthService })`, context);
  return { service: vm.runInContext('AuthService', context), calls };
}

test('sign-out preserves the local cache when synchronization has failed', async () => {
  const { service, calls } = makeService({ syncStatus: { pending: false, error: { area: 'tasks' } } });
  const result = await service.signOut();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SYNC_FAILED');
  assert.equal(calls.signOut, 0);
  assert.equal(calls.clearCache, 0);
});

test('sign-out preserves the local cache when the Auth request fails', async () => {
  const { service, calls } = makeService({ syncStatus: { pending: false, error: null }, signOutError: { message: 'network error' } });
  const result = await service.signOut();
  assert.equal(result.ok, false);
  assert.equal(calls.signOut, 1);
  assert.equal(calls.clearCache, 0);
});

test('successful sync and Auth sign-out clear the private local cache', async () => {
  const { service, calls } = makeService({ syncStatus: { pending: false, error: null } });
  const result = await service.signOut();
  assert.equal(result.ok, true);
  assert.equal(calls.signOut, 1);
  assert.equal(calls.clearCache, 1);
});

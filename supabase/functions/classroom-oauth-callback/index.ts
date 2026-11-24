import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createAdmin, safeRedirect, sha256 } from '../_shared/classroom.ts';

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const fail = (returnOrigin?: string | null) => safeRedirect('error', returnOrigin);

async function revokeGoogleCredential(token: unknown) {
  if (typeof token !== 'string' || !token) return;
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10000),
    });
  } catch { /* Best effort; the user-facing result never includes provider details. */ }
}

Deno.serve(async req => {
  if (req.method !== 'GET') return new Response('Method not allowed.', { status: 405, headers: { 'Cache-Control': 'no-store' } });
  let consumedReturnOrigin: string | null = null;
  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  if (!state || state.length > 512) return fail();
  const admin = createAdmin();
  const { data: transactionRows, error: transactionError } = await admin.rpc('classroom_consume_oauth_transaction_v2', { p_state_hash: await sha256(state) });
  const transaction = Array.isArray(transactionRows) ? transactionRows[0] : null;
  if (transactionError || !transaction) return fail();
  consumedReturnOrigin = typeof transaction.return_origin === 'string' ? transaction.return_origin : null;
  if (url.searchParams.has('error')) return safeRedirect(url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error', consumedReturnOrigin);
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return fail(consumedReturnOrigin);

  let exchangedTokens: Record<string, unknown> | null = null;
  try {
    const clientId = Deno.env.get('GOOGLE_CLASSROOM_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLASSROOM_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('configuration');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: transaction.redirect_uri,
        grant_type: 'authorization_code',
        code_verifier: transaction.pkce_verifier,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok) throw new Error('exchange');
    const tokens = await tokenResponse.json();
    exchangedTokens = tokens;
    if (!tokens.id_token || !tokens.access_token || !Number.isFinite(Number(tokens.expires_in))) throw new Error('token response');

    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_KEYS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.email_verified !== true || typeof payload.email !== 'string') throw new Error('identity');
    if (typeof payload.nonce !== 'string' || await sha256(payload.nonce) !== transaction.nonce_hash) throw new Error('nonce');

    const grantedScopes = typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : [];
    const requiredScopes = transaction.requested_scopes as string[];
    if (!requiredScopes.every(scope => grantedScopes.includes(scope))) throw new Error('scope');
    const { data: profile, error: profileError } = await admin.from('profiles').select('account_status').eq('id', transaction.user_id).maybeSingle();
    if (profileError || profile?.account_status !== 'approved') {
      await revokeGoogleCredential(tokens.refresh_token || tokens.access_token);
      return safeRedirect('not-approved', consumedReturnOrigin);
    }

    const { data: prior } = await admin.from('classroom_connections')
      .select('id, google_subject').eq('user_id', transaction.user_id)
      .in('status', ['connected', 'reauthorization_required']).maybeSingle();
    let priorToken: string | null = null;
    if (prior && prior.google_subject !== payload.sub) {
      const { data: storedToken } = await admin.rpc('classroom_get_refresh_token', {
        p_user_id: transaction.user_id, p_connection_id: prior.id,
      });
      if (typeof storedToken === 'string') priorToken = storedToken;
    }

    const expiresAt = new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString();
    const { error: saveError } = await admin.rpc('classroom_save_connection', {
      p_user_id: transaction.user_id,
      p_google_subject: payload.sub,
      p_google_email: payload.email,
      p_refresh_token: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : null,
      p_token_expires_at: expiresAt,
      p_granted_scopes: grantedScopes,
    });
    if (saveError) throw new Error('save');
    if (priorToken) {
      try {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: priorToken }), signal: AbortSignal.timeout(10000),
        });
      } catch { /* Local secret was removed atomically; remote revocation is best effort. */ }
    }
    return safeRedirect('connected', consumedReturnOrigin);
  } catch {
    // Provider payloads, OAuth codes, tokens, claims and internal DB errors are never logged or reflected.
    await revokeGoogleCredential(exchangedTokens?.refresh_token || exchangedTokens?.access_token);
    return fail(consumedReturnOrigin);
  }
});

import { allowedRequestOrigin, authenticatedApprovedUser, CLASSROOM_SCOPES, cors, isAllowedOrigin, json, randomBase64Url, sha256, sha256Base64Url } from '../_shared/classroom.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: isAllowedOrigin(req) ? 204 : 403, headers: cors(req) });
  }
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });
  const returnOrigin = allowedRequestOrigin(req);
  if (!returnOrigin) return json(req, 403, { error: 'This origin is not allowed.' });
  const auth = await authenticatedApprovedUser(req);
  if ('error' in auth) return json(req, auth.status, { error: auth.error });

  const clientId = Deno.env.get('GOOGLE_CLASSROOM_CLIENT_ID');
  const redirectUri = Deno.env.get('GOOGLE_CLASSROOM_REDIRECT_URI');
  if (!clientId || !redirectUri) return json(req, 503, { error: 'Google Classroom connection is not configured yet.' });
  try {
    if (redirectUri !== redirectUri.trim() || redirectUri.includes('\\') || redirectUri.includes('?') || redirectUri.includes('#')) {
      throw new Error('invalid callback');
    }
    const callbackUrl = new URL(redirectUri);
    const localhostHttp = callbackUrl.protocol === 'http:' && callbackUrl.hostname === 'localhost';
    if ((callbackUrl.protocol !== 'https:' && !localhostHttp) ||
        callbackUrl.username || callbackUrl.password || callbackUrl.search || callbackUrl.hash ||
        callbackUrl.pathname !== '/functions/v1/classroom-oauth-callback' || callbackUrl.origin === 'null') {
      throw new Error('invalid callback');
    }
    const state = randomBase64Url();
    const nonce = randomBase64Url();
    const verifier = randomBase64Url(48);
    const challenge = await sha256Base64Url(verifier);
    const { error } = await auth.admin.rpc('classroom_create_oauth_transaction_v2', {
      p_state_hash: await sha256(state),
      p_user_id: auth.user.id,
      p_nonce_hash: await sha256(nonce),
      p_pkce_verifier: verifier,
      p_redirect_uri: redirectUri,
      p_requested_scopes: CLASSROOM_SCOPES,
      p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      p_return_origin: returnOrigin,
    });
    if (error) throw new Error('transaction unavailable');

    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: CLASSROOM_SCOPES.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'select_account consent',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    return json(req, 200, { authorizationUrl: authorizationUrl.toString() });
  } catch {
    return json(req, 500, { error: 'Could not start Google Classroom authorization. Please try again.' });
  }
});

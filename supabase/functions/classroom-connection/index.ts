import { authenticatedApprovedUser, corsPreflight, hasDisallowedOrigin, json } from '../_shared/classroom.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });
  if (hasDisallowedOrigin(req)) return json(req, 403, { error: 'This origin is not allowed.' });
  const auth = await authenticatedApprovedUser(req);
  if ('error' in auth) return json(req, auth.status, { error: auth.error });
  let body: { action?: string; connectionId?: string };
  try { body = await req.json(); } catch { return json(req, 400, { error: 'Invalid request.' }); }

  if (body.action === 'status') {
    const { data, error } = await auth.admin.from('classroom_connections')
      .select('id, user_id, google_subject, google_email, status, connected_at, updated_at, token_expires_at, last_sync_at, granted_scopes')
      .eq('user_id', auth.user.id).in('status', ['connected', 'reauthorization_required']).maybeSingle();
    if (error) return json(req, 500, { error: 'Could not load Google Classroom connection status.' });
    if (!data) return json(req, 200, { connection: null });
    let authorizationCheck = data.status === 'connected' ? 'temporarily_unavailable' : 'reauthorization_required';
    if (data.status === 'connected') {
      const clientId = Deno.env.get('GOOGLE_CLASSROOM_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLASSROOM_CLIENT_SECRET');
      const { data: refreshToken, error: secretError } = await auth.admin.rpc('classroom_get_refresh_token', {
        p_user_id: auth.user.id, p_connection_id: data.id,
      });
      if (clientId && clientSecret && !secretError && typeof refreshToken === 'string' && refreshToken) {
        try {
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
            signal: AbortSignal.timeout(12000),
          });
          const tokenResult = await response.json();
          if (!response.ok && tokenResult?.error === 'invalid_grant') {
            const { error: markError } = await auth.admin.rpc('classroom_mark_reauthorization_required', { p_user_id: auth.user.id, p_connection_id: data.id });
            if (markError) return json(req, 500, { error: 'Could not update Google Classroom authorization status.' });
            data.status = 'reauthorization_required';
            data.updated_at = new Date().toISOString();
            authorizationCheck = 'reauthorization_required';
          } else if (response.ok && typeof tokenResult.access_token === 'string' && Number(tokenResult.expires_in) > 0) {
            const expiresAt = new Date(Date.now() + Number(tokenResult.expires_in) * 1000).toISOString();
            const { error: recordError } = await auth.admin.rpc('classroom_record_token_refresh', {
              p_user_id: auth.user.id,
              p_connection_id: data.id,
              p_token_expires_at: expiresAt,
              p_refresh_token: typeof tokenResult.refresh_token === 'string' ? tokenResult.refresh_token : null,
            });
            if (recordError) return json(req, 500, { error: 'Could not update Google Classroom authorization status.' });
            data.token_expires_at = expiresAt;
            data.updated_at = new Date().toISOString();
            authorizationCheck = 'ok';
          }
        } catch { /* Keep the last known connection status on temporary provider/network errors. */ }
      }
    }
    const { user_id, google_subject, granted_scopes, ...safeConnection } = data;
    return json(req, 200, { connection: safeConnection, authorizationCheck });
  }

  if (body.action === 'disconnect') {
    if (typeof body.connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.connectionId)) return json(req, 400, { error: 'Invalid connection.' });
    const { data: token, error: tokenError } = await auth.admin.rpc('classroom_get_refresh_token', {
      p_user_id: auth.user.id, p_connection_id: body.connectionId,
    });
    let revoked = false;
    if (!tokenError && typeof token === 'string' && token) {
      try {
        const response = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }), signal: AbortSignal.timeout(12000),
        });
        revoked = response.ok;
      } catch { /* local credentials are still erased below */ }
    }
    const { data: disconnected, error } = await auth.admin.rpc('classroom_disconnect_connection', {
      p_user_id: auth.user.id, p_connection_id: body.connectionId,
    });
    if (error) return json(req, 500, { error: 'Could not disconnect Google Classroom right now.' });
    if (!disconnected) return json(req, 404, { error: 'Google Classroom connection was not found.' });
    return json(req, 200, { ok: true, revocation: revoked ? 'confirmed' : 'not-confirmed' });
  }
  return json(req, 400, { error: 'Unsupported connection action.' });
});

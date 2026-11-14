// supabase/functions/admin-delete-account/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Restrict which origins may call this function from a browser. '*' would let
// any site's JavaScript read the response to a credentialed request. Set the
// ALLOWED_ORIGIN env var (Edge Functions -> Secrets) to your deployed app's
// origin(s) (comma-separated for more than one, e.g. prod + preview URLs).
// Note: this only stops browser JS running on other sites from reading the
// response — it does not stop a direct curl/script call with a valid bearer
// token, which is why the server-side admin/approval checks below are the
// real access control, not this header.
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

function corsHeaders(req) {
    const origin = req.headers.get('Origin') || '';
    const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || 'null');
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
    };
}

// jsonResponse/handle take `req` so the CORS header reflects the actual
// request's Origin rather than a single hardcoded '*'.
function jsonResponse(req, status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
    try {
        return await handle(req);
    } catch (err) {
        console.error('admin-delete-account: unhandled error', err);
        return jsonResponse(req, 500, { error: `Unexpected server error: ${err?.message || String(err)}` });
    }
});

async function handle(req) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders(req) });
    }

    if (req.method !== 'POST') {
        return jsonResponse(req, 405, { error: 'Method not allowed.' });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
        const missing = [
            !SUPABASE_URL && 'SUPABASE_URL',
            !SERVICE_ROLE_KEY && 'SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
            !ANON_KEY && 'SUPABASE_ANON_KEY',
        ].filter(Boolean).join(', ');
        return jsonResponse(req, 500, {
            error: `Server misconfiguration: missing required Edge Function secret(s): ${missing}. ` +
                `SUPABASE_URL/SUPABASE_ANON_KEY are normally auto-provisioned; SERVICE_ROLE_KEY must be set ` +
                `manually under Edge Functions -> Secrets, using a secret key (Project Settings -> API Keys) with ` +
                `"Bypass Row Level Security" and Auth admin permissions enabled. See supabase/README.md.`,
        });
    }

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse(req, 401, { error: 'Missing or invalid Authorization header.' });
    }
    const callerJwt = authHeader.slice(7).trim();

    let body;
    try {
        body = await req.json();
    } catch {
        return jsonResponse(req, 400, { error: 'Request body must be valid JSON.' });
    }

    const targetUserId = typeof body?.target_user_id === 'string' ? body.target_user_id.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

    if (!UUID_RE.test(targetUserId)) {
        return jsonResponse(req, 400, { error: 'target_user_id must be a valid UUID.' });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${callerJwt}` } },
    });

    const { data: callerUser, error: callerErr } = await adminClient.auth.getUser(callerJwt);
    if (callerErr || !callerUser?.user) {
        console.error('admin-delete-account: auth.getUser() failed', {
            message: callerErr?.message,
            status: callerErr?.status,
            name: callerErr?.name,
        });
        return jsonResponse(req, 401, { error: 'Your session is invalid or has expired. Please sign in again.' });
    }
    const callerId = callerUser.user.id;

    if (callerId === targetUserId) {
        return jsonResponse(req, 403, { error: 'You cannot delete your own account through this action.' });
    }

    const { data: callerProfile, error: callerProfileErr } = await adminClient
        .from('profiles')
        .select('role, account_status')
        .eq('id', callerId)
        .maybeSingle();

    if (callerProfileErr || !callerProfile) {
        console.error('admin-delete-account: caller profile lookup failed', {
            callerId,
            message: callerProfileErr?.message,
            code: callerProfileErr?.code,
            details: callerProfileErr?.details,
        });
        return jsonResponse(req, 403, { error: 'Could not verify your admin status.' });
    }
    if (callerProfile.role !== 'admin' || callerProfile.account_status !== 'approved') {
        console.error('admin-delete-account: caller is not an approved admin', {
            callerId,
            role: callerProfile.role,
            account_status: callerProfile.account_status,
        });
        return jsonResponse(req, 403, { error: 'This action is restricted to approved administrators.' });
    }

    const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('account_status, email, full_name')
        .eq('id', targetUserId)
        .maybeSingle();

    let dbCleanupNeeded = !!targetProfile;

    if (dbCleanupNeeded && targetProfile.account_status !== 'rejected') {
        return jsonResponse(req, 409, {
            error: `Only rejected accounts can be permanently deleted. This account's current status is "${targetProfile.account_status}".`,
        });
    }

    if (dbCleanupNeeded) {
        const { error: rpcError } = await callerClient.rpc('admin_delete_rejected_account', {
            target_user_id: targetUserId,
            reason,
        });

        if (rpcError) {
            if (rpcError.code === 'P0002') {
                dbCleanupNeeded = false;
            } else if (rpcError.code === '42501') {
                return jsonResponse(req, 403, { error: rpcError.message });
            } else if (rpcError.code === '42883' || /function .* does not exist/i.test(rpcError.message || '')) {
                return jsonResponse(req, 500, {
                    error: 'Server is missing required setup: the admin_delete_rejected_account() database function ' +
                        'was not found. Apply supabase/migrations/0006_account_permanent_deletion.sql before using this feature.',
                });
            } else {
                return jsonResponse(req, 500, { error: `Database cleanup failed: ${rpcError.message}` });
            }
        }
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (authDeleteError) {
        const alreadyGone = /not.*found/i.test(authDeleteError.message || '');
        if (!alreadyGone) {
            await adminClient.from('admin_audit_log').insert({
                actor_id: callerId,
                action: 'account_deletion_auth_step_failed',
                target_user_id: null,
                previous_status: 'rejected',
                new_status: 'deleted_data_only',
                reason: authDeleteError.message,
                target_email: targetProfile?.email ?? null,
                target_full_name: targetProfile?.full_name ?? null,
            });

            return jsonResponse(req, 500, {
                error: `The account's database records were removed, but deleting the Auth login failed: ` +
                    `${authDeleteError.message}. The account can no longer sign in to the app, but a developer must ` +
                    `clear the orphaned Auth user manually. Retrying this action is safe.`,
            });
        }
    }

    await adminClient.from('admin_audit_log').insert({
        actor_id: callerId,
        action: 'account_permanently_deleted_auth_completed',
        target_user_id: null,
        previous_status: 'rejected',
        new_status: 'deleted',
        reason: null,
        target_email: targetProfile?.email ?? null,
        target_full_name: targetProfile?.full_name ?? null,
    });

    return jsonResponse(req, 200, { ok: true });
}

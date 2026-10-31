// supabase/functions/admin-delete-account/index.ts
//
// PHASE 3 -- the only place in this project that may use the service_role
// key. It never leaves this server-side function: it is read from the
// function's own environment (auto-provisioned by Supabase for every Edge
// Function; see the deployment notes in supabase/README.md) and is never
// sent to, logged for, or reachable by the browser.
//
// What this function does, and nothing more:
//   1. Requires a caller Authorization header (the admin's own session JWT --
//      forwarded by the browser, never the anon key alone and never the
//      service_role key).
//   2. Independently re-verifies, server-side, that the caller is an
//      approved admin -- it does not just trust the RPC below, or anything
//      the browser claims about itself.
//   3. Calls public.admin_delete_rejected_account(), AS THE CALLING ADMIN
//      (their JWT is forwarded, not the service key), so is_admin(),
//      auth.uid()-based audit attribution, and the 'rejected'-only guard all
//      run for real on the database side -- this function is not the
//      authorization boundary, the database still is.
//   4. Only once that database cleanup has succeeded (or is confirmed
//      already done, for safe retries) does it use the service_role client
//      to remove the Supabase Auth user -- the one privileged operation that
//      genuinely requires service_role and cannot be expressed as RLS.
//   5. Never reports success unless the Auth user is actually gone. Any
//      failure, including missing server configuration, is returned to the
//      caller as an explicit error message -- never swallowed, never faked.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
    try {
        return await handle(req);
    } catch (err) {
        // Catch-all so a bug here is a visible, logged 500 -- never a silent/ambiguous
        // failure, and never something that could look like success.
        console.error('admin-delete-account: unhandled error', err);
        return jsonResponse(500, { error: `Unexpected server error: ${err?.message || String(err)}` });
    }
});

async function handle(req) {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed.' });
    }

    // --- 0. Required server configuration -----------------------------------
    // These three are provisioned automatically for every Supabase Edge
    // Function in this project; this check exists only so a misconfigured
    // or brand-new project reports exactly what's missing instead of this
    // function silently 500-ing or, worse, appearing to succeed.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    // Deliberately NOT the auto-injected SUPABASE_SERVICE_ROLE_KEY -- this project
    // uses Supabase's new API key system (sb_secret_... keys with per-key
    // permissions, not the old blanket-privileged service_role), and the
    // auto-injected value was not reliable for this project. Instead this reads
    // an explicitly-set `SERVICE_ROLE_KEY` secret (see supabase/README.md), which
    // must have "Bypass Row Level Security" and an Auth admin scope enabled on
    // the key itself in Project Settings -> API Keys -- a new secret key does
    // NOT get those by default the way the legacy service_role always did.
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
        const missing = [
            !SUPABASE_URL && 'SUPABASE_URL',
            !SERVICE_ROLE_KEY && 'SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
            !ANON_KEY && 'SUPABASE_ANON_KEY',
        ].filter(Boolean).join(', ');
        return jsonResponse(500, {
            error: `Server misconfiguration: missing required Edge Function secret(s): ${missing}. ` +
                `SUPABASE_URL/SUPABASE_ANON_KEY are normally auto-provisioned; SERVICE_ROLE_KEY must be set ` +
                `manually under Edge Functions -> Secrets, using a secret key (Project Settings -> API Keys) with ` +
                `"Bypass Row Level Security" and Auth admin permissions enabled. See supabase/README.md.`,
        });
    }

    // --- 1. Caller must present their own session JWT -----------------------
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
        return jsonResponse(401, { error: 'Missing or invalid Authorization header.' });
    }
    const callerJwt = authHeader.slice(7).trim();

    // --- 2. Parse + validate input ------------------------------------------
    let body;
    try {
        body = await req.json();
    } catch {
        return jsonResponse(400, { error: 'Request body must be valid JSON.' });
    }

    const targetUserId = typeof body?.target_user_id === 'string' ? body.target_user_id.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

    if (!UUID_RE.test(targetUserId)) {
        return jsonResponse(400, { error: 'target_user_id must be a valid UUID.' });
    }

    // Service-role client: used ONLY for (a) verifying the caller's identity
    // from their JWT, (b) re-checking their admin status directly (bypassing
    // RLS, which is fine here since this is a read used purely for
    // authorization, not a write), (c) the privileged Auth deletion itself,
    // and (d) writing audit entries for failure paths where the profile row
    // may already be gone. It is never used to run the deletion RPC itself.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // As-caller client: forwards the admin's own JWT so that, inside the
    // database, auth.uid() resolves to them -- this is what makes
    // is_admin() and the audit log's actor_id correct, and is why the RPC
    // call below (not this function) remains the real authorization check.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${callerJwt}` } },
    });

    const { data: callerUser, error: callerErr } = await adminClient.auth.getUser(callerJwt);
    if (callerErr || !callerUser?.user) {
        // Logged server-side only -- never put raw auth error details in the client response.
        console.error('admin-delete-account: auth.getUser() failed', {
            message: callerErr?.message,
            status: callerErr?.status,
            name: callerErr?.name,
        });
        return jsonResponse(401, { error: 'Your session is invalid or has expired. Please sign in again.' });
    }
    const callerId = callerUser.user.id;

    if (callerId === targetUserId) {
        return jsonResponse(403, { error: 'You cannot delete your own account through this action.' });
    }

    // Defense-in-depth re-check, independent of the RPC's own is_admin()
    // guard: confirm the caller is an approved admin before doing anything
    // privileged. Uses the service-role client so this check itself can
    // never be blocked or spoofed by RLS.
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
        return jsonResponse(403, { error: 'Could not verify your admin status.' });
    }
    if (callerProfile.role !== 'admin' || callerProfile.account_status !== 'approved') {
        console.error('admin-delete-account: caller is not an approved admin', {
            callerId,
            role: callerProfile.role,
            account_status: callerProfile.account_status,
        });
        return jsonResponse(403, { error: 'This action is restricted to approved administrators.' });
    }

    // Snapshot target identity BEFORE any deletion happens, for messaging
    // and for audit entries written on failure paths after the profile row
    // is already gone.
    const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('account_status, email, full_name')
        .eq('id', targetUserId)
        .maybeSingle();

    // --- 3. Database-side cleanup, as the calling admin ----------------------
    // If the profile is already gone (a safe retry after a previous Auth
    // deletion failure), skip straight to the Auth deletion step below.
    let dbCleanupNeeded = !!targetProfile;

    if (dbCleanupNeeded && targetProfile.account_status !== 'rejected') {
        return jsonResponse(409, {
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
                // Already deleted by a concurrent/previous attempt -- fine, continue to Auth cleanup.
                dbCleanupNeeded = false;
            } else if (rpcError.code === '42501') {
                return jsonResponse(403, { error: rpcError.message });
            } else if (rpcError.code === '42883' || /function .* does not exist/i.test(rpcError.message || '')) {
                return jsonResponse(500, {
                    error: 'Server is missing required setup: the admin_delete_rejected_account() database function ' +
                        'was not found. Apply supabase/migrations/0006_account_permanent_deletion.sql before using this feature.',
                });
            } else {
                return jsonResponse(500, { error: `Database cleanup failed: ${rpcError.message}` });
            }
        }
    }

    // --- 4. Privileged Auth deletion (the only step that truly needs service_role) ---
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetUserId);

    if (authDeleteError) {
        const alreadyGone = /not.*found/i.test(authDeleteError.message || '');
        if (!alreadyGone) {
            // Database records are already gone at this point -- make that
            // failure visible and permanent in the audit log rather than
            // silently leaving an orphaned Auth user with no trace.
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

            return jsonResponse(500, {
                error: `The account's database records were removed, but deleting the Auth login failed: ` +
                    `${authDeleteError.message}. The account can no longer sign in to the app, but a developer must ` +
                    `clear the orphaned Auth user manually. Retrying this action is safe.`,
            });
        }
        // else: already gone from Auth too -- treat as success (idempotent).
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

    return jsonResponse(200, { ok: true });
}

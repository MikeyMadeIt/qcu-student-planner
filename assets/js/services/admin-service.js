/* Admin data service (ES module). Every read/write goes through Supabase and is subject to
   RLS + the is_admin()/set_account_status() checks on the database side — this file does not
   and cannot grant access on its own; it only calls what the database already allows. */

import { getSupabase } from '../core/supabase-client.js';

function fail(message) {
    return { ok: false, message };
}

function ok(data) {
    return { ok: true, data };
}

function readableDbError(error) {
    if (!error) return 'Something went wrong. Please try again.';
    if (error.code === '42501') return 'You are not authorized to perform this action.';
    if (error.code === 'P0002') return 'That account could not be found.';
    if (error.code === '22023') return 'That is not a valid account status.';
    return 'The request could not be completed. Please try again.';
}

export const AdminService = {
    /* Confirms the signed-in user is an approved admin by reading their own profile row
       (allowed under profiles_select_own_or_admin). Never trust a client-side flag alone. */
    async verifyAdminAccess() {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();

            if (!sessionData.session) return fail('Not signed in.');

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('id, role, account_status, full_name')
                .eq('id', sessionData.session.user.id)
                .maybeSingle();

            if (error || !profile) return fail('Could not verify your account.');
            if (profile.role !== 'admin' || profile.account_status !== 'approved') {
                return fail('This page is restricted to approved administrators.');
            }

            return ok(profile);
        } catch (error) {
            return fail('Could not verify your account.');
        }
    },

    async getDashboardStats() {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('profiles')
                .select('account_status, created_at, full_name, course, school, year_level, role')
                .order('created_at', { ascending: false });

            if (error) return fail(readableDbError(error));

            const counts = { total: data.length, pending: 0, approved: 0, rejected: 0, suspended: 0 };
            data.forEach(row => {
                if (counts[row.account_status] !== undefined) counts[row.account_status] += 1;
            });

            return ok({ counts, recent: data.slice(0, 8), all: data });
        } catch (error) {
            return fail('Could not load dashboard statistics.');
        }
    },

    async listAccounts({ status = 'all', search = '', page = 1, pageSize = 20 } = {}) {
        try {
            const supabase = getSupabase();
            let query = supabase
                .from('profiles')
                .select('id, email, full_name, course, year_level, section, school, role, account_status, signup_provider, created_at, reviewed_at, rejection_reason', { count: 'exact' });

            if (status !== 'all') query = query.eq('account_status', status);
            if (search.trim()) {
                const term = search.trim().replace(/[%_]/g, '');
                query = query.or(`full_name.ilike.%${term}%,course.ilike.%${term}%,email.ilike.%${term}%`);
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.order('created_at', { ascending: false }).range(from, to);

            const { data, error, count } = await query;

            if (error) return fail(readableDbError(error));

            return ok({ rows: data, total: count ?? data.length });
        } catch (error) {
            return fail('Could not load accounts.');
        }
    },

    async getAccount(id) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();

            if (error || !data) return fail('Account not found.');

            return ok(data);
        } catch (error) {
            return fail('Could not load that account.');
        }
    },

    /* The only path that changes account_status. Runs server-side via set_account_status(),
       which re-checks is_admin(), validates the status, blocks self-changes, and writes an
       audit_log row in the same transaction. */
    async reviewAccount({ targetUserId, newStatus, reason = null }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('set_account_status', {
                target_user_id: targetUserId,
                new_status: newStatus,
                reason,
            });

            if (error) return fail(readableDbError(error));

            return ok({});
        } catch (error) {
            return fail('Could not update that account.');
        }
    },

    async listAuditLog({ page = 1, pageSize = 25 } = {}) {
        try {
            const supabase = getSupabase();
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from('admin_audit_log')
                .select('id, actor_id, action, target_user_id, previous_status, new_status, reason, created_at, actor:actor_id(full_name), target:target_user_id(full_name)', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) return fail(readableDbError(error));

            return ok({ rows: data, total: count ?? data.length });
        } catch (error) {
            return fail('Could not load the activity log.');
        }
    },
};

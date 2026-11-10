// Student-facing data service (ES module) for the two Phase 5 features:

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
    if (error.code === 'P0002') return error.message || 'That record could not be found.';
    if (error.code === '22023') return error.message || 'That value is not valid.';
    return 'The request could not be completed. Please try again.';
}

export const StudentService = {

    async listInboxMessages({ search = '', unreadOnly = false, page = 1, pageSize = 20 } = {}) {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) return fail('Not signed in.');

            let query = supabase
                .from('admin_message_recipients')
                .select('read_at, created_at, message:message_id(id, subject, body, category, sent_at, sender:sender_id(full_name))', { count: 'exact' })
                .eq('student_id', sessionData.session.user.id)
                .order('created_at', { ascending: false });

            if (unreadOnly) query = query.is('read_at', null);

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;
            if (error) return fail(readableDbError(error));

            let rows = data.filter(r => r.message);
            if (search.trim()) {
                const term = search.trim().toLowerCase();
                rows = rows.filter(r =>
                    r.message.subject.toLowerCase().includes(term) || r.message.body.toLowerCase().includes(term));
            }

            return ok({ rows, total: count ?? rows.length });
        } catch (error) {
            return fail('Could not load your inbox.');
        }
    },

    async getUnreadCount() {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) return fail('Not signed in.');

            const { count, error } = await supabase
                .from('admin_message_recipients')
                .select('id, message:message_id!inner(id)', { count: 'exact', head: true })
                .eq('student_id', sessionData.session.user.id)
                .is('read_at', null);

            if (error) return fail(readableDbError(error));
            return ok(count ?? 0);
        } catch (error) {
            return fail('Could not load your inbox.');
        }
    },

    async setMessageRead(messageId, isRead) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('set_message_read_status', {
                p_message_id: messageId,
                p_is_read: isRead,
            });
            if (error) return fail(readableDbError(error));
            return ok({});
        } catch (error) {
            return fail('Could not update that message.');
        }
    },

    async submitReport({ category, subject, description }) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.rpc('submit_support_report', {
                p_category: category,
                p_subject: subject,
                p_description: description,
            });
            if (error) return fail(readableDbError(error));
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) return fail('Could not submit your report.');
            return ok({ id: row.id, ticketRef: row.ticket_ref });
        } catch (error) {
            return fail('Could not submit your report.');
        }
    },

    async listMyReports({ page = 1, pageSize = 20 } = {}) {
        try {
            const supabase = getSupabase();
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) return fail('Not signed in.');

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from('support_tickets')
                .select('id, ticket_ref, subject, category, status, created_at, updated_at', { count: 'exact' })
                .eq('student_id', sessionData.session.user.id)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) return fail(readableDbError(error));
            return ok({ rows: data, total: count ?? data.length });
        } catch (error) {
            return fail('Could not load your reports.');
        }
    },

    async getMyReport(id) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('support_tickets')
                .select('id, ticket_ref, subject, description, category, status, created_at, updated_at')
                .eq('id', id)
                .maybeSingle();

            if (error || !data) return fail('Report not found.');
            return ok(data);
        } catch (error) {
            return fail('Could not load that report.');
        }
    },
};

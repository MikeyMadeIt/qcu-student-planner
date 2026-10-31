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
    /* P0002 and 22023 are raised, by every SECURITY DEFINER function in this project, with a
       specific human-readable message already attached (e.g. "Subject must be between 1 and
       150 characters", "That account could not be found") -- surface it instead of a single
       generic string that would otherwise flatten every validation error into the same text. */
    if (error.code === 'P0002') return error.message || 'That record could not be found.';
    if (error.code === '22023') return error.message || 'That value is not valid.';
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

    async listAccounts({ status = 'all', search = '', dateFrom = '', dateTo = '', sort = 'created_desc', page = 1, pageSize = 20 } = {}) {
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
            // Registration-date range — dateTo is a calendar day, so push it to that
            // day's end rather than midnight to keep the day itself inclusive.
            if (dateFrom) query = query.gte('created_at', new Date(`${dateFrom}T00:00:00`).toISOString());
            if (dateTo) query = query.lte('created_at', new Date(`${dateTo}T23:59:59.999`).toISOString());

            const [sortField, sortDir] = {
                created_desc: ['created_at', false],
                created_asc: ['created_at', true],
                name_asc: ['full_name', true],
                name_desc: ['full_name', false],
            }[sort] || ['created_at', false];
            query = query.order(sortField, { ascending: sortDir, nullsFirst: sortDir });

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

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

    /* Permanent deletion lives entirely behind the `admin-delete-account` Edge Function
       (service_role never touches the browser). The function itself re-verifies admin
       status and re-checks the target is 'rejected' server-side -- this call cannot
       succeed just because the UI allowed it to be clicked. */
    async deleteAccountPermanently({ targetUserId, reason = null }) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.functions.invoke('admin-delete-account', {
                body: { target_user_id: targetUserId, reason },
            });

            if (error) {
                // supabase-js FunctionsHttpError carries the actual response on error.context;
                // surface the server's exact message instead of a generic one, per the
                // "never pretend it succeeded, never hide why it failed" requirement.
                let message = error.message || 'Could not delete that account.';
                try {
                    if (error.context && typeof error.context.json === 'function') {
                        const body = await error.context.json();
                        if (body?.error) message = body.error;
                    }
                } catch { /* fall back to error.message above */ }
                return fail(message);
            }

            if (data && data.ok !== true) {
                return fail(data?.error || 'Could not delete that account.');
            }

            return ok({});
        } catch (error) {
            return fail('Could not reach the deletion service. Please try again.');
        }
    },

    /* ---------- Admin Inbox (one-way admin -> student messaging) ---------- */

    /* Student picker for the Compose form. Only ever returns role='student',
       account_status='approved' rows -- the same audience admin_send_message()
       re-derives server-side, so this list can never be out of sync with who a
       message is actually allowed to reach. */
    async listApprovedStudents({ search = '' } = {}) {
        try {
            const supabase = getSupabase();
            let query = supabase
                .from('profiles')
                .select('id, full_name, email, course, school')
                .eq('role', 'student')
                .eq('account_status', 'approved')
                .order('full_name', { ascending: true })
                .limit(500);

            if (search.trim()) {
                const term = search.trim().replace(/[%_]/g, '');
                query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
            }

            const { data, error } = await query;
            if (error) return fail(readableDbError(error));
            return ok(data);
        } catch (error) {
            return fail('Could not load the student list.');
        }
    },

    async sendMessage({ subject, body, category, recipientScope, studentIds = null }) {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.rpc('admin_send_message', {
                p_subject: subject,
                p_body: body,
                p_category: category,
                p_recipient_scope: recipientScope,
                p_student_ids: studentIds,
            });

            if (error) return fail(readableDbError(error));
            return ok({ id: data });
        } catch (error) {
            return fail('Could not send that message.');
        }
    },

    async archiveMessage(messageId) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('admin_archive_message', { p_message_id: messageId });
            if (error) return fail(readableDbError(error));
            return ok({});
        } catch (error) {
            return fail('Could not archive that message.');
        }
    },

    async listMessages({ search = '', category = 'all', dateFrom = '', dateTo = '', sort = 'sent_desc', page = 1, pageSize = 20 } = {}) {
        try {
            const supabase = getSupabase();
            let query = supabase
                .from('admin_messages')
                .select('id, subject, body, category, recipient_scope, recipient_count, status, sent_at, created_at, deleted_at, sender:sender_id(full_name)', { count: 'exact' })
                .is('deleted_at', null);

            if (category !== 'all') query = query.eq('category', category);
            if (search.trim()) {
                const term = search.trim().replace(/[%_]/g, '');
                query = query.or(`subject.ilike.%${term}%,body.ilike.%${term}%`);
            }
            if (dateFrom) query = query.gte('sent_at', new Date(`${dateFrom}T00:00:00`).toISOString());
            if (dateTo) query = query.lte('sent_at', new Date(`${dateTo}T23:59:59.999`).toISOString());

            query = query.order('sent_at', { ascending: sort === 'sent_asc' });

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;
            if (error) return fail(readableDbError(error));
            return ok({ rows: data, total: count ?? data.length });
        } catch (error) {
            return fail('Could not load messages.');
        }
    },

    /* Full message content + its recipient list with per-recipient read status
       (never exposes anything beyond name/email, already visible elsewhere in
       the admin panel). */
    async getMessage(id) {
        try {
            const supabase = getSupabase();
            const { data: message, error: msgError } = await supabase
                .from('admin_messages')
                .select('id, subject, body, category, recipient_scope, recipient_count, status, sent_at, created_at, deleted_at, sender:sender_id(full_name)')
                .eq('id', id)
                .maybeSingle();

            if (msgError || !message) return fail('Message not found.');

            const { data: recipients, error: recError } = await supabase
                .from('admin_message_recipients')
                .select('student_id, read_at, student:student_id(full_name, email)')
                .eq('message_id', id)
                .order('created_at', { ascending: true });

            if (recError) return fail(readableDbError(recError));

            const readCount = recipients.filter(r => r.read_at).length;
            return ok({ message, recipients, readCount, totalCount: recipients.length });
        } catch (error) {
            return fail('Could not load that message.');
        }
    },

    /* ---------- Admin Support Tickets ---------- */

    async listTickets({ status = 'all', category = 'all', search = '', sort = 'created_desc', page = 1, pageSize = 20 } = {}) {
        try {
            const supabase = getSupabase();
            let query = supabase
                .from('support_tickets')
                .select('id, ticket_ref, category, subject, description, status, created_at, updated_at, student:student_id(full_name, email)', { count: 'exact' });

            if (status !== 'all') query = query.eq('status', status);
            if (category !== 'all') query = query.eq('category', category);
            if (search.trim()) {
                const term = search.trim().replace(/[%_]/g, '');
                query = query.or(`ticket_ref.ilike.%${term}%,subject.ilike.%${term}%`);
            }

            query = query.order('created_at', { ascending: sort === 'created_asc' });

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;
            if (error) return fail(readableDbError(error));

            /* Email search needs a second pass: Postgres can't .or() across a joined
               table's column in one query, so when the ticket-side filters above
               return nothing, also try matching on the joined student's email. */
            if (search.trim() && data.length === 0) {
                const term = search.trim().replace(/[%_]/g, '');
                let emailQuery = supabase
                    .from('support_tickets')
                    .select('id, ticket_ref, category, subject, description, status, created_at, updated_at, student:student_id!inner(full_name, email)', { count: 'exact' })
                    .ilike('student.email', `%${term}%`);
                if (status !== 'all') emailQuery = emailQuery.eq('status', status);
                if (category !== 'all') emailQuery = emailQuery.eq('category', category);
                emailQuery = emailQuery.order('created_at', { ascending: sort === 'created_asc' }).range(from, to);
                const emailResult = await emailQuery;
                if (!emailResult.error && emailResult.data.length) {
                    return ok({ rows: emailResult.data, total: emailResult.count ?? emailResult.data.length });
                }
            }

            return ok({ rows: data, total: count ?? data.length });
        } catch (error) {
            return fail('Could not load support tickets.');
        }
    },

    async getTicket(id) {
        try {
            const supabase = getSupabase();
            const { data: ticket, error: ticketError } = await supabase
                .from('support_tickets')
                .select('id, ticket_ref, category, subject, description, status, created_at, updated_at, student:student_id(full_name, email), updater:updated_by(full_name)')
                .eq('id', id)
                .maybeSingle();

            if (ticketError || !ticket) return fail('Ticket not found.');

            const { data: notes, error: notesError } = await supabase
                .from('support_ticket_notes')
                .select('id, note, created_at, admin:admin_id(full_name)')
                .eq('ticket_id', id)
                .order('created_at', { ascending: true });

            if (notesError) return fail(readableDbError(notesError));

            return ok({ ticket, notes });
        } catch (error) {
            return fail('Could not load that ticket.');
        }
    },

    async setTicketStatus({ ticketId, newStatus, note = null }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('admin_set_ticket_status', {
                p_ticket_id: ticketId,
                p_new_status: newStatus,
                p_note: note,
            });
            if (error) return fail(readableDbError(error));
            return ok({});
        } catch (error) {
            return fail('Could not update that ticket.');
        }
    },

    async addTicketNote({ ticketId, note }) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('admin_add_ticket_note', { p_ticket_id: ticketId, p_note: note });
            if (error) return fail(readableDbError(error));
            return ok({});
        } catch (error) {
            return fail('Could not add that note.');
        }
    },

    /* ---------- Overview Dashboard: messaging + ticket stats ----------
       Message-level counts (admin_messages rows) are always kept separate from
       recipient-level counts (admin_message_recipients rows) -- one message
       sent to 50 students is one message, not 50. */
    async getCommsStats() {
        try {
            const supabase = getSupabase();

            const [messagesTotal, unreadTotal, ticketsTotal, ticketsOpen, recentMessages, recentTickets] = await Promise.all([
                supabase.from('admin_messages').select('id', { count: 'exact', head: true }).is('deleted_at', null),
                supabase.from('admin_message_recipients').select('id', { count: 'exact', head: true }).is('read_at', null),
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }),
                supabase.from('support_tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '(resolved,closed)'),
                supabase.from('admin_messages').select('id, subject, category, recipient_count, sent_at').is('deleted_at', null).order('sent_at', { ascending: false }).limit(5),
                supabase.from('support_tickets').select('id, ticket_ref, subject, status, created_at, student:student_id(full_name)').order('created_at', { ascending: false }).limit(5),
            ]);

            const firstError = [messagesTotal, unreadTotal, ticketsTotal, ticketsOpen, recentMessages, recentTickets]
                .map(r => r.error).find(Boolean);
            if (firstError) return fail(readableDbError(firstError));

            return ok({
                messagesTotal: messagesTotal.count ?? 0,
                unreadTotal: unreadTotal.count ?? 0,
                ticketsTotal: ticketsTotal.count ?? 0,
                ticketsOpen: ticketsOpen.count ?? 0,
                recentMessages: recentMessages.data || [],
                recentTickets: recentTickets.data || [],
            });
        } catch (error) {
            return fail('Could not load communications statistics.');
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

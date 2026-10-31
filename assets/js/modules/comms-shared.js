/* Shared constants for Admin Inbox / Student Inbox / Support Tickets (ES module).
   Used by both admin-side and student-side pages so labels, category options and
   status options can never drift apart between the two. */

export const MESSAGE_CATEGORY_LABELS = {
    announcement: 'Announcement',
    update: 'Update',
    reminder: 'Reminder',
    maintenance: 'Maintenance',
    general: 'General',
};

export const MESSAGE_CATEGORY_ICONS = {
    announcement: 'bi-megaphone-fill',
    update: 'bi-arrow-repeat',
    reminder: 'bi-alarm-fill',
    maintenance: 'bi-tools',
    general: 'bi-chat-square-text-fill',
};

export const REPORT_CATEGORY_LABELS = {
    account: 'Account or Login Issue',
    data: 'Incorrect or Missing Data',
    schedule: 'Schedule or Calendar Issue',
    tasks_grades: 'Tasks or Grades Issue',
    technical: 'Technical Problem',
    feature_request: 'Feature Request',
    other: 'Other',
};

export const TICKET_STATUS_LABELS = {
    open: 'Open',
    in_progress: 'In Progress',
    waiting_user: 'Waiting for User',
    resolved: 'Resolved',
    closed: 'Closed',
};

export function messageCategoryBadge(escHtml, category) {
    const label = MESSAGE_CATEGORY_LABELS[category] || category || 'General';
    return `<span class="status-badge msg-cat-${escHtml(category || 'general')}">${escHtml(label)}</span>`;
}

export function ticketStatusBadge(escHtml, status) {
    const label = TICKET_STATUS_LABELS[status] || status || 'Unknown';
    return `<span class="status-badge ticket-status-${escHtml(status || '')}">${escHtml(label)}</span>`;
}

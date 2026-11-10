// Shared helpers for admin pages (ES module).

import { AuthService } from '../services/auth-service.js';

export const ACTION_LABELS = {
    account_status_change: 'Account status change',
    account_permanently_deleted: 'Account permanently deleted',
    admin_message_sent: 'Administrative message sent',
    admin_message_archived: 'Administrative message archived',
    ticket_status_change: 'Support ticket status change',
};

export function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

export function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function statusBadge(status) {
    const label = (status || 'unknown').charAt(0).toUpperCase() + (status || 'unknown').slice(1);
    return `<span class="status-badge ${escHtml(status || '')}">${escHtml(label)}</span>`;
}

// Admin name + log out now live at the bottom of the sidebar (rendered by layout.js's
export function mountAdminTopbar(admin) {
    document.querySelectorAll('.js-admin-name').forEach(nameEl => {
        nameEl.textContent = `Signed in as ${admin.full_name || 'Administrator'}`;
    });

    document.querySelectorAll('.js-admin-logout').forEach(logoutBtn => {
        logoutBtn.addEventListener('click', async () => {
            document.querySelectorAll('.js-admin-logout').forEach(b => b.disabled = true);
            await AuthService.signOut();
            location.href = '../auth/login.html';
        });
    });
}

export function renderError(container, message) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><br>${escHtml(message)}</div>`;
}

// Same as renderError, plus a Retry button wired to onRetry. Used wherever a failed
export function renderErrorWithRetry(container, message, onRetry) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><br>${escHtml(message)}<br><button type="button" class="btn btn-ghost btn-sm mt-2" id="admErrorRetryBtn"><i class="bi bi-arrow-clockwise"></i> Retry</button></div>`;
    const btn = container.querySelector('#admErrorRetryBtn');
    if (btn) btn.addEventListener('click', onRetry, { once: true });
}

// Shared "View" detail modal used by All Users, Pending Approvals and Rejected
export function renderAccountDetail(account) {
    const titleEl = document.getElementById('userDetailTitle');
    const bodyEl = document.getElementById('userDetailBody');
    if (!titleEl || !bodyEl) return;

    titleEl.textContent = account.full_name || 'Account details';
    bodyEl.innerHTML = `
        <dt>Email</dt><dd>${escHtml(account.email || '—')}</dd>
        <dt>Signed up with</dt><dd>${account.signup_provider === 'google' ? 'Google' : 'Email &amp; password'}</dd>
        <dt>Status</dt><dd>${statusBadge(account.account_status)}</dd>
        <dt>Role</dt><dd>${escHtml(account.role || 'student')}</dd>
        <dt>Campus</dt><dd>${escHtml(account.school || '—')}</dd>
        <dt>Program</dt><dd>${escHtml(account.course || '—')}</dd>
        <dt>Year level</dt><dd>${escHtml(account.year_level || '—')}</dd>
        <dt>Registration date</dt><dd>${formatDateTime(account.created_at)}</dd>
        <dt>Last reviewed</dt><dd>${formatDateTime(account.reviewed_at)}</dd>
        <dt>Last decision reason</dt><dd>${escHtml(account.rejection_reason || '—')}</dd>`;

    new bootstrap.Modal(document.getElementById('userDetailModal')).show();
}

// The markup for the shared detail modal above identical on every page
export function userDetailModalMarkup() {
    return `
<div class="modal fade" id="userDetailModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="userDetailTitle">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content card-pad">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h5 id="userDetailTitle" class="mb-0">Account details</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <dl class="adm-detail-grid" id="userDetailBody"></dl>
    </div>
  </div>
</div>`;
}

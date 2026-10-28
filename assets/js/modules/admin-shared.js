/* Shared helpers for admin pages (ES module). */

import { AuthService } from '../services/auth-service.js';

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

/* Admin name + log out now live at the bottom of the sidebar (rendered by layout.js's
   renderShell), not in the per-page topbar, so this wires those elements instead. */
export function mountAdminTopbar(admin) {
    const nameEl = document.getElementById('admSidebarName');
    if (nameEl) nameEl.textContent = `Signed in as ${admin.full_name || 'Administrator'}`;

    const logoutBtn = document.getElementById('admSidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logoutBtn.disabled = true;
            await AuthService.signOut();
            location.href = '../auth/login.html';
        });
    }
}

export function renderError(container, message) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><br>${escHtml(message)}</div>`;
}

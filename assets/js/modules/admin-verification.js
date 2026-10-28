/* Admin verification page (ES module). All data and actions go through AdminService,
   which only ever calls the real Supabase tables/RPC — nothing here is sample data. */

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDate, statusBadge, mountAdminTopbar, renderError } from './admin-shared.js';

const PAGE_SIZE = 20;
let currentPage = 1;
let lastTotal = 0;

async function loadRows() {
    const body = document.getElementById('admBody');
    const loading = document.getElementById('admLoading');
    const empty = document.getElementById('admEmpty');
    const pagination = document.getElementById('admPagination');

    loading.hidden = false;
    empty.hidden = true;
    body.innerHTML = '';

    const status = document.getElementById('admStatus').value;
    const search = document.getElementById('admSearch').value;

    const result = await AdminService.listAccounts({ status, search, page: currentPage, pageSize: PAGE_SIZE });

    loading.hidden = true;

    if (!result.ok) {
        renderError(body.closest('.glass'), result.message);
        return;
    }

    const { rows, total } = result.data;
    lastTotal = total;

    document.getElementById('admCount').textContent = `${rows.length} of ${total}`;
    empty.hidden = rows.length > 0;

    body.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Student"><div class="adm-name">${escHtml(r.full_name || 'Not provided')}</div><div class="adm-sub">${escHtml(r.student_number || 'No student number on file')}</div></td>
        <td data-label="Student no." class="mono">${escHtml(r.student_number || '—')}</td>
        <td data-label="Program">${escHtml(r.course || '—')}${r.year_level ? ' · ' + escHtml(r.year_level) : ''}</td>
        <td data-label="Submitted">${formatDate(r.created_at)}</td>
        <td data-label="Status">${statusBadge(r.account_status)}</td>
        <td class="text-end adm-actions">${actionButtons(r)}</td>
      </tr>`).join('');

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pagination.hidden = totalPages <= 1;
    pagination.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="pagePrev" ${currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" id="pageNext" ${currentPage >= totalPages ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;

    const prevBtn = document.getElementById('pagePrev');
    const nextBtn = document.getElementById('pageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; loadRows(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; loadRows(); });
}

function actionButtons(row) {
    if (row.account_status === 'pending') {
        return `
            <button class="btn btn-ghost btn-sm" data-act="reject" data-id="${row.id}"><i class="bi bi-x-lg"></i> Reject</button>
            <button class="btn btn-accent btn-sm" data-act="approve" data-id="${row.id}"><i class="bi bi-check-lg"></i> Approve</button>`;
    }
    if (row.account_status === 'approved') {
        return `<button class="btn btn-ghost btn-sm" data-act="suspend" data-id="${row.id}"><i class="bi bi-pause-circle"></i> Suspend</button>`;
    }
    if (row.account_status === 'suspended') {
        return `<button class="btn btn-ghost btn-sm" data-act="restore" data-id="${row.id}"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>`;
    }
    if (row.account_status === 'rejected') {
        return `<button class="btn btn-ghost btn-sm" data-act="restore-pending" data-id="${row.id}"><i class="bi bi-arrow-counterclockwise"></i> Reconsider</button>`;
    }
    return '<span class="text-faint">—</span>';
}

const ACTION_CONFIG = {
    approve: { title: 'Approve this account?', label: 'Approve', danger: false, icon: 'bi-check-circle-fill', status: 'approved', needsReason: false },
    reject: { title: 'Reject this account?', label: 'Reject', danger: true, icon: 'bi-x-circle-fill', status: 'rejected', needsReason: true },
    suspend: { title: 'Suspend this account?', label: 'Suspend', danger: true, icon: 'bi-pause-circle-fill', status: 'suspended', needsReason: true },
    restore: { title: 'Restore this account?', label: 'Restore', danger: false, icon: 'bi-arrow-counterclockwise', status: 'approved', needsReason: false },
    'restore-pending': { title: 'Send this account back to pending review?', label: 'Reconsider', danger: false, icon: 'bi-arrow-counterclockwise', status: 'pending', needsReason: false },
};

function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const config = ACTION_CONFIG[btn.dataset.act];
    const targetId = btn.dataset.id;

    confirmAction({
        title: config.title,
        message: 'This will be recorded in the activity log.',
        confirmLabel: config.label,
        danger: config.danger,
        icon: config.icon,
        reasonField: config.needsReason
            ? { label: 'Reason (optional, shown to the student if applicable)', placeholder: 'e.g. Student number could not be verified' }
            : null,
        async onConfirm(reason) {
            const result = await AdminService.reviewAccount({ targetUserId: targetId, newStatus: config.status, reason: reason || null });

            if (!result.ok) {
                Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
                return;
            }

            Toast.show(`Account ${config.status}.`, config.danger ? 'warning' : 'accent');
            loadRows();
        },
    });
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-verification');
    mountAdminTopbar(admin);

    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const status = params.get('status');
    if (q) document.getElementById('admSearch').value = q;
    if (status) document.getElementById('admStatus').value = status;

    document.getElementById('admStatus').addEventListener('change', () => { currentPage = 1; loadRows(); });
    let searchTimer = null;
    document.getElementById('admSearch').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { currentPage = 1; loadRows(); }, 300);
    });
    document.getElementById('admBody').addEventListener('click', onAction);

    loadRows();
}

init();

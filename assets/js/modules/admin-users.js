import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDate, formatDateTime, statusBadge, mountAdminTopbar, renderError } from './admin-shared.js';

const PAGE_SIZE = 20;
let currentPage = 1;

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
    document.getElementById('admCount').textContent = `${rows.length} of ${total}`;
    empty.hidden = rows.length > 0;

    body.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Account"><div class="adm-name">${escHtml(r.full_name || 'Not provided')}</div><div class="adm-sub">${escHtml(r.student_number || r.course || '—')}</div></td>
        <td data-label="Role">${escHtml(r.role || 'student')}</td>
        <td data-label="Registered">${formatDate(r.created_at)}</td>
        <td data-label="Status">${statusBadge(r.account_status)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm" data-act="view" data-id="${r.id}"><i class="bi bi-eye"></i> View</button>
          ${r.account_status === 'approved' ? `<button class="btn btn-ghost btn-sm" data-act="suspend" data-id="${r.id}"><i class="bi bi-pause-circle"></i> Suspend</button>` : ''}
          ${r.account_status === 'suspended' ? `<button class="btn btn-accent btn-sm" data-act="restore" data-id="${r.id}"><i class="bi bi-arrow-counterclockwise"></i> Restore</button>` : ''}
        </td>
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

async function viewDetail(id) {
    const result = await AdminService.getAccount(id);
    if (!result.ok) {
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    const a = result.data;
    const body = document.getElementById('userDetailBody');
    document.getElementById('userDetailTitle').textContent = a.full_name || 'Account details';
    body.innerHTML = `
        <dt>Status</dt><dd>${statusBadge(a.account_status)}</dd>
        <dt>Role</dt><dd>${escHtml(a.role || 'student')}</dd>
        <dt>Student number</dt><dd>${escHtml(a.student_number || '—')}</dd>
        <dt>Program</dt><dd>${escHtml(a.course || '—')}</dd>
        <dt>Year level</dt><dd>${escHtml(a.year_level || '—')}</dd>
        <dt>Section</dt><dd>${escHtml(a.section || '—')}</dd>
        <dt>School / campus</dt><dd>${escHtml(a.school || '—')}</dd>
        <dt>Registered</dt><dd>${formatDateTime(a.created_at)}</dd>
        <dt>Last reviewed</dt><dd>${formatDateTime(a.reviewed_at)}</dd>
        <dt>Last decision reason</dt><dd>${escHtml(a.rejection_reason || '—')}</dd>`;
    new bootstrap.Modal(document.getElementById('userDetailModal')).show();
}

function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'view') {
        viewDetail(id);
        return;
    }

    const isSuspend = act === 'suspend';
    confirmAction({
        title: isSuspend ? 'Suspend this account?' : 'Restore this account?',
        message: 'This will be recorded in the activity log.' + (isSuspend ? ' The student will lose access until restored.' : ''),
        confirmLabel: isSuspend ? 'Suspend' : 'Restore',
        danger: isSuspend,
        icon: isSuspend ? 'bi-pause-circle-fill' : 'bi-arrow-counterclockwise',
        reasonField: isSuspend ? { label: 'Reason for suspension (optional)', placeholder: 'e.g. Reported duplicate account' } : null,
        async onConfirm(reason) {
            const result = await AdminService.reviewAccount({
                targetUserId: id,
                newStatus: isSuspend ? 'suspended' : 'approved',
                reason: reason || null,
            });

            if (!result.ok) {
                Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
                return;
            }

            Toast.show(isSuspend ? 'Account suspended.' : 'Account restored.', isSuspend ? 'warning' : 'accent');
            loadRows();
        },
    });
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-users');
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

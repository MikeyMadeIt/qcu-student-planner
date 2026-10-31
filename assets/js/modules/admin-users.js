import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDate, statusBadge, mountAdminTopbar, renderError, renderAccountDetail } from './admin-shared.js';

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
    const dateFrom = document.getElementById('admDateFrom').value;
    const dateTo = document.getElementById('admDateTo').value;
    const sort = document.getElementById('admSort').value;

    const result = await AdminService.listAccounts({ status, search, dateFrom, dateTo, sort, page: currentPage, pageSize: PAGE_SIZE });

    loading.hidden = true;

    if (!result.ok) {
        renderError(body.closest('.glass'), result.message);
        return;
    }

    const { rows, total } = result.data;
    document.getElementById('admCount').textContent = `${rows.length} of ${total}`;
    empty.hidden = rows.length > 0;

    const rowOffset = (currentPage - 1) * PAGE_SIZE;
    body.innerHTML = rows.map((r, i) => `
      <tr>
        <td data-label="No." class="adm-col-no">${rowOffset + i + 1}</td>
        <td data-label="Full Name" class="adm-col-wide"><div class="adm-name">${escHtml(r.full_name || 'Not provided')}</div></td>
        <td data-label="Email Address" class="adm-col-email">${escHtml(r.email || '—')}</td>
        <td data-label="Campus" class="adm-col-hide-mobile">${escHtml(r.school || '—')}</td>
        <td data-label="Program" class="adm-col-hide-mobile">${escHtml(r.course || '—')}</td>
        <td data-label="Year Level" class="adm-col-hide-mobile">${escHtml(r.year_level || '—')}</td>
        <td data-label="Account Status" class="adm-col-hide-mobile">${statusBadge(r.account_status)}</td>
        <td data-label="Registration Date" class="adm-col-hide-mobile">${formatDate(r.created_at)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${r.id}" title="View" aria-label="View account details"><i class="bi bi-eye"></i></button>
          ${r.account_status === 'approved' ? `<button class="btn btn-ghost btn-sm adm-icon-btn" data-act="suspend" data-id="${r.id}" title="Suspend" aria-label="Suspend account"><i class="bi bi-pause-circle"></i></button>` : ''}
          ${r.account_status === 'suspended' ? `<button class="btn btn-accent btn-sm adm-icon-btn" data-act="restore" data-id="${r.id}" title="Restore" aria-label="Restore account"><i class="bi bi-arrow-counterclockwise"></i></button>` : ''}
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

    renderAccountDetail(result.data);
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

    renderShell('admin-users', admin);
    mountAdminTopbar(admin);

    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const status = params.get('status');
    if (q) document.getElementById('admSearch').value = q;
    if (status) document.getElementById('admStatus').value = status;

    document.getElementById('admStatus').addEventListener('change', () => { currentPage = 1; loadRows(); });
    document.getElementById('admSort').addEventListener('change', () => { currentPage = 1; loadRows(); });
    document.getElementById('admDateFrom').addEventListener('change', () => { currentPage = 1; loadRows(); });
    document.getElementById('admDateTo').addEventListener('change', () => { currentPage = 1; loadRows(); });
    let searchTimer = null;
    document.getElementById('admSearch').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { currentPage = 1; loadRows(); }, 300);
    });
    document.getElementById('admFiltersClear').addEventListener('click', () => {
        document.getElementById('admSearch').value = '';
        document.getElementById('admStatus').value = 'all';
        document.getElementById('admDateFrom').value = '';
        document.getElementById('admDateTo').value = '';
        document.getElementById('admSort').value = 'created_desc';
        currentPage = 1;
        loadRows();
    });
    document.getElementById('admBody').addEventListener('click', onAction);

    loadRows();
}

init();

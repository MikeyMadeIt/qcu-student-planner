// Admin Rejected Accounts page (ES module). All data goes through AdminService,

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDate, mountAdminTopbar, renderErrorWithRetry, renderAccountDetail } from './admin-shared.js';

const PAGE_SIZE = 20;
let currentPage = 1;
let loadSeq = 0;

async function loadRows() {
    const seq = ++loadSeq;
    const body = document.getElementById('admBody');
    const loading = document.getElementById('admLoading');
    const empty = document.getElementById('admEmpty');
    const pagination = document.getElementById('admPagination');

    loading.hidden = false;
    empty.hidden = true;
    body.innerHTML = '';

    const search = document.getElementById('admSearch').value;

    const result = await AdminService.listAccounts({ status: 'rejected', search, page: currentPage, pageSize: PAGE_SIZE });

    if (seq !== loadSeq) return; // a newer request superseded this one

    loading.hidden = true;

    if (!result.ok) {
        renderErrorWithRetry(body.closest('.glass'), result.message, loadRows);
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
        <td data-label="Rejection Date" class="adm-col-hide-mobile">${formatDate(r.reviewed_at)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${r.id}" title="View" aria-label="View account details"><i class="bi bi-eye"></i></button>
          <button class="btn btn-ghost btn-sm adm-icon-btn adm-danger" data-act="delete" data-id="${r.id}" data-name="${escHtml(r.full_name || 'this account')}" title="Delete permanently" aria-label="Delete permanently"><i class="bi bi-trash3"></i></button>
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

async function deleteAccount(id, name, triggerBtn) {
    if (triggerBtn) triggerBtn.disabled = true;

    const result = await AdminService.deleteAccountPermanently({ targetUserId: id });

    if (!result.ok) {
        if (triggerBtn) triggerBtn.disabled = false;
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    Toast.show(`${name} was permanently deleted.`, 'accent', 'bi-check-circle-fill');
    loadRows();
}

function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'view') {
        viewDetail(id);
        return;
    }

    if (act === 'delete') {
        const name = btn.dataset.name || 'this account';
        confirmAction({
            title: `Permanently delete ${name}?`,
            message: 'This permanently removes the account, its sign-in, and all of its planner data. ' +
                'This cannot be undone. Type DELETE to confirm.',
            confirmLabel: 'Delete permanently',
            danger: true,
            icon: 'bi-trash3-fill',
            reasonField: {
                label: 'Type DELETE to confirm',
                placeholder: 'DELETE',
                required: true,
                requiredMessage: 'Type DELETE (in capitals) to confirm this permanent deletion.',
            },
            onConfirm(typed) {
                if (typed.trim().toUpperCase() !== 'DELETE') {
                    Toast.show('Type DELETE (in capitals) to confirm.', 'danger', 'bi-exclamation-triangle-fill');
                    return;
                }
                deleteAccount(id, name, btn);
            },
        });
    }
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-rejected', admin);
    mountAdminTopbar(admin);

    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) document.getElementById('admSearch').value = q;

    let searchTimer = null;
    document.getElementById('admSearch').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { currentPage = 1; loadRows(); }, 300);
    });
    document.getElementById('admBody').addEventListener('click', onAction);

    loadRows();
}

init();

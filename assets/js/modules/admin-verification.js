/* Admin Pending Approvals page (ES module). All data and actions go through
   AdminService, which only ever calls the real Supabase tables/RPC -- nothing
   here is sample data. This page always retrieves account_status = 'pending'
   rows only; there is no status filter to widen that. */

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { APP_CONFIG } from '../core/config.js';
import { escHtml, formatDate, mountAdminTopbar, renderError, renderAccountDetail } from './admin-shared.js';

/* Visual-only hint: Supabase has no way to restrict Google sign-in to a particular email
   format, so every Google (and password) sign-up still lands here as 'pending' and a human
   makes the final call. This just flags, for the reviewer, whether the email looks like the
   university's lastname.firstname.middlename@gmail.com pattern. */
function emailFormatBadge(email) {
    if (!email) return '';
    const matches = APP_CONFIG.studentEmailPattern.test(email.trim());
    return matches
        ? '<i class="bi bi-check-circle-fill text-success" title="Matches the expected lastname.firstname.middlename@gmail.com format" aria-hidden="true"></i>'
        : '<i class="bi bi-exclamation-triangle-fill text-danger" title="Does not match the expected lastname.firstname.middlename@gmail.com format" aria-hidden="true"></i>';
}

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

    const search = document.getElementById('admSearch').value;

    const result = await AdminService.listAccounts({ status: 'pending', search, page: currentPage, pageSize: PAGE_SIZE });

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
        <td data-label="Email Address" class="adm-col-email"><span class="mono">${escHtml(r.email || '—')}</span> ${emailFormatBadge(r.email)}${r.signup_provider === 'google' ? ' <span class="status-badge" title="Signed up with Google"><i class="bi bi-google" aria-hidden="true"></i> Google</span>' : ''}</td>
        <td data-label="Campus" class="adm-col-hide-mobile">${escHtml(r.school || '—')}</td>
        <td data-label="Program" class="adm-col-hide-mobile">${escHtml(r.course || '—')}</td>
        <td data-label="Year Level" class="adm-col-hide-mobile">${escHtml(r.year_level || '—')}</td>
        <td data-label="Registration Date" class="adm-col-hide-mobile">${formatDate(r.created_at)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${r.id}" title="View" aria-label="View account details"><i class="bi bi-eye"></i></button>
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="reject" data-id="${r.id}" title="Reject" aria-label="Reject account"><i class="bi bi-x-lg"></i></button>
          <button class="btn btn-accent btn-sm adm-icon-btn" data-act="approve" data-id="${r.id}" title="Approve" aria-label="Approve account"><i class="bi bi-check-lg"></i></button>
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

const ACTION_CONFIG = {
    approve: { title: 'Approve this account?', label: 'Approve', danger: false, icon: 'bi-check-circle-fill', status: 'approved', needsReason: false },
    reject: { title: 'Reject this account?', label: 'Reject', danger: true, icon: 'bi-x-circle-fill', status: 'rejected', needsReason: true },
};

function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'view') {
        viewDetail(id);
        return;
    }

    const config = ACTION_CONFIG[act];
    if (!config) return;

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
            const result = await AdminService.reviewAccount({ targetUserId: id, newStatus: config.status, reason: reason || null });

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

    renderShell('admin-verification', admin);
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

/* Admin Rejected Accounts page (ES module). All data goes through AdminService,
   which only ever calls the real Supabase tables -- nothing here is sample data.
   This page always retrieves account_status = 'rejected' rows only.

   Delete Permanently is intentionally NOT wired to a real delete in this phase:
   removing a Supabase Auth user (and deciding what happens to their related
   records) has to happen through a protected, service_role-only server
   function, never from the browser with the anon/authenticated key. That
   function ships in Phase 3; until then the action stays visibly disabled
   rather than faking success or quietly doing nothing. */

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDate, mountAdminTopbar, renderError, renderAccountDetail } from './admin-shared.js';

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

    const result = await AdminService.listAccounts({ status: 'rejected', search, page: currentPage, pageSize: PAGE_SIZE });

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
        <td data-label="Rejection Date" class="adm-col-hide-mobile">${formatDate(r.reviewed_at)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${r.id}" title="View" aria-label="View account details"><i class="bi bi-eye"></i></button>
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="delete" data-id="${r.id}" disabled title="Permanent deletion ships in a later phase" aria-label="Delete permanently (not yet available)"><i class="bi bi-trash3"></i></button>
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
    if (!btn || btn.disabled) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    if (act === 'view') {
        viewDetail(id);
    }
    // 'delete' is disabled in the DOM above -- no handler needed until the
    // Phase 3 server-side delete function exists.
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

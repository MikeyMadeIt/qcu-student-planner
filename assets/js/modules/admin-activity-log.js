import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDateTime, mountAdminTopbar, renderError, ACTION_LABELS } from './admin-shared.js';

const PAGE_SIZE = 25;
let currentPage = 1;

async function loadRows() {
    const body = document.getElementById('admBody');
    const loading = document.getElementById('admLoading');
    const empty = document.getElementById('admEmpty');
    const pagination = document.getElementById('admPagination');

    loading.hidden = false;
    empty.hidden = true;
    body.innerHTML = '';

    const result = await AdminService.listAuditLog({ page: currentPage, pageSize: PAGE_SIZE });

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
        <td data-label="When">${formatDateTime(r.created_at)}</td>
        <td data-label="Admin">${escHtml(r.actor && r.actor.full_name ? r.actor.full_name : 'Administrator')}</td>
        <td data-label="Action">${escHtml(ACTION_LABELS[r.action] || r.action)}</td>
        <td data-label="Account">${escHtml(r.target && r.target.full_name ? r.target.full_name : '—')}</td>
        <td data-label="Change">${escHtml(r.previous_status || '—')} &rarr; ${escHtml(r.new_status || '—')}</td>
        <td data-label="Reason">${escHtml(r.reason || '—')}</td>
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

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-activity', admin);
    mountAdminTopbar(admin);

    loadRows();
}

init();

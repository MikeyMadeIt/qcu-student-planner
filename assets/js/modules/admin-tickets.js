import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDateTime, mountAdminTopbar, renderErrorWithRetry } from './admin-shared.js';
import { REPORT_CATEGORY_LABELS, TICKET_STATUS_LABELS, ticketStatusBadge } from './comms-shared.js';

const PAGE_SIZE = 20;
let currentPage = 1;
let currentTicketId = null;

async function loadRows() {
    const body = document.getElementById('admBody');
    const loading = document.getElementById('admLoading');
    const empty = document.getElementById('admEmpty');
    const errorBox = document.getElementById('admError');
    const pagination = document.getElementById('admPagination');
    const table = body.closest('.adm-table-wrap');

    loading.hidden = false;
    empty.hidden = true;
    errorBox.hidden = true;
    table.hidden = true;

    const search = document.getElementById('admSearch').value;
    const status = document.getElementById('admStatus').value;
    const category = document.getElementById('admCategory').value;
    const sort = document.getElementById('admSort').value;

    const result = await AdminService.listTickets({ search, status, category, sort, page: currentPage, pageSize: PAGE_SIZE });

    loading.hidden = true;

    if (!result.ok) {
        errorBox.hidden = false;
        renderErrorWithRetry(errorBox, result.message, loadRows);
        return;
    }

    const { rows, total } = result.data;
    document.getElementById('admCount').textContent = `${rows.length} of ${total}`;

    if (!rows.length) {
        empty.hidden = false;
        pagination.hidden = true;
        return;
    }

    table.hidden = false;
    body.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Ticket"><span class="text-faint" style="font-family:var(--font-mono);font-size:.76rem">${escHtml(r.ticket_ref)}</span></td>
        <td data-label="Student">
          <div class="adm-name">${escHtml(r.student && r.student.full_name ? r.student.full_name : 'Unnamed account')}</div>
          <div class="adm-sub">${escHtml(r.student && r.student.email ? r.student.email : '—')}</div>
        </td>
        <td data-label="Subject">${escHtml(r.subject)}</td>
        <td data-label="Category">${escHtml(REPORT_CATEGORY_LABELS[r.category] || r.category)}</td>
        <td data-label="Status">${ticketStatusBadge(escHtml, r.status)}</td>
        <td data-label="Submitted">${formatDateTime(r.created_at)}</td>
        <td data-label="Updated">${formatDateTime(r.updated_at)}</td>
        <td class="text-end adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${r.id}" title="View ticket" aria-label="View ticket"><i class="bi bi-eye"></i></button>
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

function notesMarkup(notes) {
    if (!notes.length) return `<p class="text-faint" style="font-size:.82rem">No internal notes yet.</p>`;
    return notes.map(n => `
        <div class="adm-recent-row" style="display:block;padding:8px 0">
            <div style="font-size:.84rem">${escHtml(n.note)}</div>
            <div class="text-faint" style="font-size:.72rem">${escHtml(n.admin && n.admin.full_name ? n.admin.full_name : 'Administrator')} &middot; ${formatDateTime(n.created_at)}</div>
        </div>`).join('');
}

async function viewTicket(id) {
    currentTicketId = id;
    const bodyEl = document.getElementById('tkDetailBody');
    bodyEl.innerHTML = `<div class="adm-loading"><i class="bi bi-hourglass-split"></i> Loading…</div>`;
    const modal = new bootstrap.Modal(document.getElementById('ticketDetailModal'));
    modal.show();

    const result = await AdminService.getTicket(id);
    if (!result.ok) {
        renderErrorWithRetry(bodyEl, result.message, () => viewTicket(id));
        return;
    }

    const { ticket, notes } = result.data;
    document.getElementById('tkDetailTitle').innerHTML = `<span style="font-family:var(--font-mono);font-size:.82rem">${escHtml(ticket.ticket_ref)}</span>`;

    const statusOptions = Object.entries(TICKET_STATUS_LABELS)
        .map(([value, label]) => `<option value="${value}" ${ticket.status === value ? 'selected' : ''}>${label}</option>`).join('');

    bodyEl.innerHTML = `
        <div class="adm-detail-grid mb-3">
            <dt>Student</dt><dd>${escHtml(ticket.student && ticket.student.full_name ? ticket.student.full_name : 'Unnamed account')}</dd>
            <dt>Email</dt><dd>${escHtml(ticket.student && ticket.student.email ? ticket.student.email : '—')}</dd>
            <dt>Category</dt><dd>${escHtml(REPORT_CATEGORY_LABELS[ticket.category] || ticket.category)}</dd>
            <dt>Submitted</dt><dd>${formatDateTime(ticket.created_at)}</dd>
            <dt>Last updated</dt><dd>${formatDateTime(ticket.updated_at)}</dd>
            <dt>Last updated by</dt><dd>${escHtml(ticket.updater && ticket.updater.full_name ? ticket.updater.full_name : '—')}</dd>
        </div>
        <div class="section-title mb-2" style="font-size:.84rem"><i class="bi bi-chat-left-text"></i>${escHtml(ticket.subject)}</div>
        <div class="glass card-pad mb-3" style="white-space:pre-wrap;font-size:.88rem">${escHtml(ticket.description)}</div>

        <div class="row g-2 align-items-end mb-3">
          <div class="col-12 col-sm-6">
            <label for="tkStatusSelect" class="adm-label">Status</label>
            <select id="tkStatusSelect" class="form-select">${statusOptions}</select>
          </div>
          <div class="col-12 col-sm-6">
            <button type="button" class="btn btn-accent w-100" id="tkStatusSaveBtn"><i class="bi bi-check2"></i> Update status</button>
          </div>
        </div>
        <p class="auth-error" id="tkStatusError" hidden></p>

        <div class="section-title mb-2" style="font-size:.84rem"><i class="bi bi-journal-lock"></i>Internal notes <span class="text-faint">(admin-only, never visible to the student)</span></div>
        <div id="tkNotesList" class="mb-2">${notesMarkup(notes)}</div>
        <div class="d-flex gap-2">
          <input id="tkNoteInput" class="form-control" maxlength="2000" placeholder="Add an internal note…">
          <button type="button" class="btn btn-ghost" id="tkNoteAddBtn"><i class="bi bi-plus-lg"></i> Add</button>
        </div>
        <p class="auth-error" id="tkNoteError" hidden></p>`;

    document.getElementById('tkStatusSaveBtn').addEventListener('click', onSaveStatus);
    document.getElementById('tkNoteAddBtn').addEventListener('click', onAddNote);
}

async function onSaveStatus() {
    const select = document.getElementById('tkStatusSelect');
    const btn = document.getElementById('tkStatusSaveBtn');
    const errorEl = document.getElementById('tkStatusError');
    errorEl.hidden = true;

    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Updating…`;

    const result = await AdminService.setTicketStatus({ ticketId: currentTicketId, newStatus: select.value });

    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-check2"></i> Update status`;

    if (!result.ok) {
        errorEl.textContent = result.message;
        errorEl.hidden = false;
        return;
    }

    Toast.show('Ticket status updated.', 'accent', 'bi-check-circle-fill');
    loadRows();
    viewTicket(currentTicketId);
}

async function onAddNote() {
    const input = document.getElementById('tkNoteInput');
    const btn = document.getElementById('tkNoteAddBtn');
    const errorEl = document.getElementById('tkNoteError');
    errorEl.hidden = true;

    const note = input.value.trim();
    if (!note) {
        errorEl.textContent = 'Note cannot be empty.';
        errorEl.hidden = false;
        return;
    }

    btn.disabled = true;
    const result = await AdminService.addTicketNote({ ticketId: currentTicketId, note });
    btn.disabled = false;

    if (!result.ok) {
        errorEl.textContent = result.message;
        errorEl.hidden = false;
        return;
    }

    input.value = '';
    viewTicket(currentTicketId);
}

function onRowAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'view') viewTicket(btn.dataset.id);
}

function wireFilters() {
    let searchTimer = null;
    document.getElementById('admSearch').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { currentPage = 1; loadRows(); }, 300);
    });
    ['admStatus', 'admCategory', 'admSort'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { currentPage = 1; loadRows(); });
    });
    document.getElementById('admFiltersClear').addEventListener('click', () => {
        document.getElementById('admSearch').value = '';
        document.getElementById('admStatus').value = 'all';
        document.getElementById('admCategory').value = 'all';
        document.getElementById('admSort').value = 'created_desc';
        currentPage = 1;
        loadRows();
    });
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-tickets', admin);
    mountAdminTopbar(admin);

    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    if (status) document.getElementById('admStatus').value = status;

    wireFilters();
    document.getElementById('admBody').addEventListener('click', onRowAction);

    loadRows();
}

init();

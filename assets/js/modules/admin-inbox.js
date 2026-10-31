import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDateTime, mountAdminTopbar, renderErrorWithRetry } from './admin-shared.js';
import { MESSAGE_CATEGORY_LABELS, MESSAGE_CATEGORY_ICONS, messageCategoryBadge } from './comms-shared.js';

const PAGE_SIZE = 10;

function formatTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}
let currentPage = 1;
let isSending = false;

/* Selected recipient IDs for the 'selected' / 'single' scopes, keyed by student id
   so toggling a checkbox is an O(1) Map operation regardless of list size. */
let selectedStudents = new Map();
let allStudentsCache = [];

/* ---------- Message history (list) ---------- */

async function loadRows() {
    const body = document.getElementById('admBody');
    const loading = document.getElementById('admLoading');
    const empty = document.getElementById('admEmpty');
    const errorBox = document.getElementById('admError');
    const pagination = document.getElementById('admPagination');

    loading.hidden = false;
    empty.hidden = true;
    errorBox.hidden = true;
    body.hidden = true;

    const search = document.getElementById('admSearch').value;
    const category = document.getElementById('admCategory').value;
    const dateFrom = document.getElementById('admDateFrom').value;
    const dateTo = document.getElementById('admDateTo').value;
    const sort = document.getElementById('admSort').value;

    const result = await AdminService.listMessages({ search, category, dateFrom, dateTo, sort, page: currentPage, pageSize: PAGE_SIZE });

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

    body.hidden = false;
    body.innerHTML = rows.map(r => {
        const icon = MESSAGE_CATEGORY_ICONS[r.category] || 'bi-chat-square-text-fill';
        return `
      <div class="msg-row" data-id="${r.id}">
        <span class="msg-row-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
        <div class="msg-row-body">
          <span class="msg-pill">${messageCategoryBadge(escHtml, r.category)}</span>
          <div class="msg-subject">${escHtml(r.subject)}</div>
          <div class="msg-preview">${escHtml(r.body || '')}</div>
        </div>
        <div class="msg-row-side">
          <span class="msg-time">${formatTime(r.sent_at)}</span>
          <button type="button" class="msg-action-btn danger" data-act="archive" data-id="${r.id}" data-subject="${escHtml(r.subject)}" title="Archive" aria-label="Archive message"><i class="bi bi-archive"></i></button>
        </div>
      </div>`;
    }).join('');

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    pagination.hidden = totalPages <= 1;
    pagination.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="pagePrev" ${currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i> Prev</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" id="pageNext" ${currentPage >= totalPages ? 'disabled' : ''}>Next <i class="bi bi-chevron-right"></i></button>`;

    const prevBtn = document.getElementById('pagePrev');
    const nextBtn = document.getElementById('pageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; loadRows(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; loadRows(); });
}

/* ---------- View details ---------- */

async function viewMessage(id) {
    const bodyEl = document.getElementById('msgDetailBody');
    bodyEl.innerHTML = `<div class="adm-loading"><i class="bi bi-hourglass-split"></i> Loading…</div>`;
    const modal = new bootstrap.Modal(document.getElementById('messageDetailModal'));
    modal.show();

    const result = await AdminService.getMessage(id);
    if (!result.ok) {
        renderErrorWithRetry(bodyEl, result.message, () => viewMessage(id));
        return;
    }

    const { message, recipients, readCount, totalCount } = result.data;
    document.getElementById('msgDetailTitle').textContent = message.subject;

    const scopeLabel = message.recipient_scope === 'all' ? 'All approved students at the time of sending'
        : message.recipient_scope === 'single' ? 'One specific student' : 'Selected students';

    const recipientRows = recipients.map(r => `
        <tr>
            <td>${escHtml(r.student && r.student.full_name ? r.student.full_name : 'Unnamed account')}</td>
            <td>${escHtml(r.student && r.student.email ? r.student.email : '—')}</td>
            <td>${r.read_at ? `<span class="status-badge approved">Read</span> <span class="text-faint" style="font-size:.74rem">${formatDateTime(r.read_at)}</span>` : '<span class="status-badge pending">Unread</span>'}</td>
        </tr>`).join('');

    bodyEl.innerHTML = `
        <div class="adm-detail-grid mb-3">
            <dt>Category</dt><dd>${messageCategoryBadge(escHtml, message.category)}</dd>
            <dt>Sent</dt><dd>${formatDateTime(message.sent_at)}</dd>
            <dt>Sender</dt><dd>${escHtml(message.sender && message.sender.full_name ? message.sender.full_name : 'Administrator')}</dd>
            <dt>Audience</dt><dd>${escHtml(scopeLabel)}</dd>
            <dt>Recipients</dt><dd>${totalCount}</dd>
            <dt>Read / Unread</dt><dd>${readCount} read &middot; ${totalCount - readCount} unread</dd>
        </div>
        <div class="section-title mb-2" style="font-size:.84rem"><i class="bi bi-file-text"></i>Message</div>
        <div class="glass card-pad mb-3" style="white-space:pre-wrap;font-size:.88rem">${escHtml(message.body)}</div>
        <div class="section-title mb-2" style="font-size:.84rem"><i class="bi bi-people"></i>Recipients (${totalCount})</div>
        <div class="adm-table-wrap" style="max-height:16rem;overflow-y:auto">
            <table class="adm-table">
                <thead><tr><th scope="col">Student</th><th scope="col">Email</th><th scope="col">Status</th></tr></thead>
                <tbody>${recipientRows || '<tr><td colspan="3" class="text-faint">No recipients.</td></tr>'}</tbody>
            </table>
        </div>`;
}

async function archiveMessage(id, subject) {
    confirmAction({
        title: 'Archive this message?',
        message: `"${subject}" will be hidden from every recipient's inbox and from this list. Recipient read history and the audit trail are preserved.`,
        confirmLabel: 'Archive',
        danger: true,
        icon: 'bi-archive-fill',
        async onConfirm() {
            const result = await AdminService.archiveMessage(id);
            if (!result.ok) {
                Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
                return;
            }
            Toast.show('Message archived.', 'accent', 'bi-check-circle-fill');
            loadRows();
        },
    });
}

function onRowAction(e) {
    const btn = e.target.closest('[data-act]');
    if (btn && !btn.disabled) {
        const id = btn.dataset.id;
        if (btn.dataset.act === 'view') viewMessage(id);
        if (btn.dataset.act === 'archive') archiveMessage(id, btn.dataset.subject || 'this message');
        return;
    }
    // Clicking anywhere else on the row (Gmail-style) opens the message.
    const row = e.target.closest('.msg-row');
    if (row) viewMessage(row.dataset.id);
}

/* ---------- Compose: recipient picker ---------- */

function renderRecipientList(students) {
    const list = document.getElementById('cmRecipientList');
    const scope = document.getElementById('cmScope').value;

    if (!students.length) {
        list.innerHTML = `<p class="text-faint" style="font-size:.82rem">No matching approved students.</p>`;
        return;
    }

    list.innerHTML = students.map(s => {
        const checked = selectedStudents.has(s.id) ? 'checked' : '';
        const inputType = scope === 'single' ? 'radio' : 'checkbox';
        return `
        <label class="adm-recipient-row">
            <input type="${inputType}" name="cmRecipient" value="${s.id}" ${checked}>
            <span class="adm-recipient-name">${escHtml(s.full_name || 'Unnamed account')}</span>
            <span class="adm-recipient-email text-faint">${escHtml(s.email || '—')}</span>
        </label>`;
    }).join('');

    list.querySelectorAll('input[name="cmRecipient"]').forEach(input => {
        input.addEventListener('change', () => {
            if (scope === 'single') selectedStudents.clear();
            if (input.checked) selectedStudents.set(input.value, true);
            else selectedStudents.delete(input.value);
            updateRecipientCount();
        });
    });
}

function updateRecipientCount() {
    document.getElementById('cmRecipientCount').textContent = `${selectedStudents.size} selected`;
}

async function loadStudentsForPicker(search = '') {
    const result = await AdminService.listApprovedStudents({ search });
    if (!result.ok) {
        document.getElementById('cmRecipientList').innerHTML = `<p class="text-faint" style="font-size:.82rem">${escHtml(result.message)}</p>`;
        return;
    }
    allStudentsCache = result.data;
    renderRecipientList(allStudentsCache);
}

function onScopeChange() {
    const scope = document.getElementById('cmScope').value;
    const wrap = document.getElementById('cmRecipientPickerWrap');
    wrap.hidden = scope === 'all';
    selectedStudents.clear();
    updateRecipientCount();
    if (scope !== 'all') loadStudentsForPicker(document.getElementById('cmRecipientSearch').value);
}

/* ---------- Compose: send ---------- */

function resetComposeForm() {
    document.getElementById('composeForm').reset();
    document.getElementById('cmScope').value = 'all';
    document.getElementById('cmRecipientPickerWrap').hidden = true;
    selectedStudents.clear();
    updateRecipientCount();
    ['cmSubjectError', 'cmBodyError', 'cmRecipientError'].forEach(id => {
        const el = document.getElementById(id);
        el.hidden = true;
        el.textContent = '';
    });
}

async function onComposeSubmit(e) {
    e.preventDefault();
    if (isSending) return;

    const subject = document.getElementById('cmSubject').value.trim();
    const body = document.getElementById('cmBody').value.trim();
    const category = document.getElementById('cmCategory').value;
    const scope = document.getElementById('cmScope').value;

    let hasError = false;
    const subjectError = document.getElementById('cmSubjectError');
    const bodyError = document.getElementById('cmBodyError');
    const recipientError = document.getElementById('cmRecipientError');
    [subjectError, bodyError, recipientError].forEach(el => { el.hidden = true; });

    if (!subject || subject.length > 150) {
        subjectError.textContent = 'Subject is required (max 150 characters).';
        subjectError.hidden = false;
        hasError = true;
    }
    if (!body || body.length > 4000) {
        bodyError.textContent = 'Message is required (max 4000 characters).';
        bodyError.hidden = false;
        hasError = true;
    }
    if (scope !== 'all' && selectedStudents.size === 0) {
        recipientError.textContent = scope === 'single' ? 'Select a student.' : 'Select at least one student.';
        recipientError.hidden = false;
        hasError = true;
    }
    if (scope === 'single' && selectedStudents.size > 1) {
        recipientError.textContent = 'Only one student can be selected for this option.';
        recipientError.hidden = false;
        hasError = true;
    }

    if (hasError) return;

    isSending = true;
    const sendBtn = document.getElementById('cmSendBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> Sending…`;

    const studentIds = scope === 'all' ? null : [...selectedStudents.keys()];
    const result = await AdminService.sendMessage({ subject, body, category, recipientScope: scope, studentIds });

    isSending = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = `<i class="bi bi-send"></i> Send message`;

    if (!result.ok) {
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    bootstrap.Modal.getInstance(document.getElementById('composeModal')).hide();
    Toast.show('Message sent.', 'accent', 'bi-check-circle-fill');
    resetComposeForm();
    currentPage = 1;
    loadRows();
}

/* ---------- Filters ---------- */

function wireFilters() {
    let searchTimer = null;
    document.getElementById('admSearch').addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { currentPage = 1; loadRows(); }, 300);
    });
    ['admCategory', 'admDateFrom', 'admDateTo', 'admSort'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { currentPage = 1; loadRows(); });
    });
    document.getElementById('admFiltersClear').addEventListener('click', () => {
        document.getElementById('admSearch').value = '';
        document.getElementById('admCategory').value = 'all';
        document.getElementById('admDateFrom').value = '';
        document.getElementById('admDateTo').value = '';
        document.getElementById('admSort').value = 'sent_desc';
        currentPage = 1;
        loadRows();
    });
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-inbox', admin);
    mountAdminTopbar(admin);

    wireFilters();
    document.getElementById('admBody').addEventListener('click', onRowAction);

    document.getElementById('cmScope').addEventListener('change', onScopeChange);
    let recipientSearchTimer = null;
    document.getElementById('cmRecipientSearch').addEventListener('input', (e) => {
        clearTimeout(recipientSearchTimer);
        recipientSearchTimer = setTimeout(() => loadStudentsForPicker(e.target.value), 250);
    });
    document.getElementById('composeForm').addEventListener('submit', onComposeSubmit);
    document.getElementById('composeModal').addEventListener('hidden.bs.modal', resetComposeForm);

    loadRows();
}

init();

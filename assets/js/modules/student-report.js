import { StudentService } from '../services/student-service.js';
import { REPORT_CATEGORY_LABELS, TICKET_STATUS_LABELS, ticketStatusBadge } from './comms-shared.js';

let isSubmitting = false;

function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}

function renderErrorBox(container, message) {
    container.hidden = false;
    container.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><br>${escHtml(message)}</div>`;
}

async function loadHistory() {
    const loading = document.getElementById('rpLoading');
    const body = document.getElementById('rpHistoryBody');
    const empty = document.getElementById('rpHistoryEmpty');
    const errorBox = document.getElementById('rpHistoryError');
    const table = body.closest('.adm-table-wrap');

    loading.hidden = false;
    empty.hidden = true;
    errorBox.hidden = true;
    table.hidden = true;

    const result = await StudentService.listMyReports({ pageSize: 50 });

    loading.hidden = true;

    if (!result.ok) {
        if (result.message === 'Not signed in.') {
            document.getElementById('rpSignInNotice').hidden = false;
            empty.hidden = false;
            empty.textContent = 'Sign in to see your submitted reports.';
            return;
        }
        renderErrorBox(errorBox, result.message);
        return;
    }

    const { rows, total } = result.data;
    document.getElementById('rpCount').textContent = total ? `${total} report${total === 1 ? '' : 's'}` : '';

    if (!rows.length) {
        empty.hidden = false;
        return;
    }

    table.hidden = false;
    body.innerHTML = rows.map(r => `
        <tr data-id="${r.id}" class="rp-history-row" style="cursor:pointer">
            <td data-label="Ticket"><span class="text-faint" style="font-family:var(--font-mono);font-size:.76rem">${escHtml(r.ticket_ref)}</span></td>
            <td data-label="Subject">${escHtml(r.subject)}</td>
            <td data-label="Category">${escHtml(REPORT_CATEGORY_LABELS[r.category] || r.category)}</td>
            <td data-label="Submitted">${formatDateTime(r.created_at)}</td>
            <td data-label="Status">${ticketStatusBadge(escHtml, r.status)}</td>
        </tr>`).join('');

    body.querySelectorAll('.rp-history-row').forEach(row => {
        row.addEventListener('click', () => viewReport(row.dataset.id));
    });
}

async function viewReport(id) {
    const bodyEl = document.getElementById('rpDetailBody');
    bodyEl.innerHTML = `<div class="adm-loading"><i class="bi bi-hourglass-split"></i> Loading…</div>`;
    const modal = new bootstrap.Modal(document.getElementById('reportDetailModal'));
    modal.show();

    const result = await StudentService.getMyReport(id);
    if (!result.ok) {
        renderErrorBox(bodyEl, result.message);
        return;
    }

    const r = result.data;
    document.getElementById('rpDetailTitle').innerHTML = `<span style="font-family:var(--font-mono);font-size:.82rem">${escHtml(r.ticket_ref)}</span>`;
    bodyEl.innerHTML = `
        <div class="adm-detail-grid mb-3">
            <dt>Status</dt><dd>${ticketStatusBadge(escHtml, r.status)}</dd>
            <dt>Category</dt><dd>${escHtml(REPORT_CATEGORY_LABELS[r.category] || r.category)}</dd>
            <dt>Submitted</dt><dd>${formatDateTime(r.created_at)}</dd>
            <dt>Last updated</dt><dd>${formatDateTime(r.updated_at)}</dd>
        </div>
        <div class="section-title mb-2" style="font-size:.84rem"><i class="bi bi-chat-left-text"></i>${escHtml(r.subject)}</div>
        <div class="glass card-pad" style="white-space:pre-wrap;font-size:.88rem">${escHtml(r.description)}</div>`;
}

async function onSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const category = document.getElementById('rpCategory').value;
    const subject = document.getElementById('rpSubject').value.trim();
    const description = document.getElementById('rpDetails').value.trim();

    const subjectError = document.getElementById('rpSubjectError');
    const detailsError = document.getElementById('rpDetailsError');
    subjectError.hidden = true;
    detailsError.hidden = true;

    let hasError = false;
    if (!subject || subject.length > 150) {
        subjectError.textContent = 'Subject is required (max 150 characters).';
        subjectError.hidden = false;
        hasError = true;
    }
    if (!description || description.length > 4000) {
        detailsError.textContent = 'Please describe what happened (max 4000 characters).';
        detailsError.hidden = false;
        hasError = true;
    }
    if (hasError) return;

    isSubmitting = true;
    const btn = document.getElementById('rpSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-hourglass-split"></i> Sending…`;

    const result = await StudentService.submitReport({ category, subject, description });

    isSubmitting = false;
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send me-1"></i>Send report`;

    if (!result.ok) {
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    Toast.show(`Report submitted. Your ticket reference is ${result.data.ticketRef}.`, 'accent', 'bi-check-circle-fill');
    document.getElementById('reportForm').reset();
    loadHistory();
}

function init() {
    document.getElementById('reportForm').addEventListener('submit', onSubmit);
    loadHistory();
}

init();

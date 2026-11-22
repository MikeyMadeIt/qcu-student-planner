import { StudentService } from '../services/student-service.js';
import { REPORT_CATEGORY_LABELS, ticketStatusBadge } from './comms-shared.js';

const SUBJECT_MAX = 150;
const DETAILS_MAX = 4000;
const NOT_SIGNED_IN = 'Not signed in.';

let isSubmitting = false;
let hasResults = false;
let detailToken = 0;

const $ = id => document.getElementById(id);

function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatShortDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {
        return '—';
    }
}

function formatDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return '—';
    }
}

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}

function categoryLabel(category) {
    return REPORT_CATEGORY_LABELS[category] || category || '—';
}

function toast(message, tone, icon) {
    if (typeof Toast !== 'undefined' && Toast && typeof Toast.show === 'function')
        Toast.show(message, tone, icon);
}

/* ── Error / empty helpers ── */

function renderErrorBox(container, message, withRetry) {
    container.hidden = false;
    container.innerHTML = `
        <div class="rp-error-box" role="alert">
            <i class="bi bi-exclamation-triangle" aria-hidden="true"></i>
            <p>${escHtml(message)}</p>
            ${withRetry ? '<button type="button" class="btn btn-ghost btn-sm" data-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>' : ''}
        </div>`;
}

/* ── Your reports ── */

function rowHtml(r) {
    const subject = escHtml(r.subject);
    const category = escHtml(categoryLabel(r.category));
    return `
        <tr class="rp-row" data-id="${escHtml(r.id)}">
            <td class="rp-col-ticket"><span class="rp-ref">${escHtml(r.ticket_ref)}</span></td>
            <td class="rp-col-subject" title="${subject}">${subject}</td>
            <td class="rp-col-cat"><span class="rp-badge" title="${category}">${category}</span></td>
            <td class="rp-col-date">${formatDate(r.created_at)}</td>
            <td class="rp-col-status">${ticketStatusBadge(escHtml, r.status)}</td>
            <td class="rp-col-act">
                <button type="button" class="btn btn-ghost adm-icon-btn" data-view title="View details" aria-label="View details for ${subject}">
                    <i class="bi bi-eye" aria-hidden="true"></i>
                </button>
            </td>
        </tr>`;
}

function itemHtml(r) {
    const subject = escHtml(r.subject);
    const category = escHtml(categoryLabel(r.category));
    return `
        <li class="rp-item" data-id="${escHtml(r.id)}">
            <div class="rp-item-main">
                <div class="rp-item-subject" title="${subject}">${subject}</div>
                <div class="rp-item-meta">
                    <span>${formatShortDate(r.created_at)}</span>
                    ${ticketStatusBadge(escHtml, r.status)}
                </div>
            </div>
            <div class="rp-item-side">
                <span class="rp-badge" title="${category}">${category}</span>
                <button type="button" class="btn btn-ghost adm-icon-btn" data-view title="View details" aria-label="View details for ${subject}">
                    <i class="bi bi-eye" aria-hidden="true"></i>
                </button>
            </div>
        </li>`;
}

async function loadHistory({ silent = false } = {}) {
    const loading = $('rpLoading');
    const empty = $('rpHistoryEmpty');
    const errorBox = $('rpHistoryError');
    const results = $('rpResults');

    if (!silent || !hasResults) {
        loading.hidden = false;
        empty.hidden = true;
        errorBox.hidden = true;
        results.hidden = true;
    }

    let result;
    try {
        result = await StudentService.listMyReports({ pageSize: 50 });
    } catch (err) {
        result = { ok: false, message: 'Could not load your reports. Check your connection and try again.' };
    }

    loading.hidden = true;

    if (!result.ok) {
        if (result.message === NOT_SIGNED_IN) {
            $('rpSignInNotice').hidden = false;
            hasResults = false;
            results.hidden = true;
            errorBox.hidden = true;
            $('rpEmptyTitle').textContent = 'Sign in to see your submitted reports.';
            $('rpEmptyHint').hidden = true;
            empty.hidden = false;
            return;
        }
        if (silent && hasResults) {
            // Keep the list that is already on screen and just tell the user.
            results.hidden = false;
            toast('Your reports could not be refreshed.', 'danger', 'bi-exclamation-triangle');
            return;
        }
        hasResults = false;
        results.hidden = true;
        renderErrorBox(errorBox, result.message || 'Could not load your reports.', true);
        return;
    }

    const { rows, total } = result.data;
    $('rpCount').textContent = total ? `${total} report${total === 1 ? '' : 's'}` : '';
    errorBox.hidden = true;

    if (!rows.length) {
        hasResults = false;
        results.hidden = true;
        $('rpEmptyTitle').textContent = "You haven't submitted any reports yet.";
        $('rpEmptyHint').hidden = false;
        empty.hidden = false;
        return;
    }

    empty.hidden = true;
    $('rpHistoryBody').innerHTML = rows.map(rowHtml).join('');
    $('rpHistoryList').innerHTML = rows.map(itemHtml).join('');
    results.hidden = false;
    hasResults = true;
}

/* ── Report details ── */

async function viewReport(id) {
    const token = ++detailToken;
    const bodyEl = $('rpDetailBody');
    $('rpDetailTitle').textContent = 'Report details';
    bodyEl.innerHTML = `<div class="adm-loading" role="status"><i class="bi bi-hourglass-split" aria-hidden="true"></i> Loading…</div>`;
    bootstrap.Modal.getOrCreateInstance($('reportDetailModal')).show();

    let result;
    try {
        result = await StudentService.getMyReport(id);
    } catch (err) {
        result = { ok: false, message: 'Could not load this report. Check your connection and try again.' };
    }
    if (token !== detailToken) return; // a newer report was opened meanwhile

    if (!result.ok) {
        renderErrorBox(bodyEl, result.message, false);
        return;
    }

    const r = result.data;
    $('rpDetailTitle').innerHTML = `<span class="rp-ticket-title">${escHtml(r.ticket_ref)}</span>`;
    bodyEl.innerHTML = `
        <dl class="rp-detail">
            <dt>Status</dt><dd>${ticketStatusBadge(escHtml, r.status)}</dd>
            <dt>Category</dt><dd>${escHtml(categoryLabel(r.category))}</dd>
            <dt>Submitted</dt><dd>${formatDateTime(r.created_at)}</dd>
            <dt>Last updated</dt><dd>${formatDateTime(r.updated_at)}</dd>
        </dl>
        <h3 class="rp-detail-subject">${escHtml(r.subject)}</h3>
        <div class="rp-detail-text">${escHtml(r.description)}</div>`;
}

/* ── Form ── */

function updateCounter(inputId, counterId, max) {
    const input = $(inputId);
    const counter = $(counterId);
    const length = input.value.length;
    counter.textContent = `${length}/${max}`;
    counter.classList.toggle('is-near', length >= max * 0.9);
}

function setFieldError(inputId, errorId, message) {
    const input = $(inputId);
    const error = $(errorId);
    if (message) {
        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
    } else {
        error.textContent = '';
        error.hidden = true;
        input.removeAttribute('aria-invalid');
    }
}

function clearFormMessages() {
    setFieldError('rpSubject', 'rpSubjectError', '');
    setFieldError('rpDetails', 'rpDetailsError', '');
    $('rpFormError').hidden = true;
    $('rpFormError').textContent = '';
    $('rpSuccess').hidden = true;
    $('rpSuccess').innerHTML = '';
}

function showFormError(message) {
    const box = $('rpFormError');
    box.innerHTML = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${escHtml(message)}</span>`;
    box.hidden = false;
}

function showSuccess(ticketRef) {
    const box = $('rpSuccess');
    box.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i><span>Report sent. Your ticket reference is <strong>${escHtml(ticketRef)}</strong>. You can follow its status under Your reports.</span>`;
    box.hidden = false;
}

function setSubmitting(on) {
    isSubmitting = on;
    const btn = $('rpSubmitBtn');
    $('rpFieldset').disabled = on;
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    btn.innerHTML = on
        ? `<i class="bi bi-arrow-repeat adm-spin" aria-hidden="true"></i><span>Sending…</span>`
        : `<i class="bi bi-send" aria-hidden="true"></i><span>Send report</span>`;
}

async function onSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearFormMessages();

    const category = $('rpCategory').value;
    const subject = $('rpSubject').value.trim();
    const description = $('rpDetails').value.trim();

    let firstInvalid = null;
    if (!subject) {
        setFieldError('rpSubject', 'rpSubjectError', 'Please enter a subject.');
        firstInvalid = firstInvalid || $('rpSubject');
    } else if (subject.length > SUBJECT_MAX) {
        setFieldError('rpSubject', 'rpSubjectError', `Subject must be ${SUBJECT_MAX} characters or fewer.`);
        firstInvalid = firstInvalid || $('rpSubject');
    }
    if (!description) {
        setFieldError('rpDetails', 'rpDetailsError', 'Please describe what happened.');
        firstInvalid = firstInvalid || $('rpDetails');
    } else if (description.length > DETAILS_MAX) {
        setFieldError('rpDetails', 'rpDetailsError', `Details must be ${DETAILS_MAX} characters or fewer.`);
        firstInvalid = firstInvalid || $('rpDetails');
    }
    if (firstInvalid) {
        firstInvalid.focus();
        return;
    }

    setSubmitting(true);

    let result;
    try {
        result = await StudentService.submitReport({ category, subject, description });
    } catch (err) {
        result = { ok: false, message: 'Could not send your report. Check your connection and try again.' };
    }

    setSubmitting(false);

    if (!result.ok) {
        if (result.message === NOT_SIGNED_IN)
            $('rpSignInNotice').hidden = false;
        showFormError(result.message || 'Could not send your report. Please try again.');
        toast(result.message, 'danger', 'bi-exclamation-triangle');
        return;
    }

    toast(`Report submitted. Your ticket reference is ${result.data.ticketRef}.`, 'accent', 'bi-check-circle');
    $('reportForm').reset();
    updateCounter('rpSubject', 'rpSubjectCount', SUBJECT_MAX);
    updateCounter('rpDetails', 'rpDetailsCount', DETAILS_MAX);
    showSuccess(result.data.ticketRef);
    loadHistory({ silent: true });
}

/* ── Init ── */

function init() {
    const form = $('reportForm');
    form.addEventListener('submit', onSubmit);

    $('rpSubject').addEventListener('input', () => {
        updateCounter('rpSubject', 'rpSubjectCount', SUBJECT_MAX);
        if ($('rpSubject').getAttribute('aria-invalid')) setFieldError('rpSubject', 'rpSubjectError', '');
        $('rpSuccess').hidden = true;
    });
    $('rpDetails').addEventListener('input', () => {
        updateCounter('rpDetails', 'rpDetailsCount', DETAILS_MAX);
        if ($('rpDetails').getAttribute('aria-invalid')) setFieldError('rpDetails', 'rpDetailsError', '');
        $('rpSuccess').hidden = true;
    });
    $('rpCategory').addEventListener('change', () => { $('rpSuccess').hidden = true; });

    // One listener for the table rows, the stacked list items and the retry button.
    $('rpReports').addEventListener('click', event => {
        if (event.target.closest('[data-retry]')) {
            loadHistory();
            return;
        }
        const row = event.target.closest('[data-id]');
        if (row) viewReport(row.dataset.id);
    });

    updateCounter('rpSubject', 'rpSubjectCount', SUBJECT_MAX);
    updateCounter('rpDetails', 'rpDetailsCount', DETAILS_MAX);
    loadHistory();
}

init();
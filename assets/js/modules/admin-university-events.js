// Admin University Events page (ES module). Centrally-managed events: only an
// approved admin can reach this page or call the create/update/delete RPCs
// (enforced server-side — see 0028_university_events.sql). Every write here
// goes through AdminService, and the list simply re-fetches from Supabase
// after each change, matching the fetch-on-load pattern the rest of the
// admin area already uses (no realtime / forced page reload needed).
//
// Status + the "View" details modal are shared with the student Calendar's
// read-only event view — see assets/js/utils/event-details.js (classic
// script; univEventStatus / openUnivEventDetailsModal used below are its
// globals, same pattern as ymdLocal/escHtml from utils/dates.js & dom.js).

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, mountAdminTopbar, renderErrorWithRetry } from './admin-shared.js';

let rows = [];
let editingId = null;

// Selected month/year for the "All University Events" list — defaults to the
// current month on load, then moves with the chevrons (client-side filter
// only; loadRows() always fetches every event and we filter at render time).
const _now = new Date();
let selMonth = _now.getMonth(); // 0-11
let selYear = _now.getFullYear();

function todayKeyLocal() {
    return ymdLocal(new Date());
}

function monthLabel() {
    return new Date(selYear, selMonth, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// True when ev.event_date (stored 'YYYY-MM-DD') falls in the selected
// month/year. Compared as plain string parts — never via a Date object —
// so this can't drift across a DST boundary or mix up same-month-different-year.
function isInSelectedMonth(ev) {
    if (!ev.event_date) return false;
    const y = Number(ev.event_date.slice(0, 4));
    const m = Number(ev.event_date.slice(5, 7)); // 1-12
    return y === selYear && m === selMonth + 1;
}

function goToMonth(delta) {
    selMonth += delta;
    if (selMonth > 11) { selMonth = 0; selYear++; }
    else if (selMonth < 0) { selMonth = 11; selYear--; }
    renderRows();
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadRows() {
    const loading = document.getElementById('uevLoading');
    const errorBox = document.getElementById('uevError');
    const empty = document.getElementById('uevEmpty');
    const table = document.getElementById('uevBody').closest('.adm-table-wrap');

    loading.hidden = false;
    errorBox.hidden = true;
    empty.hidden = true;
    table.hidden = true;

    const result = await AdminService.listUniversityEvents();
    loading.hidden = true;

    if (!result.ok) {
        errorBox.hidden = false;
        renderErrorWithRetry(errorBox, result.message, loadRows);
        return;
    }

    rows = result.data.rows;
    table.hidden = false;
    renderRows();
}

function renderRows() {
    document.getElementById('uevMonthLabel').textContent = monthLabel();

    const body = document.getElementById('uevBody');
    const empty = document.getElementById('uevEmpty');
    const table = document.getElementById('uevBody').closest('.adm-table-wrap');
    const monthRows = rows.filter(isInSelectedMonth);

    document.getElementById('uevCount').textContent = `${monthRows.length} event${monthRows.length === 1 ? '' : 's'}`;

    if (!monthRows.length) {
        table.hidden = true;
        empty.hidden = false;
        empty.innerHTML = rows.length
            ? `No events in <strong>${escHtml(monthLabel())}</strong>. Use <strong>Add Event</strong> to publish one, or browse another month.`
            : `No university events yet. Use <strong>Add Event</strong> to publish the first one — students will see it on their Calendar right away.`;
        return;
    }

    table.hidden = false;
    empty.hidden = true;
    body.innerHTML = monthRows.map(ev => {
        const status = univEventStatus(ev);
        return `
      <tr>
        <td data-label="Event" class="uev-col-event">
          <div class="adm-name">${escHtml(ev.title)}</div>
          <div class="adm-sub adm-col-show-mobile">${formatDateDisplay(ev.event_date)}</div>
        </td>
        <td data-label="Date" class="adm-col-hide-mobile">${formatDateDisplay(ev.event_date)}</td>
        <td data-label="Status"><span class="status-badge event-status-${status.key}">${status.label}</span></td>
        <td class="adm-actions">
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="view" data-id="${ev.id}" title="View details" aria-label="View event details"><i class="bi bi-eye" aria-hidden="true"></i></button>
          <button class="btn btn-ghost btn-sm adm-icon-btn" data-act="edit" data-id="${ev.id}" title="Edit" aria-label="Edit event"><i class="bi bi-pencil" aria-hidden="true"></i></button>
          <button class="btn btn-ghost btn-sm adm-icon-btn adm-danger" data-act="delete" data-id="${ev.id}" title="Delete" aria-label="Delete event"><i class="bi bi-trash3" aria-hidden="true"></i></button>
        </td>
      </tr>`;
    }).join('');
}

const MAX_RANGE_DAYS = 60;
const MAX_SPECIFIC_DATES = 30;

// Row markup matches the student Calendar's own "Add University Event" sheet
// (see assets/js/modules/calendar.js, univDateRowHtml) — same d-flex row with
// a form-control date input and a btn-icon remove button.
function specificDateRowHtml(value) {
    return `<div class="d-flex gap-2 mb-2 uev-date-row">
    <input type="date" class="form-control uev-specific-date" value="${value || todayKeyLocal()}">
    <button type="button" class="btn-icon uev-remove-date" aria-label="Remove date"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
  </div>`;
}

function modalFieldsHtml(existing) {
    const e = existing || {};
    // Multi-date creation (range or several specific dates) only makes sense
    // when adding a brand-new event — editing always targets the one row
    // being edited, so it stays single-date.
    const canRange = !existing;
    const dateFieldHtml = canRange ? `
      <div class="mb-3">
        <div class="btn-group w-100" role="group">
          <button type="button" class="btn btn-ghost btn-sm active" id="uevModeRangeBtn"><i class="bi bi-calendar-range me-1" aria-hidden="true"></i>Date Range</button>
          <button type="button" class="btn btn-ghost btn-sm" id="uevModeMultiBtn"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Specific Dates</button>
        </div>
      </div>
      <div id="uevRangeFields">
        <div class="row g-2 mb-2">
          <div class="col-6"><label>From</label><input type="date" class="form-control" id="uevRangeStart" value="${e.event_date || todayKeyLocal()}"></div>
          <div class="col-6"><label>To</label><input type="date" class="form-control" id="uevRangeEnd" value="${e.event_date || todayKeyLocal()}"></div>
        </div>
        <div class="text-faint" style="font-size:.75rem">Every day in this range (inclusive) will show the event.</div>
      </div>
      <div id="uevMultiFields" class="d-none">
        <label>Dates</label>
        <div id="uevSpecificDatesList">${specificDateRowHtml(e.event_date)}</div>
        <button type="button" class="btn btn-ghost btn-sm mt-1" id="uevAddDateBtn"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add Another Date</button>
      </div>` : `
      <div class="mb-2"><label>Date</label><input type="date" class="form-control" id="uevDate" value="${e.event_date || todayKeyLocal()}"></div>`;
    return `
    <h5 class="mb-3"><i class="bi bi-bank2 me-2" aria-hidden="true"></i>${existing ? 'Edit' : 'Add'} University Event</h5>
    <div class="mb-2"><label for="uevTitle">Event Title</label><input class="form-control" id="uevTitle" maxlength="150" placeholder="e.g. Semestral Break, Enrollment, Foundation Day" value="${escHtml(e.title || '')}"></div>
    <div class="mb-3"><label for="uevDescription">Note (optional)</label><textarea class="form-control" id="uevDescription" rows="2" maxlength="4000" placeholder="Additional details…">${escHtml(e.description || '')}</textarea></div>
    ${dateFieldHtml}
    <p class="text-danger mb-0 mt-3" id="uevModalMsg" hidden style="font-size:.85rem"></p>
    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-accent flex-grow-1" id="uevSaveBtn"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Save Event</button>
      <button class="btn btn-ghost" data-bs-dismiss="modal">Cancel</button>
    </div>`;
}

function addSpecificDateRow() {
    const list = document.getElementById('uevSpecificDatesList');
    if (!list || list.children.length >= MAX_SPECIFIC_DATES) return;
    list.insertAdjacentHTML('beforeend', specificDateRowHtml(''));
}

function wireDateModeToggle() {
    const rangeBtn = document.getElementById('uevModeRangeBtn');
    const multiBtn = document.getElementById('uevModeMultiBtn');
    if (!rangeBtn) return; // editing an existing event — single-date only, no toggle
    const rangeFields = document.getElementById('uevRangeFields');
    const multiFields = document.getElementById('uevMultiFields');

    function setMode(mode) {
        rangeBtn.classList.toggle('active', mode === 'range');
        multiBtn.classList.toggle('active', mode === 'multiple');
        rangeFields.classList.toggle('d-none', mode !== 'range');
        multiFields.classList.toggle('d-none', mode !== 'multiple');
    }
    rangeBtn.addEventListener('click', () => setMode('range'));
    multiBtn.addEventListener('click', () => setMode('multiple'));

    document.getElementById('uevAddDateBtn').addEventListener('click', addSpecificDateRow);

    document.getElementById('uevSpecificDatesList').addEventListener('click', (ev) => {
        const btn = ev.target.closest('.uev-remove-date');
        if (!btn) return;
        btn.closest('.uev-date-row').remove();
    });
}

function openModal(id) {
    editingId = id || null;
    const existing = id ? rows.find(r => r.id === id) : null;
    document.getElementById('uevModalBody').innerHTML = modalFieldsHtml(existing);
    document.getElementById('uevSaveBtn').addEventListener('click', saveEvent);
    wireDateModeToggle();
    new bootstrap.Modal(document.getElementById('uevModal')).show();
}

// Inclusive list of 'YYYY-MM-DD' strings from start to end (local dates, no DST drift).
function datesInRange(startStr, endStr) {
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const cursor = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const out = [];
    while (cursor <= end) {
        out.push(ymdLocal(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return out;
}

async function saveEvent() {
    const title = document.getElementById('uevTitle').value.trim();
    const description = document.getElementById('uevDescription').value.trim();
    const isPublished = true; // always visible to students once saved
    const msg = document.getElementById('uevModalMsg');
    const saveBtn = document.getElementById('uevSaveBtn');
    const multiBtn = document.getElementById('uevModeMultiBtn');
    const dateMode = !editingId ? (multiBtn && multiBtn.classList.contains('active') ? 'specific' : 'range') : 'single';

    msg.hidden = true;

    if (!title) {
        msg.textContent = 'Event title is required.';
        msg.hidden = false;
        return;
    }

    let dates = [];
    if (dateMode === 'range') {
        const rangeStart = document.getElementById('uevRangeStart').value;
        const rangeEnd = document.getElementById('uevRangeEnd').value;
        if (!rangeStart || !rangeEnd) {
            msg.textContent = 'Both a "From" and "To" date are required for a date range.';
            msg.hidden = false;
            return;
        }
        if (rangeEnd < rangeStart) {
            msg.textContent = '"To" date cannot be before "From" date.';
            msg.hidden = false;
            return;
        }
        dates = datesInRange(rangeStart, rangeEnd);
        if (dates.length > MAX_RANGE_DAYS) {
            msg.textContent = `That range spans ${dates.length} days — please keep it to ${MAX_RANGE_DAYS} days or fewer.`;
            msg.hidden = false;
            return;
        }
    } else if (dateMode === 'specific') {
        const seen = new Set();
        dates = Array.from(document.querySelectorAll('.uev-specific-date'))
            .map(input => input.value)
            .filter(v => v && !seen.has(v) && seen.add(v));
        if (!dates.length) {
            msg.textContent = 'Add at least one date.';
            msg.hidden = false;
            return;
        }
        dates.sort();
    } else {
        const eventDate = document.getElementById('uevDate').value;
        if (!eventDate) {
            msg.textContent = 'Event date is required.';
            msg.hidden = false;
            return;
        }
        dates = [eventDate];
    }

    saveBtn.disabled = true;

    if (editingId) {
        const result = await AdminService.updateUniversityEvent({ id: editingId, title, description, eventDate: dates[0], isPublished });
        saveBtn.disabled = false;
        if (!result.ok) {
            msg.textContent = result.message;
            msg.hidden = false;
            return;
        }
        bootstrap.Modal.getInstance(document.getElementById('uevModal')).hide();
        Toast.show('University event updated', 'accent', 'bi-check-circle');
        loadRows();
        return;
    }

    // Create: one row per date (a no-op loop of 1 for a single date).
    let failures = 0;
    for (const eventDate of dates) {
        const result = await AdminService.createUniversityEvent({ title, description, eventDate, isPublished });
        if (!result.ok) failures++;
    }
    saveBtn.disabled = false;

    if (failures === dates.length) {
        msg.textContent = dates.length > 1 ? 'Could not create any of the events in that range.' : 'Could not create that event.';
        msg.hidden = false;
        return;
    }

    bootstrap.Modal.getInstance(document.getElementById('uevModal')).hide();
    if (dates.length > 1) {
        const created = dates.length - failures;
        Toast.show(failures ? `Created ${created} of ${dates.length} days (${failures} failed).` : `Created ${created} events, one per day.`,
            failures ? 'medium' : 'accent', failures ? 'bi-exclamation-triangle' : 'bi-check-circle');
    } else {
        Toast.show('University event created', 'accent', 'bi-check-circle');
    }
    loadRows();
}

async function deleteEvent(id, title, triggerBtn) {
    if (triggerBtn) triggerBtn.disabled = true;
    const result = await AdminService.deleteUniversityEvent(id);
    if (!result.ok) {
        if (triggerBtn) triggerBtn.disabled = false;
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle');
        return;
    }
    Toast.show(`"${title}" was deleted.`, 'accent', 'bi-check-circle');
    loadRows();
}

function onAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const ev = rows.find(r => r.id === id);

    if (act === 'view') {
        if (ev) openUnivEventDetailsModal(ev, { showAdminHint: false });
        return;
    }
    if (act === 'edit') {
        openModal(id);
        return;
    }
    if (act === 'delete') {
        const title = ev ? ev.title : 'this event';
        confirmAction({
            title: `Delete "${title}"?`,
            message: 'This removes the event for every student immediately. This cannot be undone.',
            confirmLabel: 'Delete event',
            danger: true,
            icon: 'bi-trash3',
            onConfirm() { deleteEvent(id, title, btn); },
        });
    }
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-university-events', admin);
    mountAdminTopbar(admin);

    document.getElementById('uevToday').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('uevMonthLabel').textContent = monthLabel();
    document.getElementById('uevAddBtn').addEventListener('click', () => openModal(null));
    document.getElementById('uevBody').addEventListener('click', onAction);
    document.getElementById('uevPrevMonth').addEventListener('click', () => goToMonth(-1));
    document.getElementById('uevNextMonth').addEventListener('click', () => goToMonth(1));

    loadRows();
}

init();

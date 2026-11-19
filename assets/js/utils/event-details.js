// Shared "University Event" details renderer (classic script — exposes
// globals used by all modules, same pattern as dates.js / dom.js).
//
// Both the student Calendar (read-only click-through) and the admin
// University Events page (the "View" action) show the exact same event
// information, so the markup lives here once and each page's static
// `#univEventModal` / `#univEventModalBody` markup (see pages/app/calendar.html
// and pages/admin/university-events.html) is filled by the same function
// rather than duplicating the body HTML per page.

// Status is computed from date/time, never stored — "Upcoming" / "Ongoing" /
// "Past" / "Draft". `ev.is_published` is absent on the student fetch (it only
// ever fetches published rows), so only an explicit `false` counts as Draft.
function univEventStatus(ev) {
    if (ev.is_published === false) return { key: 'draft', label: 'Draft' };
    const today = ymdLocal(new Date());
    if (ev.event_date > today) return { key: 'upcoming', label: 'Upcoming' };
    if (ev.event_date < today) return { key: 'past', label: 'Past' };
    if (ev.start_time || ev.end_time) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const startMins = ev.start_time ? toMins(ev.start_time) : -Infinity;
        const endMins = ev.end_time ? toMins(ev.end_time) : Infinity;
        if (nowMins < startMins) return { key: 'upcoming', label: 'Upcoming' };
        if (nowMins > endMins) return { key: 'past', label: 'Past' };
    }
    return { key: 'ongoing', label: 'Ongoing' };
}

function univEventDateLabel(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function univEventTimeLabel(ev) {
    if (!ev.start_time) return 'All day';
    return fmtTime(ev.start_time) + (ev.end_time ? ' – ' + fmtTime(ev.end_time) : '');
}

// One "Label : value" row. All rows share a single parent grid (see
// .uev-detail-dl in modals.css) with `display: contents`, so the grid's
// label/colon columns size to the longest label across every row and the
// colons all land in the same column — i.e. line up — no matter how short
// or long each label text is.
function univEventDetailRow(label, valueHtml) {
    return `
    <div class="uev-detail-row">
      <span class="uev-detail-label">${label}</span>
      <span class="uev-detail-colon">:</span>
      <span class="uev-detail-value">${valueHtml}</span>
    </div>`;
}

// Builds the modal body markup (everything below the header — the header
// is now just the generic "Event" label set in the page's own static
// markup, not the event's title, since Title is one of the rows below).
// `showAdminHint` is the "only admins can edit" footnote — shown to
// students, not to admins who are already looking at the row's own
// Edit/Delete buttons.
function renderUnivEventDetailsBody(ev, { showAdminHint = false } = {}) {
    const status = univEventStatus(ev);
    const details = ev.description
        ? escHtml(ev.description).replace(/\n/g, '<br>')
        : (ev.location ? escHtml(ev.location) : '&mdash;');
    const dateValue = `${univEventDateLabel(ev.event_date)} <span class="uev-detail-sep">|</span> ${univEventTimeLabel(ev)}`;
    const statusValue = `<span class="status-badge event-status-${status.key}">${status.label}</span>`;
    return `
    <div class="uev-detail-dl">
      ${univEventDetailRow('Title', escHtml(ev.title))}
      ${univEventDetailRow('Details', details)}
      ${univEventDetailRow('Date', dateValue)}
      ${univEventDetailRow('Status', statusValue)}
    </div>
    ${showAdminHint ? `<div class="text-faint mt-3" style="font-size:.75rem">Published by your administrators. Only admins can edit or remove this event.</div>` : ''}`;
}

// Fills the shared modal and shows it. Both pages carry identical static
// `#univEventModal` header (`#univEventModalTitle`, now just the fixed
// "Event" label already in the markup) and `#univEventModalBody` markup
// for this to target.
function openUnivEventDetailsModal(ev, opts) {
    const body = document.getElementById('univEventModalBody');
    const modalEl = document.getElementById('univEventModal');
    if (!body || !modalEl) return;
    body.innerHTML = renderUnivEventDetailsBody(ev, opts);
    new bootstrap.Modal(modalEl).show();
}

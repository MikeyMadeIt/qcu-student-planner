/* ============================================================
   ATTENDANCE.JS — Enhanced v4
   Features: Heatmap, Bulk Attendance, Consecutive Absence
   Warnings, Export CSV/PDF, Skeleton states, Mode toggle,
   Absence limit progress bars, Mobile-first layout.
   ============================================================ */

const DEFAULT_ABSENCE_LIMIT = 3;
/* ---- Helpers ---- */

function escapeAttHtml(s) {
    // Escape quotes too, so values are safe inside HTML attributes (data-*, aria-label, value)
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function createAttendanceStatusSelect(select) {
    if (!select || select.dataset.attStatusSelectBound)
        return;
    select.dataset.attStatusSelectBound = 'true';
    select.dataset.native = 'true';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const wrapper = document.createElement('div');
    wrapper.className = 'att-status-select';
    const trigger = document.createElement('button');
    const menu = document.createElement('div');
    const menuId = `${select.id || 'att-status'}-options-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let isOpen = false;
    let activeIndex = Math.max(0, select.selectedIndex);

    trigger.type = 'button';
    trigger.className = 'att-status-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Choose status');
    menu.id = menuId;
    menu.className = 'att-status-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', `${select.getAttribute('aria-label') || 'Status'} options`);
    menu.hidden = true;

    const renderOptions = () => {
        activeIndex = Math.max(0, select.selectedIndex);
        menu.innerHTML = [...select.options].map((option, index) => {
            const selected = option.value === select.value;
            const disabled = option.disabled || (!option.value && !!select.value);
            return `<button type="button" class="att-status-select-option${selected ? ' is-selected' : ''}${!option.value ? ' is-placeholder' : ''}" role="option" aria-selected="${selected}" ${disabled ? 'disabled' : ''} data-index="${index}" data-value="${escapeAttHtml(option.value)}">${escapeAttHtml(option.textContent)}</button>`;
        }).join('');
        const selectedOption = select.options[select.selectedIndex];
        trigger.textContent = selectedOption ? selectedOption.textContent : '';
        trigger.setAttribute('aria-valuetext', trigger.textContent);
    };

    const placeMenu = () => {
        if (!isOpen)
            return;
        const rect = trigger.getBoundingClientRect();
        const margin = 8;
        const width = Math.min(Math.max(rect.width, 140), window.innerWidth - margin * 2);
        menu.style.width = `${width}px`;
        menu.style.minWidth = `${Math.min(140, width)}px`;
        const height = menu.offsetHeight;
        const below = window.innerHeight - rect.bottom;
        const top = below >= height + 6 || below >= rect.top
            ? rect.bottom + 4
            : Math.max(margin, rect.top - height - 4);
        menu.style.left = `${Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin)}px`;
        menu.style.top = `${top}px`;
    };
    const close = ({ returnFocus = false } = {}) => {
        if (!isOpen)
            return;
        isOpen = false;
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        menu.remove();
        document.removeEventListener('pointerdown', handleOutsidePointerDown);
        window.removeEventListener('resize', placeMenu);
        window.removeEventListener('scroll', placeMenu, true);
        if (returnFocus)
            trigger.focus();
    };
    select._attStatusSelectClose = close;
    const focusOption = index => {
        const options = [...menu.querySelectorAll('[role="option"]:not(:disabled)')];
        if (!options.length)
            return;
        const option = options[Math.max(0, Math.min(index, options.length - 1))];
        activeIndex = Number(option.dataset.index);
        options.forEach(item => item.tabIndex = item === option ? 0 : -1);
        option.focus({ preventScroll: true });
    };
    const open = (direction = 1) => {
        if (isOpen)
            return;
        renderOptions();
        document.body.appendChild(menu);
        isOpen = true;
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        placeMenu();
        document.addEventListener('pointerdown', handleOutsidePointerDown);
        window.addEventListener('resize', placeMenu);
        window.addEventListener('scroll', placeMenu, true);
        const enabledOptions = [...menu.querySelectorAll('[role="option"]:not(:disabled)')];
        let selectedIndex = enabledOptions.findIndex(option => option.dataset.value === select.value);
        if (selectedIndex < 0)
            selectedIndex = direction < 0 ? enabledOptions.length - 1 : 0;
        focusOption(selectedIndex);
    };
    const handleOutsidePointerDown = event => {
        if (!wrapper.contains(event.target) && !menu.contains(event.target))
            close();
    };
    const choose = option => {
        if (!option || option.disabled)
            return;
        select.value = option.dataset.value;
        renderOptions();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close({ returnFocus: true });
    };

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger);
    document.body.appendChild(menu);
    trigger.addEventListener('click', () => isOpen ? close() : open());
    trigger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            open(1);
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            open(-1);
        }
        else if (event.key === 'Escape') {
            close({ returnFocus: true });
        }
    });
    menu.addEventListener('click', event => {
        const option = event.target.closest('[role="option"]');
        if (option)
            choose(option);
    });
    menu.addEventListener('keydown', event => {
        const options = [...menu.querySelectorAll('[role="option"]:not(:disabled)')];
        const index = options.indexOf(event.target);
        if (event.key === 'Escape') {
            event.preventDefault();
            close({ returnFocus: true });
        }
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusOption(index + (event.key === 'ArrowDown' ? 1 : -1));
        }
        else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose(event.target);
        }
    });
    select.addEventListener('change', renderOptions);
    renderOptions();
}

function formatDisplayDate(ymd) {
    if (!ymd)
        return '';
    const [y, m, d] = ymd.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[+m - 1]} ${+d}, ${y}`;
}

function formatShortDate(ymd) {
    if (!ymd) return '';
    // MIN-06: Use slice(5,10) so ISO timestamps like '2026-11-04T10:30:00' don't produce
    // garbled output ('11/04T10:30:00') the way the old two-step regex chain did.
    return ymd.slice(5, 10).replace('-', '/');
}

/* ---- Absence limit storage ---- */

function getAbsenceLimitForSubject(subjectId) {
    const settings = DB.getSettings();
    if (settings.absenceLimits && settings.absenceLimits[subjectId] != null) {
        return +settings.absenceLimits[subjectId];
    }
    return settings.defaultAbsenceLimit != null ? +settings.defaultAbsenceLimit : DEFAULT_ABSENCE_LIMIT;
}

function setAbsenceLimitForSubject(subjectId, limit) {
    const settings = DB.getSettings();
    if (!settings.absenceLimits)
        settings.absenceLimits = {};
    settings.absenceLimits[subjectId] = limit;
    DB.saveSettings(settings);
}

function setDefaultAbsenceLimit(limit) {
    const settings = DB.getSettings();
    settings.defaultAbsenceLimit = limit;
    DB.saveSettings(settings);
}

/* ---- Init ---- */

function setupAttendanceResponsiveAbsenceLimits() {
    const card = document.getElementById('absenceLimitsCard');
    const mobileSlot = document.getElementById('absenceLimitsMobileSlot');
    const desktopColumn = document.querySelector('.att-overall-rate-column');
    if (!card || !mobileSlot || !desktopColumn)
        return;

    const mobileLayout = window.matchMedia('(max-width: 767.98px)');
    const moveCard = () => {
        (mobileLayout.matches ? mobileSlot : desktopColumn).appendChild(card);
    };
    moveCard();
    mobileLayout.addEventListener('change', moveCard);
}

function initAttendance() {
    setupAttendanceResponsiveAbsenceLimits();
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const attDate = document.getElementById('attDate');
    if (attDate) {
        updateAttendanceDateBounds();
        attDate.value = todayKey();
        if (!attDate.dataset.attendanceDateBound) {
            attDate.dataset.attendanceDateBound = 'true';
            attDate.addEventListener('change', renderAttendanceSubjectList);
        }
    }
    setupAttendanceBulkControl();
    setupAttendanceSubjectList();
    setupAttendanceSemesterRefresh();
    setupAttendanceEditModal();
    renderAttendanceSubjectList();
    // Populate heatmap subject filter
    const heatmapFilter = document.getElementById('heatmapSubjectFilter');
    if (heatmapFilter) {
        const prevFilter = heatmapFilter.value;
        heatmapFilter.innerHTML = `<option value="">All Subjects</option>` +
            subs.map(s => `<option value="${s.id}">${escapeAttHtml(s.code)}</option>`).join('');
        if (subs.some(s => s.id === prevFilter))
            heatmapFilter.value = prevFilter;
        renderHeatmapFilterMenu(subs);
    }
    renderAttendanceAll();
}

/* ---- Heatmap subject filter (dropdown) ---- */

function renderHeatmapFilterMenu(subs) {
    const menu = document.getElementById('heatmapFilterMenu');
    const sel = document.getElementById('heatmapSubjectFilter');
    const label = document.getElementById('heatmapFilterLabel');
    if (!menu || !sel)
        return;
    const current = sel.value;
    const items = [{ id: '', label: 'All Subjects' }].concat(subs.map(s => ({ id: s.id, label: s.code, color: s.color })));
    menu.innerHTML = items.map(it => `<button type="button" class="dropdown-item att-heatmap-option ${it.id === current ? 'active' : ''}" role="radio" aria-checked="${it.id === current ? 'true' : 'false'}" data-id="${escapeAttHtml(it.id)}">
      ${it.color ? `<span class="att-heatmap-option-dot" style="background:${it.color}"></span>` : '<i class="bi bi-grid-3x3-gap att-heatmap-option-icon" aria-hidden="true"></i>'}
      <span class="att-heatmap-option-text">${escapeAttHtml(it.label)}</span>
      <i class="bi bi-check2 att-heatmap-option-check" aria-hidden="true"></i>
    </button>`).join('');
    menu.querySelectorAll('.att-heatmap-option').forEach(btn => {
        btn.addEventListener('click', () => chooseHeatmapSubject(btn.dataset.id));
    });
    if (label) {
        const cur = items.find(it => it.id === current);
        label.textContent = current && cur ? cur.label : 'By Subject';
    }
}

function chooseHeatmapSubject(id) {
    const sel = document.getElementById('heatmapSubjectFilter');
    if (!sel)
        return;
    sel.value = id;
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    renderHeatmapFilterMenu(subs);
    renderHeatmap();
}

/* ---- Log Attendance ---- */

function logAttendance() {
    const date = document.getElementById('attDate').value;
    const notes = (document.getElementById('attNotes')?.value || '').trim();
    const notesInput = document.getElementById('attNotes');
    const notesChanged = notesInput?.dataset.attendanceNotesChanged === 'true';
    const root = document.getElementById('attSubjectList');
    const selected = root ? [...root.querySelectorAll('.att-subject-row')].filter(row => row.querySelector('.att-subject-check')?.checked).map(row => ({
        subjectId: row.dataset.subjectId,
        status: row.querySelector('.att-subject-status').value,
        online: row.querySelector('.att-subject-online-check').checked
    })) : [];
    if (!date || !selected.length) {
        Toast.show('Select a date and at least one subject', 'high', 'bi-exclamation-triangle');
        return;
    }
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance();
    const subs = DB.getSubjects();
    const changes = selected.map(item => {
        const existing = records.find(r => r.subjectId === item.subjectId && r.date === date);
        return {
            ...item,
            existing,
            notes: existing && !notesChanged ? (existing.notes || '') : notes
        };
    });
    const replacements = changes.filter(item => item.existing && (
        item.existing.status !== item.status ||
        !!item.existing.online !== item.online ||
        (item.existing.notes || '') !== item.notes
    ));
    const additions = changes.filter(item => !item.existing);
    if (!replacements.length && !additions.length) {
        Toast.show('Attendance is already up to date');
        return;
    }
    const saveSelected = () => {
        const latestRecords = DB.getAttendance();
        for (const item of changes) {
            const existing = latestRecords.find(r => r.subjectId === item.subjectId && r.date === date);
            if (existing) {
                existing.status = item.status;
                existing.online = item.online;
                existing.notes = item.notes;
            }
            else {
                latestRecords.push({
                    id: DB.uid(),
                    subjectId: item.subjectId,
                    date,
                    status: item.status,
                    online: item.online,
                    notes: item.notes,
                    semesterId: semId
                });
            }
        }
        DB.saveAttendance(latestRecords);
        if (notesInput)
            notesInput.dataset.attendanceNotesChanged = 'false';
        Toast.show(`Attendance logged for ${selected.length} subject${selected.length === 1 ? '' : 's'}`);
        renderAttendanceAll();
    };
    if (replacements.length) {
        const names = replacements.map(item => {
            const subject = subs.find(s => s.id === item.subjectId);
            return subject ? subject.code : item.subjectId;
        });
        confirmAction({
            title: replacements.length === 1 ? 'Replace attendance record?' : 'Replace attendance records?',
            message: `A record already exists for ${names.join(', ')} on ${formatDisplayDate(date)}. Replace ${replacements.length === 1 ? 'it' : 'them'}?`,
            confirmLabel: 'Replace',
            icon: 'bi-arrow-repeat',
            onConfirm: saveSelected
        });
    }
    else {
        saveSelected();
    }
}

const ATTENDANCE_STATUSES = [
    { value: 'Present', label: 'Present' },
    { value: 'Late', label: 'Late' },
    { value: 'Excused', label: 'Excused' },
    { value: 'Absent', label: 'Absent' },
    { value: 'No Classes', label: 'No Class' }
];

function getAttendanceSubjectsForDate(date) {
    if (!date)
        return [];
    const dateObj = new Date(`${date}T00:00:00`);
    if (isNaN(dateObj.getTime()))
        return [];
    const dow = DAY_NAMES[dateObj.getDay()].slice(0, 3).toLowerCase();
    const semId = DB.getActiveSemesterId();
    return DB.getSubjects()
        .filter(s => s.semesterId === semId && !s.archived && Array.isArray(s.days) &&
            s.days.some(day => String(day).slice(0, 3).toLowerCase() === dow))
        .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
}

function isAttendanceDateBeforeSemesterStart(date) {
    const semester = DB.getActiveSemester();
    if (!date || !semester || !semester.startDate)
        return false;
    const dateObj = new Date(`${date}T00:00:00`);
    const startDate = new Date(`${semester.startDate}T00:00:00`);
    if (isNaN(dateObj.getTime()) || isNaN(startDate.getTime()))
        return false;
    return ymdLocal(dateObj) < ymdLocal(startDate);
}

function updateAttendanceDateBounds() {
    const dateInput = document.getElementById('attDate');
    if (!dateInput)
        return;
    const semester = DB.getActiveSemester();
    dateInput.min = semester?.startDate || '';
    dateInput.max = semester?.endDate || '';
}

function setupAttendanceSemesterRefresh() {
    if (window._attendanceSemesterRefreshBound)
        return;
    window._attendanceSemesterRefreshBound = true;
    window.addEventListener('storage', event => {
        if (event.key === DB_KEYS.semesters || event.key === DB_KEYS.activeSemesterId) {
            updateAttendanceDateBounds();
            renderAttendanceSubjectList();
        }
    });
    window.addEventListener('planner:cloud-synced', () => {
        updateAttendanceDateBounds();
        renderAttendanceSubjectList();
    });
}

function setupAttendanceSubjectList() {
    const root = document.getElementById('attSubjectList');
    if (!root || root.dataset.attendanceListBound)
        return;
    root.dataset.attendanceListBound = 'true';
    const notesInput = document.getElementById('attNotes');
    if (notesInput && !notesInput.dataset.attendanceNotesBound) {
        notesInput.dataset.attendanceNotesBound = 'true';
        notesInput.dataset.attendanceNotesChanged = 'false';
        notesInput.addEventListener('input', () => {
            notesInput.dataset.attendanceNotesChanged = 'true';
        });
    }
    root.addEventListener('change', event => {
        updateAttendanceLogButton();
    });
    root.addEventListener('click', event => {
        const button = event.target.closest('.att-subject-mode-toggle');
        if (!button)
            return;
        const checkbox = button.querySelector('.att-subject-online-check');
        const label = button.querySelector('.att-subject-mode-label');
        if (!checkbox || !label)
            return;
        checkbox.checked = !checkbox.checked;
        button.classList.toggle('is-online', checkbox.checked);
        button.setAttribute('aria-pressed', checkbox.checked ? 'true' : 'false');
        label.textContent = checkbox.checked ? 'Online' : 'Offline';
    });
}

function setupAttendanceBulkControl() {
    const statusSelect = document.getElementById('attBulkStatus');
    const applyButton = document.getElementById('attBulkApply');
    if (!statusSelect || !applyButton || applyButton.dataset.attendanceBulkBound)
        return;
    createAttendanceStatusSelect(statusSelect);
    applyButton.dataset.attendanceBulkBound = 'true';
    statusSelect.addEventListener('change', updateAttendanceBulkControl);
    updateAttendanceBulkControl();
}

function updateAttendanceBulkControl() {
    const statusSelect = document.getElementById('attBulkStatus');
    const applyButton = document.getElementById('attBulkApply');
    const root = document.getElementById('attSubjectList');
    if (!statusSelect || !applyButton || !root)
        return;
    applyButton.disabled = !statusSelect.value || !root.querySelector('.att-subject-row');
}

function applyBulkAttendanceStatus() {
    const date = document.getElementById('attDate')?.value || '';
    const status = document.getElementById('attBulkStatus')?.value || '';
    const root = document.getElementById('attSubjectList');
    if (!date || !ATTENDANCE_STATUSES.some(option => option.value === status) || !root)
        return;
    const subjects = [...root.querySelectorAll('.att-subject-row')].map(row => ({
        subjectId: row.dataset.subjectId
    }));
    if (!subjects.length)
        return;
    const records = DB.getAttendance();
    const existing = subjects.map(subject => ({
        ...subject,
        record: records.find(record => record.subjectId === subject.subjectId && record.date === date)
    })).filter(subject => subject.record);
    const overwriteCount = existing.filter(subject => subject.record.status !== status).length;
    const newCount = subjects.length - existing.length;
    const message = `Set ${subjects.length} scheduled subject${subjects.length === 1 ? '' : 's'} on ${formatDisplayDate(date)} to ${status === 'No Classes' ? 'No Class' : status}? ${overwriteCount} existing record${overwriteCount === 1 ? '' : 's'} will have ${overwriteCount === 1 ? 'its' : 'their'} status overwritten; ${newCount} new record${newCount === 1 ? '' : 's'} will be created.`;
    confirmAction({
        title: 'Apply bulk attendance?',
        message,
        confirmLabel: 'Apply',
        icon: 'bi-check2-all',
        onConfirm() {
            const latestRecords = DB.getAttendance();
            for (const subject of subjects) {
                const record = latestRecords.find(item => item.subjectId === subject.subjectId && item.date === date);
                if (record) {
                    record.status = status;
                }
                else {
                    latestRecords.push({
                        id: DB.uid(),
                        subjectId: subject.subjectId,
                        date,
                        status,
                        online: false,
                        notes: (document.getElementById('attNotes')?.value || '').trim(),
                        semesterId: DB.getActiveSemesterId()
                    });
                }
            }
            DB.saveAttendance(latestRecords);
            const bulkStatusSelect = document.getElementById('attBulkStatus');
            if (bulkStatusSelect) {
                bulkStatusSelect.value = '';
                bulkStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            renderAttendanceSubjectList();
            updateAttendanceBulkControl();
            Toast.show(`Set ${subjects.length} subject${subjects.length === 1 ? '' : 's'} to ${status === 'No Classes' ? 'No Class' : status}`);
            renderAttendanceAll();
        }
    });
}

function renderAttendanceSubjectList() {
    const root = document.getElementById('attSubjectList');
    if (!root)
        return;
    root.querySelectorAll('.att-subject-status').forEach(select => select._attStatusSelectClose?.());
    const date = document.getElementById('attDate')?.value || '';
    if (isAttendanceDateBeforeSemesterStart(date)) {
        const startDate = DB.getActiveSemester().startDate;
        root.innerHTML = `<div class="att-subject-empty text-faint">Semester hasn't started yet. Classes begin ${escapeAttHtml(formatDisplayDate(startDate))}.</div>`;
        updateAttendanceLogButton();
        updateAttendanceBulkControl();
        return;
    }
    const subjects = getAttendanceSubjectsForDate(date);
    if (!subjects.length) {
        root.innerHTML = '<div class="att-subject-empty text-faint"><i class="bi bi-calendar-x me-2" aria-hidden="true"></i>No classes scheduled on this day</div>';
        updateAttendanceLogButton();
        updateAttendanceBulkControl();
        return;
    }
    const records = DB.getAttendance();
    root.innerHTML = `
      <div class="att-subject-list-heading">
        <span class="att-form-label mb-0">Classes for ${DAY_NAMES[new Date(`${date}T00:00:00`).getDay()]}</span>
      </div>
      <div class="att-subject-rows">
        ${subjects.map(subject => {
            const existing = records.find(record => record.subjectId === subject.id && record.date === date);
            const currentStatus = existing && ATTENDANCE_STATUSES.some(status => status.value === existing.status)
                ? existing.status
                : 'Present';
            const description = subject.desc || subject.description || subject.name || '';
            const time = subject.start || subject.end
                ? `${fmtTime(subject.start)}${subject.start && subject.end ? '–' : ''}${fmtTime(subject.end)}`
                : 'Time not set';
            return `
              <div class="att-subject-row" data-subject-id="${escapeAttHtml(subject.id)}">
                <label class="att-subject-select">
                  <input class="form-check-input att-subject-check" type="checkbox" checked aria-label="Log ${escapeAttHtml(subject.code)}">
                  <span class="att-subject-info">
                    <span class="att-subject-code">${escapeAttHtml(subject.code)}</span>
                    <span class="att-subject-meta${description ? ' has-description' : ''}">
                      ${description ? `<span class="att-subject-description">${escapeAttHtml(description)}</span>` : ''}
                      <span class="att-subject-time"><i class="bi bi-clock me-1" aria-hidden="true"></i>${escapeAttHtml(time)}</span>
                    </span>
                  </span>
                </label>
                <div class="att-subject-controls">
                  <select class="form-select form-select-sm att-subject-status" data-native aria-label="${escapeAttHtml(subject.code)} attendance status">
                    ${ATTENDANCE_STATUSES.map(status => `<option value="${escapeAttHtml(status.value)}" ${currentStatus === status.value ? 'selected' : ''}>${status.label}</option>`).join('')}
                  </select>
                  <button type="button" class="att-mode-toggle att-subject-mode-toggle ${existing?.online ? 'is-online' : ''}" aria-pressed="${existing?.online ? 'true' : 'false'}" aria-label="${escapeAttHtml(subject.code)} online mode toggle">
                    <span class="att-mode-track"><span class="att-mode-thumb"></span></span>
                    <span class="att-mode-label att-subject-mode-label">${existing?.online ? 'Online' : 'Offline'}</span>
                    <input type="checkbox" class="att-hidden-check att-subject-online-check" ${existing?.online ? 'checked' : ''} tabindex="-1" aria-hidden="true">
                  </button>
                </div>
              </div>`;
        }).join('')}
      </div>`;
    root.querySelectorAll('.att-subject-status').forEach(createAttendanceStatusSelect);
    updateAttendanceLogButton();
    updateAttendanceBulkControl();
}

function updateAttendanceLogButton() {
    const root = document.getElementById('attSubjectList');
    const button = document.getElementById('attLogButton');
    if (!root || !button)
        return;
    button.disabled = !root.querySelector('.att-subject-row .att-subject-check:checked');
}

/* ---- Render all ---- */

function renderAttendanceAll() {
    renderOverallRate();
    renderStatistics();
    renderConsecutiveAbsenceAlerts();
    renderHeatmap();
    renderAbsenceWarnings();
    renderSubjectBreakdown();
    renderLog();
}

/* ---- Overall Rate ---- */

function renderOverallRate() {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const relevant = records.filter(r => r.status !== 'No Classes');
    const present = relevant.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
    const rate = relevant.length ? Math.round(present / relevant.length * 100) : null;
    document.getElementById('aRate').textContent = rate === null ? '--%' : rate + '%';
    const bar = document.getElementById('aRateBar');
    if (bar) {
        bar.style.width = (rate || 0) + '%';
        bar.style.background = rate === null ? '' : rate >= 75 ? '#34d399' : rate >= 50 ? '#b45309' : '#fb7185';
    }
}

/* ---- Statistics ---- */

function renderStatistics() {
    const semId = DB.getActiveSemesterId();
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const wrap = document.getElementById('attendanceStats');
    if (!records.length) {
        wrap.innerHTML = `
      <div class="att-stat-card present"><div class="stat-label">Present</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>
      <div class="att-stat-card present-online"><div class="stat-label">Online</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>
      <div class="att-stat-card late"><div class="stat-label">Late</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>
      <div class="att-stat-card excused"><div class="stat-label">Excused</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>
      <div class="att-stat-card absent"><div class="stat-label">Absent</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>
      <div class="att-stat-card noclasses"><div class="stat-label">No Class</div><div class="stat-value att-skel-val">--</div><div class="stat-percent">—</div></div>`;
        return;
    }
    const presentCount = records.filter(r => r.status === 'Present').length;
    const presentOnline = records.filter(r => r.status === 'Present' && r.online).length;
    const lateCount = records.filter(r => r.status === 'Late').length;
    const excusedCount = records.filter(r => r.status === 'Excused').length;
    const absentCount = records.filter(r => r.status === 'Absent').length;
    const noClassCount = records.filter(r => r.status === 'No Classes').length;
    const total = records.filter(r => r.status !== 'No Classes').length;
    const pct = n => total > 0 ? `<div class="stat-percent">${Math.round(n / total * 100)}%</div>` : '<div class="stat-percent">—</div>';
    wrap.innerHTML = `
    <div class="att-stat-card present">
      <div class="stat-label">Present</div>
      <div class="stat-value">${presentCount}</div>
      ${pct(presentCount)}
    </div>
    <div class="att-stat-card present-online">
      <div class="stat-label">Online</div>
      <div class="stat-value">${presentOnline}</div>
      <div class="stat-percent">${presentCount > 0 ? Math.round(presentOnline / presentCount * 100) + '%' : '—'}</div>
    </div>
    <div class="att-stat-card late">
      <div class="stat-label">Late</div>
      <div class="stat-value">${lateCount}</div>
      ${pct(lateCount)}
    </div>
    <div class="att-stat-card excused">
      <div class="stat-label">Excused</div>
      <div class="stat-value">${excusedCount}</div>
      ${pct(excusedCount)}
    </div>
    <div class="att-stat-card absent">
      <div class="stat-label">Absent</div>
      <div class="stat-value">${absentCount}</div>
      ${pct(absentCount)}
    </div>
    <div class="att-stat-card noclasses">
      <div class="stat-label">No Class</div>
      <div class="stat-value">${noClassCount}</div>
      <div class="stat-percent">—</div>
    </div>`;
}

/* ---- Consecutive Absence Alerts ---- */

function renderConsecutiveAbsenceAlerts() {
    const wrap = document.getElementById('consecutiveAbsenceAlerts');
    if (!wrap)
        return;
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const warnings = [];
    for (const s of subs) {
        const streak = getCurrentConsecutiveAbsences(s.id, records);
        if (streak >= 3) {
            warnings.push({ s, streak });
        }
    }
    if (!warnings.length) {
        wrap.innerHTML = '';
        return;
    }
    wrap.innerHTML = `<div class="att-consec-alerts mb-3">` +
        warnings.map(({ s, streak }) => `
      <div class="att-consec-alert fade-in" role="alert">
        <div class="att-consec-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>
        <div class="att-consec-body">
          <div class="att-consec-title">Consecutive Absences</div>
          <div class="att-consec-msg">
            <span class="att-consec-dot" style="background:${s.color}"></span>
            <strong>${escapeAttHtml(s.code)}</strong> — ${streak} consecutive absence${streak !== 1 ? 's' : ''}.
            Review your attendance before reaching the limit.
          </div>
        </div>
      </div>`).join('') + `</div>`;
}

/* ---- Heatmap ---- */

let _hmResizeFrame = 0;

function renderHeatmap() {
    const semId = DB.getActiveSemesterId();
    const sem = DB.getActiveSemester();
    const wrap = document.getElementById('attendanceHeatmap');
    const legend = document.getElementById('heatmapLegend');
    if (!wrap)
        return;
    if (!window._attendanceHeatmapResizeBound) {
        window._attendanceHeatmapResizeBound = true;
        window.addEventListener('resize', () => {
            cancelAnimationFrame(_hmResizeFrame);
            _hmResizeFrame = requestAnimationFrame(renderHeatmap);
        }, { passive: true });
    }
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const filterSubId = document.getElementById('heatmapSubjectFilter')?.value || '';
    const filteredRecords = filterSubId ? records.filter(r => r.subjectId === filterSubId) : records;
    const toLocalYMD = d => d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    const parseDate = ymd => {
        if (!ymd)
            return null;
        const date = new Date(`${ymd}T00:00:00`);
        return isNaN(date.getTime()) ? null : date;
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYmd = toLocalYMD(today);
    let startDate = parseDate(sem?.startDate);
    let endDate = parseDate(sem?.endDate);
    const hasSemesterRange = !!(sem && startDate && endDate && startDate <= endDate);
    if (!hasSemesterRange) {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7) - 19 * 7);
        endDate = new Date(today);
    }
    const startYmd = toLocalYMD(startDate);
    const endYmd = toLocalYMD(hasSemesterRange ? endDate : today);
    const subs = DB.getSubjects();
    const subjectById = new Map(subs.map(subject => [subject.id, subject]));
    const dateMap = {};
    for (const r of filteredRecords) {
        if (!dateMap[r.date]) {
            dateMap[r.date] = { statuses: [], subjects: [], notes: [], entries: [] };
        }
        const sub = subjectById.get(r.subjectId);
        dateMap[r.date].statuses.push(r.status);
        dateMap[r.date].subjects.push(sub ? sub.code : 'Unknown');
        dateMap[r.date].notes.push(r.notes || '');
        dateMap[r.date].online = dateMap[r.date].online || r.online;
        dateMap[r.date].entries.push({
            subject: sub ? sub.code : 'Unknown',
            status: r.status
        });
    }
    function primaryStatus(statuses) {
        if (statuses.includes('Absent'))
            return 'Absent';
        if (statuses.includes('Late'))
            return 'Late';
        if (statuses.includes('Excused'))
            return 'Excused';
        if (statuses.includes('No Classes'))
            return 'No Classes';
        if (statuses.includes('Present'))
            return 'Present';
        return 'Present';
    }
    const startWeek = new Date(startDate);
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
    const endWeek = new Date(hasSemesterRange ? endDate : today);
    endWeek.setDate(endWeek.getDate() - ((endWeek.getDay() + 6) % 7));
    const rangeWeeks = [];
    const weekStart = new Date(startWeek);
    while (weekStart <= endWeek) {
        rangeWeeks.push(new Date(weekStart));
        weekStart.setDate(weekStart.getDate() + 7);
    }
    const availableWidth = Math.max(0, wrap.clientWidth - 18);
    const weeksToFill = Math.ceil((availableWidth + 4) / 32);
    const displayWeekCount = Math.max(rangeWeeks.length, weeksToFill);
    const hmGap = 4;
    const hmCell = Math.max(12, Math.min(28, Math.floor((availableWidth - (displayWeekCount - 1) * hmGap) / displayWeekCount)));
    const gridWidth = displayWeekCount * hmCell + Math.max(0, displayWeekCount - 1) * hmGap;
    const weeks = [];
    for (let weekIndex = 0; weekIndex < displayWeekCount; weekIndex++) {
        const monday = new Date(rangeWeeks[weekIndex] || rangeWeeks[rangeWeeks.length - 1]);
        if (weekIndex >= rangeWeeks.length)
            monday.setDate(monday.getDate() + (weekIndex - rangeWeeks.length + 1) * 7);
        const week = [];
        let monthLabel = '';
        for (let i = 0; i < 7; i++) {
            const cur = new Date(monday);
            cur.setDate(cur.getDate() + i);
            const ymd = toLocalYMD(cur);
            const inRange = !hasSemesterRange || ymd >= startYmd && ymd <= endYmd;
            const data = dateMap[ymd];
            if (!monthLabel && cur.getDate() === 1) {
                monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(cur);
            }
            week.push({
                ymd,
                inRange,
                status: data ? primaryStatus(data.statuses) : null,
                statuses: data ? data.statuses : [],
                subjects: data ? data.subjects : [],
                entries: data ? data.entries : [],
                isToday: ymd === todayYmd,
                isFuture: ymd > todayYmd
            });
        }
        weeks.push({ days: week, monthLabel });
    }
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const gridStyle = `--hm-week-count:${displayWeekCount};--hm-cell:${hmCell}px;width:${gridWidth}px`;
    let html = `<div class="att-heatmap-grid-wrap" style="--hm-cell:${hmCell}px">
    <div class="att-heatmap-day-labels"><div class="att-heatmap-month-spacer" aria-hidden="true"></div>`;
    for (const l of dayLabels) {
        html += `<div class="att-heatmap-day-lbl">${l}</div>`;
    }
    html += `</div><div class="att-heatmap-week-viewport"><div class="att-heatmap-months" style="${gridStyle}" aria-hidden="true">`;
    for (const week of weeks) {
        html += `<div class="att-heatmap-month-label">${escapeAttHtml(week.monthLabel)}</div>`;
    }
    html += `</div><div class="att-heatmap-weeks" style="${gridStyle}" role="grid" aria-label="Attendance by day">`;
    const statusClasses = {
        'Present': 'att-hm-present',
        'Late': 'att-hm-late',
        'Excused': 'att-hm-excused',
        'Absent': 'att-hm-absent',
        'No Classes': 'att-hm-noclasses'
    };
    for (const week of weeks) {
        html += `<div class="att-heatmap-col" role="row">`;
        for (const cell of week.days) {
            let cls = 'att-hm-cell';
            const dimmed = !cell.inRange || cell.isFuture;
            if (cell.status)
                cls += ` ${statusClasses[cell.status] || 'att-hm-none'}`;
            else
                cls += ' att-hm-none att-hm-empty';
            let mixedStyle = '';
            if (cell.status) {
                // Several subjects with different statuses -> pie-style cell, one slice per status (sized by count)
                const order = ['Absent', 'Late', 'Excused', 'Present', 'No Classes'];
                const colors = { 'Absent': 'rgba(251,113,133,.8)', 'Late': 'rgba(180,83,9,.85)', 'Excused': 'rgba(96,165,250,.8)', 'Present': 'rgba(52,211,153,.75)', 'No Classes': 'rgba(139,92,246,.55)' };
                const counts = order.map(st => ({ st, n: cell.statuses.filter(x => x === st).length })).filter(x => x.n > 0);
                if (counts.length > 1) {
                    const total = counts.reduce((sum, x) => sum + x.n, 0);
                    let acc = 0;
                    const stops = counts.map(x => {
                        const from = acc / total * 100;
                        acc += x.n;
                        return `${colors[x.st]} ${from.toFixed(2)}% ${(acc / total * 100).toFixed(2)}%`;
                    });
                    mixedStyle = ` style="background:conic-gradient(${stops.join(',')})"`;
                    cls += ' att-hm-mixed';
                }
            }
            if (dimmed)
                cls += ' att-hm-dimmed';
            if (cell.isToday)
                cls += ' att-hm-today';
            const tooltipEntries = cell.entries.map(entry => `${entry.subject} · ${entry.status}`).join(', ');
            const ariaLabel = `${cell.ymd}: ${tooltipEntries || 'No records'}${dimmed ? ', unavailable' : ''}`;
            const handlers = dimmed ? '' : `tabindex="0"
        onmouseenter="if(!hmIsTouch())showHmTooltip(event,this)"
        onmouseleave="if(!hmIsTouch())hideHmTooltip()"
        onfocus="if(!hmIsTouch())showHmTooltip(event,this)"
        onblur="if(!hmIsTouch())hideHmTooltip()"
        onclick="showHmTooltipMobile(event,this)"`;
            html += `<div class="${cls}"${mixedStyle} role="gridcell" ${handlers}${dimmed ? ' tabindex="-1" aria-disabled="true"' : ''}
        aria-label="${escapeAttHtml(ariaLabel)}"
        data-hm-date="${cell.ymd}"
        data-hm-records="${escapeAttHtml(JSON.stringify(cell.entries))}"
      ></div>`;
        }
        html += `</div>`;
    }
    html += `</div></div>`;
    wrap.innerHTML = html;
    // Apply sizes inline so the layout is correct even if an older cached stylesheet is loaded
    const hmPx = hmCell + 'px';
    wrap.querySelectorAll('.att-hm-cell').forEach(el => { el.style.width = hmPx; el.style.height = hmPx; el.style.maxWidth = 'none'; el.style.aspectRatio = 'auto'; });
    wrap.querySelectorAll('.att-heatmap-day-lbl').forEach(el => { el.style.height = hmPx; el.style.aspectRatio = 'auto'; });
    wrap.querySelectorAll('.att-heatmap-day-labels').forEach(el => { el.style.gridTemplateRows = `16px repeat(7, ${hmPx})`; });
    wrap.querySelectorAll('.att-heatmap-col').forEach(el => { el.style.gridTemplateRows = `repeat(7, ${hmPx})`; });
    wrap.querySelectorAll('.att-heatmap-months, .att-heatmap-weeks').forEach(el => { el.style.gridTemplateColumns = `repeat(${displayWeekCount}, ${hmPx})`; });
    const currentMonday = new Date(today);
    currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
    const currentWeekYmd = toLocalYMD(currentMonday);
    let currentWeekIndex = weeks.findIndex(week => week.days[0].ymd === currentWeekYmd);
    if (currentWeekIndex < 0)
        currentWeekIndex = currentWeekYmd < weeks[0].days[0].ymd ? 0 : weeks.length - 1;
    const viewport = wrap.querySelector('.att-heatmap-week-viewport');
    const currentWeek = wrap.querySelectorAll('.att-heatmap-col')[currentWeekIndex];
    if (viewport && currentWeek)
        viewport.scrollLeft = Math.max(0, currentWeek.getBoundingClientRect().left - viewport.getBoundingClientRect().left);
    if (legend) {
        legend.innerHTML = `<div class="att-hm-legend-wrap"><div class="att-hm-legend-items">
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-present"></span>Present</span>
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-late"></span>Late</span>
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-excused"></span>Excused</span>
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-absent"></span>Absent</span>
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-noclasses"></span>No Class</span>
        <span class="att-hm-li"><span class="att-hm-li-dot att-hm-mixed-dot"></span>Mixed</span>
        <span class="att-hm-li"><span class="att-hm-cell att-hm-none att-hm-legend-cell"></span>No record</span>
        <span class="att-hm-li"><span class="att-hm-cell att-hm-none att-hm-today att-hm-legend-cell"></span>Today</span>
      </div></div>`;
    }
}

/* ---- Heatmap Tooltip ---- */
let _hmTooltipEl = null;
let _hmTooltipTimer = null;

function showHmTooltip(evt, cell) {
    hideHmTooltip();
    const date = cell.dataset.hmDate;
    if (!date || date === 'undefined')
        return;
    const entries = JSON.parse(cell.dataset.hmRecords || '[]');
    const dateLabel = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(new Date(`${date}T00:00:00`));
    const statusClasses = {
        'Present': 'att-hm-tt-present',
        'Late': 'att-hm-tt-late',
        'Excused': 'att-hm-tt-excused',
        'Absent': 'att-hm-tt-absent',
        'No Classes': 'att-hm-tt-noclasses'
    };
    const tip = document.createElement('div');
    tip.className = 'att-hm-tooltip';
    tip.innerHTML = `<div class="att-hm-tt-date">${escapeAttHtml(dateLabel)}</div>` +
        (entries.length ? entries.map(entry => `<div class="att-hm-tt-entry"><span class="att-hm-tt-subject">${escapeAttHtml(entry.subject)}</span><span class="att-hm-tt-status ${statusClasses[entry.status] || ''}">· ${escapeAttHtml(entry.status)}</span></div>`).join('') :
            '<div class="att-hm-tt-subject">No records</div>');
    document.body.appendChild(tip);
    _hmTooltipEl = tip;
    positionHmTooltip(evt, tip);
}

function positionHmTooltip(evt, tip) {
    // tooltip is position:fixed, so use viewport coordinates only (no scroll offsets)
    const target = evt.currentTarget && evt.currentTarget.getBoundingClientRect ? evt.currentTarget : evt.target;
    const rect = target.getBoundingClientRect();
    const tRect = tip.getBoundingClientRect();
    const margin = 8;
    let top = rect.top - tRect.height - margin;
    let left = rect.left + rect.width / 2 - tRect.width / 2;
    if (top < margin)
        top = rect.bottom + margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - tRect.width - margin));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.opacity = '1';
}

function hideHmTooltip() {
    if (_hmTooltipEl) {
        _hmTooltipEl.remove();
        _hmTooltipEl = null;
    }
}

function hmIsTouch() {
    return window.matchMedia('(hover: none)').matches;
}

function showHmTooltipMobile(evt, cell) {
    // On touch screens: tap a cell to show its tooltip, tap it again to hide.
    if (!hmIsTouch())
        return;
    const sameCell = _hmTooltipEl && _hmTooltipEl._hmCell === cell;
    clearTimeout(_hmTooltipTimer);
    hideHmTooltip();
    if (sameCell)
        return;
    evt.currentTarget = cell;
    showHmTooltip({ currentTarget: cell, target: cell }, cell);
    if (_hmTooltipEl)
        _hmTooltipEl._hmCell = cell;
    _hmTooltipTimer = setTimeout(hideHmTooltip, 4000);
}

// Tap anywhere else (or scroll) closes the tooltip on touch screens
if (!window._hmTooltipGlobalBound) {
    window._hmTooltipGlobalBound = true;
    document.addEventListener('click', e => {
        if (_hmTooltipEl && !e.target.closest('.att-hm-cell'))
            hideHmTooltip();
    });
    window.addEventListener('scroll', () => { if (hmIsTouch()) hideHmTooltip(); }, { passive: true });
}

/* ---- Absence Warnings (compact summary on page) ---- */

function renderAbsenceWarnings() {
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const wrap = document.getElementById('absenceWarnings');
    if (!wrap)
        return;
    if (!subs.length) {
        wrap.innerHTML = `<div class="text-faint" style="font-size:.8rem">No subjects yet.</div>`;
        return;
    }
    const rows = subs.map(s => {
        const absences = records.filter(r => r.subjectId === s.id && r.status === 'Absent').length;
        const limit = getAbsenceLimitForSubject(s.id);
        const reached = absences >= limit;
        const nearLimit = !reached && absences >= limit - 1 && limit > 1;
        const pct = limit > 0 ? Math.min(Math.round(absences / limit * 100), 100) : (absences > 0 ? 100 : 0);
        const barColor = reached ? '#fb7185' : nearLimit ? '#b45309' : '#34d399';
        const consec = getCurrentConsecutiveAbsences(s.id, records);
        return { s, absences, limit, reached, nearLimit, pct, barColor, consec };
    });
    const remaining = n => Math.max(n.limit - n.absences, 0);
    wrap.innerHTML = rows.map(row => `
    <div class="att-limit-row ${row.reached ? 'att-absence-reached' : row.nearLimit ? 'att-absence-near' : ''}">
      <div class="att-limit-dot" style="background:${row.s.color}"></div>
      <span class="att-limit-code">${escapeAttHtml(row.s.code)}</span>
      <div class="att-limit-bar-track"><div class="att-limit-bar-fill" style="width:${row.pct}%;background:${row.barColor}"></div></div>
      <span class="att-limit-count" style="color:${row.barColor}">${row.absences}&thinsp;/&thinsp;${row.limit}</span>
      <span class="att-limit-remain">${remaining(row) > 0 ? remaining(row) + ' left' : row.absences > row.limit ? 'exceeded' : 'at limit'}</span>
    </div>`).join('');
}

/* ---- Absence Limit Modal ---- */

function openAbsenceLimitModal() {
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const body = document.getElementById('absenceLimitModalBody');
    if (!subs.length) {
        body.innerHTML = `<div class="text-faint text-center py-4">No subjects for this semester.</div>`;
        new bootstrap.Modal(document.getElementById('absenceLimitModal')).show();
        return;
    }
    const rows = subs.map(s => {
        const absences = records.filter(r => r.subjectId === s.id && r.status === 'Absent').length;
        const limit = getAbsenceLimitForSubject(s.id);
        const remaining = Math.max(limit - absences, 0);
        const reached = absences >= limit;
        const nearLimit = !reached && absences >= limit - 1 && limit > 1;
        const pct = limit > 0 ? Math.min(Math.round(absences / limit * 100), 100) : (absences > 0 ? 100 : 0);
        const barColor = reached ? '#fb7185' : nearLimit ? '#b45309' : '#34d399';
        return { s, absences, limit, remaining, reached, nearLimit, pct, barColor };
    });
    body.innerHTML = `
    <div class="al-modal-intro">Set the maximum number of absences allowed per subject. A warning appears when you approach or reach the limit.</div>
    ${rows.map(({ s, absences, limit, remaining, reached, nearLimit, pct, barColor }) => `
      <div class="al-modal-row ${reached ? 'al-reached' : nearLimit ? 'al-near' : ''}">
        <div class="al-row-header">
          <div class="d-flex align-items-center gap-2 min-w-0">
            <div class="att-limit-dot" style="background:${s.color}"></div>
            <span class="al-code">${escapeAttHtml(s.code)}</span>
          </div>
          <div class="al-status-badge ${reached ? 'danger' : nearLimit ? 'warn' : 'ok'}">
            ${reached ? '<i class="bi bi-exclamation-triangle-fill"></i> Limit reached' :
        nearLimit ? `<i class="bi bi-exclamation-circle"></i> ${remaining} remaining` :
            `<i class="bi bi-check-circle"></i> ${remaining} remaining`}
          </div>
        </div>
        <div class="al-stats-row">
          <div class="al-stat"><div class="al-stat-val">${absences}</div><div class="al-stat-lbl">Absences</div></div>
          <div class="al-stat"><div class="al-stat-val">${limit}</div><div class="al-stat-lbl">Limit</div></div>
          <div class="al-stat"><div class="al-stat-val" style="color:${barColor}">${remaining}</div><div class="al-stat-lbl">Remaining</div></div>
        </div>
        <div class="progress mb-2" style="height:6px"><div class="progress-bar" style="width:${pct}%;background:${barColor};transition:width .4s ease"></div></div>
        <div class="d-flex align-items-center gap-2 mt-1">
          <label class="al-stat-lbl al-limit-label">Max absences:</label>
          <input type="number" min="0" max="99" step="1"
            class="form-control form-control-sm al-limit-input"
            value="${limit}"
            data-subject-id="${s.id}"
            oninput="previewAbsenceLimit(this)">
          <button class="btn btn-accent btn-sm al-save-btn" onclick="saveAbsenceLimitFromInput(this, '${s.id}', '${escapeAttJs(s.code)}')">Save</button>
        </div>
      </div>`).join('')}`;
    new bootstrap.Modal(document.getElementById('absenceLimitModal')).show();
}

function previewAbsenceLimit(input) {
    // live feedback — nothing needed, save on button click
}

function saveAbsenceLimitFromInput(btn, subjectId, subjectCode) {
    const row = btn.closest('.al-modal-row');
    const input = row.querySelector('.al-limit-input');
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0) {
        Toast.show('Enter a valid number (0 or more)', 'high', 'bi-exclamation-triangle');
        return;
    }
    setAbsenceLimitForSubject(subjectId, val);
    Toast.show(`Limit set to ${val} for ${subjectCode}`);
    const modal = bootstrap.Modal.getInstance(document.getElementById('absenceLimitModal'));
    if (modal)
        modal.hide();
    renderAbsenceWarnings();
    renderSubjectBreakdown();
}

/* ---- Per-subject Breakdown ---- */

function renderSubjectBreakdown() {
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const records = DB.getAttendance().filter(r => r.semesterId === semId);
    const wrap = document.getElementById('subjectBreakdown');
    if (!wrap)
        return;
    if (!subs.length) {
        wrap.innerHTML = `<div class="text-faint text-center py-3" style="font-size:.82rem">No subjects yet.</div>`;
        return;
    }
    const subData = subs.map(s => {
        const recs = records.filter(r => r.subjectId === s.id);
        const present = recs.filter(r => r.status === 'Present').length;
        const presentOnline = recs.filter(r => r.status === 'Present' && r.online).length;
        const late = recs.filter(r => r.status === 'Late').length;
        const excused = recs.filter(r => r.status === 'Excused').length;
        const absent = recs.filter(r => r.status === 'Absent').length;
        const noClass = recs.filter(r => r.status === 'No Classes').length;
        const relevant = present + late + excused + absent;
        const rate = relevant > 0 ? Math.round((present + late + excused) / relevant * 100) : null;
        const limit = getAbsenceLimitForSubject(s.id);
        const limitPct = limit > 0 ? Math.min(Math.round(absent / limit * 100), 100) : (absent > 0 ? 100 : 0);
        const limitColor = absent >= limit ? '#fb7185' : absent >= limit - 1 && limit > 1 ? '#b45309' : '#34d399';
        const consec = getCurrentConsecutiveAbsences(s.id, records);
        const rateLabel = rate === null ? '' : rate >= 90 ? 'Excellent' : rate >= 80 ? 'Good' : rate >= 75 ? 'Fair' : 'At Risk';
        return { s, present, presentOnline, late, excused, absent, noClass, relevant, rate, limit, limitPct, limitColor, consec, rateLabel };
    }).filter(d => d.relevant > 0 || d.noClass > 0);
    if (!subData.length) {
        wrap.innerHTML = `<div class="text-faint text-center py-3" style="font-size:.82rem">Log attendance to see subject breakdown.</div>`;
        return;
    }
    wrap.innerHTML = subData.map(({ s, present, presentOnline, late, excused, absent, noClass, rate, limit, limitPct, limitColor, consec, rateLabel }) => {
        const rateColor = rate === null ? 'var(--text-faint)' : rate >= 80 ? '#34d399' : rate >= 75 ? '#b45309' : '#fb7185';
        const remaining = Math.max(limit - absent, 0);
        return `
    <div class="att-subject-breakdown-card">
      <div class="att-breakdown-header">
        <div class="d-flex align-items-center gap-2 min-w-0">
          <div style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></div>
          <span class="att-breakdown-code">${escapeAttHtml(s.code)}</span>
          ${s.desc ? `<span class="text-faint att-breakdown-desc">${escapeAttHtml(s.desc)}</span>` : ''}
        </div>
        <div class="d-flex align-items-center gap-2 flex-shrink-0">
          ${rateLabel ? `<span class="att-rate-label" style="color:${rateColor}">${rateLabel}</span>` : ''}
          <span class="att-breakdown-rate" style="color:${rateColor}">${rate === null ? '—' : rate + '%'}</span>
        </div>
      </div>
      ${rate !== null ? `<div class="progress mb-2" style="height:4px"><div class="progress-bar" style="width:${rate}%;background:${rateColor};transition:width .4s ease"></div></div>` : ''}
      <div class="att-breakdown-stats">
        <div class="att-bd-stat present">
          <div class="att-bd-val">${present}</div>
          <div class="att-bd-lbl">Present${presentOnline > 0 ? `<span class="att-online-sub">(${presentOnline}↑)</span>` : ''}</div>
        </div>
        <div class="att-bd-stat late"><div class="att-bd-val">${late}</div><div class="att-bd-lbl">Late</div></div>
        <div class="att-bd-stat excused"><div class="att-bd-val">${excused}</div><div class="att-bd-lbl">Excused</div></div>
        <div class="att-bd-stat absent"><div class="att-bd-val">${absent}</div><div class="att-bd-lbl">Absent</div></div>
        <div class="att-bd-stat noclasses"><div class="att-bd-val">${noClass}</div><div class="att-bd-lbl">No Class</div></div>
      </div>
      <div class="att-bd-limit-row">
        <div class="att-bd-limit-info">
          <span class="att-bd-limit-label">Absences:</span>
          <span class="att-bd-limit-val" style="color:${limitColor}">${absent} / ${limit}</span>
          <span class="att-bd-limit-remain text-faint">${remaining > 0 ? remaining + ' remaining' : absent > limit ? 'exceeded' : 'at limit'}</span>
        </div>
        <div class="progress att-bd-limit-bar"><div class="progress-bar" style="width:${limitPct}%;background:${limitColor};transition:width .4s ease"></div></div>
      </div>
      ${consec >= 3 ? `<div class="att-bd-consec-warn"><i class="bi bi-exclamation-triangle-fill"></i> ${consec} consecutive absences</div>` : ''}
    </div>`;
    }).join('');
}

/* ---- Attendance Log — table layout, paginated ---- */
const ATT_LOG_PAGE_SIZE = 10;
let _attLogShowAll = false;

function renderLog(showAll) {
    if (showAll === true)
        _attLogShowAll = true;
    showAll = _attLogShowAll;
    const semId = DB.getActiveSemesterId();
    const subs = DB.getSubjects();
    const records = [...DB.getAttendance().filter(r => r.semesterId === semId)]
        .sort((a, b) => b.date.localeCompare(a.date));
    const wrap = document.getElementById('attendanceLog');
    if (!records.length) {
        wrap.innerHTML = `<div class="text-faint text-center py-5 att-log-empty"><i class="bi bi-calendar3"></i><div>No attendance logged yet</div></div>`;
        const cl = document.getElementById('attLogCountLabel');
        if (cl)
            cl.textContent = '';
        return;
    }
    const total = records.length;
    const displayCount = showAll ? total : Math.min(ATT_LOG_PAGE_SIZE, total);
    const displayRecords = records.slice(0, displayCount);
    const hasMore = total > ATT_LOG_PAGE_SIZE && !showAll;
    const countLabelEl = document.getElementById('attLogCountLabel');
    if (countLabelEl) {
        countLabelEl.textContent = total > ATT_LOG_PAGE_SIZE ? `Showing ${displayCount} of ${total}` : '';
    }
    function buildRow(r) {
        const s = subs.find(x => x.id === r.subjectId);
        const dotColor = s ? s.color : '#888';
        const statusClass = r.status === 'No Classes' ? 'noclasses' : r.status.toLowerCase().replace(/\s+/g, '');
        const statusDisplay = r.status === 'No Classes' ? 'No Class' : r.status;
        const onlinePill = r.online ? `<span class="att-online-chip">Online</span>` : '';
        const hasNotes = r.notes && r.notes.trim().length > 0;
        const dateFormatted = formatShortDate(r.date);
        return `<tr class="att-tbl-row">
      <td class="att-tbl-dot"><span class="att-log-dot-circle" style="background:${dotColor}"></span></td>
      <td class="att-tbl-date">${dateFormatted}</td>
      <td class="att-tbl-course" title="${s ? escapeAttHtml(s.code) : 'Unknown'}">${s ? escapeAttHtml(s.code) : '—'}</td>
      <td class="att-tbl-status"><span class="att-status-badge ${statusClass}">${statusDisplay}${onlinePill}</span></td>
        <td class="att-tbl-actions">
        ${hasNotes
            ? `<button class="att-action-btn att-notes-btn" onclick="showAttNoteById(event,'${r.id}')" title="View note" aria-label="View note"><i class="bi bi-chat-left-text-fill"></i></button>`
            : ''}
        <button class="att-action-btn att-edit-btn" onclick="openAttendanceEdit('${r.id}')" title="Edit record" aria-label="Edit attendance record"><i class="bi bi-pencil-square"></i></button>
        <button class="att-action-btn att-delete-btn" onclick="deleteAttendance('${r.id}')" title="Delete record" aria-label="Delete attendance record"><i class="bi bi-trash3"></i></button>
      </td>
    </tr>`;
    }
    const showMoreHtml = hasMore
        ? `<div class="att-log-show-more"><button class="btn btn-ghost btn-sm att-log-show-more-btn" onclick="renderLog(true)"><i class="bi bi-chevron-down me-1"></i>Show More <span class="att-log-more-count">(${total - displayCount} more)</span></button></div>`
        : '';
    wrap.innerHTML = `<table class="att-log-table" role="grid">
    <thead>
      <tr class="att-tbl-head">
        <th class="att-tbl-dot" scope="col"></th>
        <th class="att-tbl-date" scope="col">Date</th>
        <th class="att-tbl-course" scope="col">Course</th>
        <th class="att-tbl-status" scope="col">Status</th>
        <th class="att-tbl-actions" scope="col">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${displayRecords.map(buildRow).join('')}
    </tbody>
  </table>` + showMoreHtml;
}

function escapeAttJs(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
}

/* ---- Notes Modal ---- */

function showAttNote(event, notes, date, subjectCode) {
    event.stopPropagation();
    document.getElementById('attNoteContent').textContent = notes;
    document.getElementById('attNoteMeta').textContent = `${date} · ${subjectCode}`;
    new bootstrap.Modal(document.getElementById('attNotesModal')).show();
}

function showAttNoteById(event, id) {
    const rec = DB.getAttendance().find(r => r.id === id);
    if (!rec)
        return;
    const s = DB.getSubject(rec.subjectId);
    showAttNote(event, rec.notes || '', rec.date, s ? s.code : 'Unknown');
}

/* ---- Delete ---- */

function deleteAttendance(id) {
    confirmAction({
        title: 'Remove attendance record?',
        message: 'This log entry will be permanently removed.',
        confirmLabel: 'Remove',
        danger: true,
        icon: 'bi-trash-fill',
        onConfirm() {
            DB.saveAttendance(DB.getAttendance().filter(r => r.id !== id));
            Toast.show('Record removed');
            renderAttendanceAll();
        }
    });
}

/* ---- Edit Attendance ---- */

let _attEditId = null;

function setupAttendanceEditModal() {
    const form = document.getElementById('attEditForm');
    if (!form || form.dataset.attEditBound)
        return;
    form.dataset.attEditBound = 'true';
    form.addEventListener('submit', event => {
        event.preventDefault();
        saveAttendanceEdit();
    });
    const online = document.getElementById('attEditOnline');
    const label = document.getElementById('attEditOnlineLabel');
    online.addEventListener('change', () => {
        label.textContent = online.checked ? 'Online' : 'Offline';
    });
}

// `draft` (optional) restores unsaved values if the user cancels the confirmation.
function openAttendanceEdit(id, draft) {
    const rec = DB.getAttendance().find(r => r.id === id);
    if (!rec) {
        Toast.show('Record not found', 'high', 'bi-exclamation-triangle');
        return;
    }
    _attEditId = id;
    const semId = DB.getActiveSemesterId();
    const sem = DB.getActiveSemester();
    const values = draft || {
        subjectId: rec.subjectId,
        date: rec.date,
        status: rec.status,
        online: !!rec.online,
        notes: rec.notes || ''
    };

    // Active-semester subjects, plus the record's current subject even if archived
    const subjects = DB.getSubjects().filter(s =>
        (s.semesterId === semId && !s.archived) || s.id === rec.subjectId);
    const subjectSel = document.getElementById('attEditSubject');
    subjectSel.innerHTML = subjects.map(s =>
        `<option value="${escapeAttHtml(s.id)}">${escapeAttHtml(s.code)}${s.archived ? ' (archived)' : ''}</option>`).join('');
    subjectSel.value = values.subjectId;

    const dateInput = document.getElementById('attEditDate');
    dateInput.min = sem?.startDate || '';
    dateInput.max = sem?.endDate || '';
    dateInput.value = values.date;

    const statusSel = document.getElementById('attEditStatus');
    statusSel.innerHTML = ATTENDANCE_STATUSES.map(st =>
        `<option value="${escapeAttHtml(st.value)}">${escapeAttHtml(st.label)}</option>`).join('');
    statusSel.value = ATTENDANCE_STATUSES.some(st => st.value === values.status) ? values.status : 'Present';

    const online = document.getElementById('attEditOnline');
    online.checked = !!values.online;
    document.getElementById('attEditOnlineLabel').textContent = online.checked ? 'Online' : 'Offline';

    document.getElementById('attEditNotes').value = values.notes || '';
    document.getElementById('attEditError').hidden = true;

    const modalEl = document.getElementById('attEditModal');
    (bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl)).show();
}

function saveAttendanceEdit() {
    const errBox = document.getElementById('attEditError');
    const fail = msg => {
        errBox.textContent = msg;
        errBox.hidden = false;
    };
    errBox.hidden = true;

    const records = DB.getAttendance();
    const rec = records.find(r => r.id === _attEditId);
    if (!rec) {
        fail('This record no longer exists.');
        return;
    }
    const next = {
        subjectId: document.getElementById('attEditSubject').value,
        date: document.getElementById('attEditDate').value,
        status: document.getElementById('attEditStatus').value,
        online: document.getElementById('attEditOnline').checked,
        notes: document.getElementById('attEditNotes').value.trim()
    };

    // ---- validation ----
    if (!next.subjectId)
        return fail('Choose a subject.');
    if (!next.date || isNaN(new Date(`${next.date}T00:00:00`).getTime()))
        return fail('Choose a valid date.');
    if (!ATTENDANCE_STATUSES.some(st => st.value === next.status))
        return fail('Choose a status.');

    const sem = DB.getActiveSemester();
    if (sem && next.date !== rec.date) {
        const before = sem.startDate && next.date < sem.startDate;
        const after = sem.endDate && next.date > sem.endDate;
        if (before || after)
            return fail(`Date must be within the semester (${formatDisplayDate(sem.startDate)} – ${formatDisplayDate(sem.endDate)}).`);
    }

    const subjects = DB.getSubjects();
    const codeOf = id => (subjects.find(s => s.id === id) || {}).code || 'Unknown';
    const clash = records.find(r => r.id !== rec.id && r.subjectId === next.subjectId && r.date === next.date);
    if (clash)
        return fail(`${codeOf(next.subjectId)} already has a record on ${formatDisplayDate(next.date)}. Edit or delete that one instead.`);

    // ---- what changed ----
    const statusLabel = v => v === 'No Classes' ? 'No Class' : v;
    const changes = [];
    if (rec.subjectId !== next.subjectId)
        changes.push(`Subject: ${codeOf(rec.subjectId)} → ${codeOf(next.subjectId)}`);
    if (rec.date !== next.date)
        changes.push(`Date: ${formatDisplayDate(rec.date)} → ${formatDisplayDate(next.date)}`);
    if (rec.status !== next.status)
        changes.push(`Status: ${statusLabel(rec.status)} → ${statusLabel(next.status)}`);
    if (!!rec.online !== next.online)
        changes.push(`Mode: ${rec.online ? 'Online' : 'Offline'} → ${next.online ? 'Online' : 'Offline'}`);
    if ((rec.notes || '') !== next.notes)
        changes.push('Notes updated');

    const modalEl = document.getElementById('attEditModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    if (!changes.length) {
        modal.hide();
        Toast.show('No changes to save');
        return;
    }

    // Close the edit modal first so the confirm dialog never stacks behind it.
    const id = rec.id;
    modalEl.addEventListener('hidden.bs.modal', () => {
        confirmAction({
            title: 'Save changes?',
            message: `Update this attendance record: ${changes.join('; ')}.`,
            confirmLabel: 'Save',
            icon: 'bi-pencil-square',
            onConfirm: () => applyAttendanceEdit(id, next),
            onCancel: () => openAttendanceEdit(id, next) // ignored if confirmAction has no onCancel
        });
    }, { once: true });
    modal.hide();
}

function applyAttendanceEdit(id, next) {
    const latest = DB.getAttendance();
    const rec = latest.find(r => r.id === id);
    if (!rec) {
        Toast.show('Record not found', 'high', 'bi-exclamation-triangle');
        return;
    }
    const subject = DB.getSubject(next.subjectId);
    rec.subjectId = next.subjectId;
    rec.date = next.date;
    rec.status = next.status;
    rec.online = next.online;
    rec.notes = next.notes;
    if (subject && subject.semesterId)
        rec.semesterId = subject.semesterId;
    DB.saveAttendance(latest); // cloud-sync diffs by id, marks dirty, upserts
    Toast.show('Attendance updated');
    renderAttendanceSubjectList(); // the log form pre-fills from existing records
    renderAttendanceAll();
}

/* ---- Export CSV ---- */

function exportAttendanceCSV() {
    const semId = DB.getActiveSemesterId();
    const sem = DB.getActiveSemester();
    const records = DB.getAttendance().filter(r => r.semesterId === semId)
        .sort((a, b) => a.date.localeCompare(b.date));
    const subs = DB.getSubjects();
    if (!records.length) {
        Toast.show('No attendance records to export.', 'high', 'bi-exclamation-circle');
        return;
    }
    const esc = v => {
        const s = String(v == null ? '' : v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
    };
    const rows = [['Date', 'Subject', 'Status', 'Mode', 'Notes']];
    for (const r of records) {
        const s = subs.find(x => x.id === r.subjectId);
        rows.push([r.date, s ? s.code : 'Unknown', r.status, r.online ? 'Online' : 'Offline', r.notes || '']);
    }
    const csv = rows.map(row => row.map(esc).join(',')).join('\r\n');
    const semName = sem ? `${sem.schoolYear}-${sem.name.replace(/\s+/g, '-')}` : 'Attendance';
    const filename = `Student-Planner-Attendance-${semName}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    Toast.show('CSV exported');
}

/* ---- Export PDF ---- */

function exportAttendancePDF() {
    const semId = DB.getActiveSemesterId();
    const sem = DB.getActiveSemester();
    const records = DB.getAttendance().filter(r => r.semesterId === semId)
        .sort((a, b) => a.date.localeCompare(b.date));
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    if (!records.length) {
        Toast.show('No attendance records to export.', 'high', 'bi-exclamation-circle');
        return;
    }
    // Calculate overall stats
    const relevant = records.filter(r => r.status !== 'No Classes');
    const presentAll = relevant.filter(r => r.status === 'Present' || r.status === 'Late' || r.status === 'Excused').length;
    const overallRate = relevant.length ? Math.round(presentAll / relevant.length * 100) : 0;
    const semLabel = sem ? `${sem.name} · ${sem.schoolYear}` : 'Current Semester';
    const settings = DB.getSettings();
    const studentName = settings.name || '';
    // Build per-subject summary
    const subRows = subs.map(s => {
        const recs = records.filter(r => r.subjectId === s.id);
        const p = recs.filter(r => r.status === 'Present').length;
        const l = recs.filter(r => r.status === 'Late').length;
        const e = recs.filter(r => r.status === 'Excused').length;
        const a = recs.filter(r => r.status === 'Absent').length;
        const nc = recs.filter(r => r.status === 'No Classes').length;
        const rel = p + l + e + a;
        const rate = rel > 0 ? Math.round((p + l + e) / rel * 100) : null;
        return { code: s.code, p, l, e, a, nc, rate };
    }).filter(x => (x.p + x.l + x.e + x.a + x.nc) > 0);
    const statusColor = s => ({
        'Present': '#22c55e', 'Late': '#92400e', 'Excused': '#60a5fa', 'Absent': '#f43f5e', 'No Classes': '#8b5cf6'
    }[s] || '#888');
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Attendance Report</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11pt;color:#111;margin:0;padding:20mm}
  h1{font-size:16pt;margin-bottom:2pt}
  h2{font-size:12pt;margin:14pt 0 6pt;border-bottom:1px solid #ddd;padding-bottom:4pt}
  .sub{font-size:10pt;color:#555}
  .stat-row{display:flex;gap:20pt;margin:8pt 0}
  .stat-box{text-align:center;border:1px solid #ddd;border-radius:6pt;padding:8pt 14pt}
  .stat-box .val{font-size:18pt;font-weight:bold}
  .stat-box .lbl{font-size:8pt;color:#666;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;font-size:9pt}
  th{background:#f4f4f4;padding:5pt 7pt;text-align:left;border:1px solid #ddd;font-weight:600}
  td{padding:4pt 7pt;border:1px solid #ddd}
  .rate{font-weight:bold}
  .badge{display:inline-block;padding:1pt 5pt;border-radius:3pt;font-size:8pt;font-weight:bold;color:#fff}
  .pg{page-break-before:always}
  @media print{body{padding:10mm}}
</style></head><body>
<h1>Student Planner — Attendance Report</h1>
<div class="sub">${semLabel}${studentName ? ' · ' + studentName : ''}</div>
<h2>Overall Attendance</h2>
<div class="stat-row">
  <div class="stat-box"><div class="val">${overallRate}%</div><div class="lbl">Overall Rate</div></div>
  <div class="stat-box"><div class="val">${relevant.filter(r => r.status === 'Present').length}</div><div class="lbl">Present</div></div>
  <div class="stat-box"><div class="val">${relevant.filter(r => r.status === 'Late').length}</div><div class="lbl">Late</div></div>
  <div class="stat-box"><div class="val">${relevant.filter(r => r.status === 'Excused').length}</div><div class="lbl">Excused</div></div>
  <div class="stat-box"><div class="val">${relevant.filter(r => r.status === 'Absent').length}</div><div class="lbl">Absent</div></div>
  <div class="stat-box"><div class="val">${records.filter(r => r.status === 'No Classes').length}</div><div class="lbl">No Class</div></div>
</div>
${subRows.length ? `<h2>Subject Summary</h2>
<table><thead><tr><th>Subject</th><th>Present</th><th>Late</th><th>Excused</th><th>Absent</th><th>No Class</th><th>Rate</th></tr></thead>
<tbody>${subRows.map(x => `<tr>
  <td>${x.code}</td>
  <td>${x.p}</td><td>${x.l}</td><td>${x.e}</td><td>${x.a}</td><td>${x.nc}</td>
  <td class="rate">${x.rate !== null ? x.rate + '%' : '—'}</td>
</tr>`).join('')}</tbody></table>` : ''}
<h2 class="${subRows.length ? 'pg' : ''}">Detailed Log</h2>
<table><thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Mode</th><th>Notes</th></tr></thead>
<tbody>${records.map(r => {
        const s = subs.find(x => x.id === r.subjectId);
        return `<tr>
    <td>${r.date}</td>
    <td>${s ? s.code : '?'}</td>
    <td><span class="badge" style="background:${statusColor(r.status)}">${r.status}</span></td>
    <td>${r.online ? 'Online' : 'Offline'}</td>
    <td>${r.notes || ''}</td>
  </tr>`;
    }).join('')}</tbody></table>
<div style="margin-top:16pt;font-size:8pt;color:#999">Generated ${new Date().toLocaleString()} · Student Planner</div>
</body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
        Toast.show('Allow popups to export PDF');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    Toast.show('PDF report opened for printing');
}

/* ---- Compat alias ---- */

function renderRanking() { renderSubjectBreakdown(); }
/* SHARED SUBJECT MODAL
 * One Add/Edit Subject modal for every page (Schedule, Calendar, ...).
 * Usage: openSubjectModal(id?, { presetDays: ['Mon'] })
 * After a save it fires a `subjects:changed` event on document; each page
 * listens for it and re-renders itself. Needs: DB, Toast, TimeField,
 * bootstrap, escHtml, fmtTime.
 * Styles: assets/css/pages/schedule.css */

function _smToMins(t) { if (!t) return 0; const p = String(t).split(':').map(Number); return p[0] * 60 + p[1]; }
function _smFromMins(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

function ensureSubjectModal() {
    if (document.getElementById('subjectModal')) return;
    document.body.insertAdjacentHTML('beforeend',
        '<div class="modal fade" id="subjectModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="subjectModalTitle">' +
        '<div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title" id="subjectModalTitle">Add Subject</h5><button type="button" class="btn-close" aria-label="Close modal" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" id="subjectModalBody"></div></div></div></div>');
}

function buildTimeFieldHtml(key, label, value, placeholder) {
    const id = `sub${key}`;
    return TimeField.html({ id, label, value: value || '', placeholder, required: true,
        after: key === 'End' ? 'subStart' : null });
}

function initSubjectTimeFields() {
    TimeField.init(document.getElementById('subjectModalBody'));
}

function updateSubjectTimeValidation() {
    TimeField.validate(['subStart', 'subEnd']);
    const invalid = id => {
        const input = document.getElementById(id);
        const error = document.getElementById(id + 'Error');
        return !input || !input.value || (error && !error.hidden);
    };
    return { startInvalid: invalid('subStart'), endInvalid: invalid('subEnd') };
}

function openSubjectModal(id, opts) {
    ensureSubjectModal();
    opts = opts || {};
    const s = id ? DB.getSubject(id) : null;
    document.getElementById('subjectModalTitle').textContent = s && s.source === 'curriculum' && s.setupStatus === 'needs_setup' ? 'Set Up Subject' : (s ? 'Edit Subject' : 'Add Subject');
    const body = document.getElementById('subjectModalBody');
    const days = s ? s.days : (opts.presetDays || []);
    body.innerHTML = `
    <input type="hidden" id="subId" value="${s ? s.id : ''}">
    <div class="row g-2">
      <div class="col-5"><label class="form-label" style="font-size:.82rem">Subject Code <span class="sch-subject-required" aria-hidden="true">*</span></label><input class="form-control sch-subject-code" id="subCode" value="${s ? escHtml(s.code) : ''}" placeholder="CS101" aria-label="Subject Code" aria-invalid="false" aria-describedby="subCodeError"><p class="sch-subject-error" id="subCodeError" hidden>Subject code is required</p></div>
      <div class="col-7"><label class="form-label" style="font-size:.82rem">Description</label><input class="form-control" id="subDesc" value="${s ? escHtml(s.desc) : ''}" placeholder="Introduction to Computing" aria-label="Subject Description"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Type</label>
        <select class="form-select" id="subType" aria-label="Subject Type">${['Lecture', 'Laboratory', 'Seminar', 'Hybrid'].map(t => `<option ${s && s.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Units</label><input type="number" step="0.5" class="form-control" id="subUnits" value="${s ? s.units : 3}" aria-label="Units"></div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Days <span class="sch-subject-required" aria-hidden="true">*</span></label>
        <div class="sch-subject-days" id="subDaysGroup" role="group" aria-label="Select class days" aria-describedby="subDaysError" aria-invalid="false">
        <div class="day-selector">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `
            <label class="day-chip">
              <input class="day-check" type="checkbox" value="${d}" id="day_${d}" ${days.includes(d) ? 'checked' : ''}>
              <span>${d}</span>
            </label>`).join('')}
        </div>
        </div>
        <p class="sch-subject-error" id="subDaysError" hidden>Select at least one day</p>
      </div>
        <div class="col-12">
        <div class="sch-time-row">
          ${buildTimeFieldHtml('Start', 'Start time', s ? s.start : '', '9:00 AM')}
          ${buildTimeFieldHtml('End', 'End time', s ? s.end : '', '10:30 AM')}
        </div>
        <p class="sch-time-hint" id="subTimeHint" data-start="subStart" data-end="subEnd" aria-live="polite"></p>
      </div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Room</label><input class="form-control" id="subRoom" value="${s ? escHtml(s.room || '') : ''}" placeholder="302" aria-label="Room number"></div>
      <div class="col-8"><label class="form-label" style="font-size:.82rem">Building</label><input class="form-control" id="subBuilding" value="${s ? escHtml(s.building || '') : ''}" placeholder="Engineering Building" aria-label="Building name"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Professor</label><input class="form-control" id="subProf" value="${s ? escHtml(s.professor) : ''}" placeholder="e.g. Juan Dela Cruz" aria-label="Professor"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Email</label><input type="email" class="form-control" id="subEmail" value="${s ? escHtml(s.email) : ''}" placeholder="e.g. juan.delacruz@qcu.edu.ph" aria-label="Professor email"></div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Color Label</label>
        <div class="color-swatch-group" id="colorPicker" role="radiogroup" aria-label="Select subject color">
          ${DB.colors.map(c => `<button type="button" onclick="selectColor('${c}')" data-color="${c}" class="color-swatch-btn${(s ? s.color : DB.colors[0]) === c ? ' is-selected' : ''}" role="radio" aria-label="Color ${c}" aria-checked="${(s ? s.color : DB.colors[0]) === c}" style="background:${c}"></button>`).join('')}
        </div>
        <input type="hidden" id="subColor" value="${s ? s.color : DB.colors[0]}">
      </div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Notes</label><textarea class="form-control" id="subNotes" rows="2" placeholder="Optional notes about this subject…" aria-label="Notes">${s ? escHtml(s.notes) : ''}</textarea></div>
    </div>
    <div id="subConflictWarning" class="sch-conflict-warning d-none" role="alert"></div>
    <div class="modal-actions">
      <button class="btn btn-accent flex-grow-1" onclick="saveSubject()"><i class="icon-lucide-check me-1" aria-hidden="true"></i>${s ? 'Update' : 'Save'} Subject</button>
      ${s ? `<button class="btn btn-ghost" onclick="deleteSubject('${s.id}')" aria-label="Delete subject"><i class="icon-lucide-trash-2" aria-hidden="true"></i></button>` : ''}
    </div>`;
    const codeInput = body.querySelector('#subCode');
    const codeError = body.querySelector('#subCodeError');
    const daysGroup = body.querySelector('#subDaysGroup');
    const daysError = body.querySelector('#subDaysError');
    codeInput.addEventListener('input', () => {
      if (codeInput.value.trim()) {
        codeInput.setAttribute('aria-invalid', 'false');
        codeError.hidden = true;
      }
    });
    daysGroup.addEventListener('change', () => {
      if (daysGroup.querySelector('.day-check:checked')) {
        daysGroup.classList.remove('has-error');
        daysGroup.setAttribute('aria-invalid', 'false');
        daysError.hidden = true;
      }
    });

    const subjectModal = document.getElementById('subjectModal');
    subjectModal.dataset.timeValidationAttempted = 'false';
    initSubjectTimeFields();
    subjectModal.addEventListener('hidden.bs.modal', () => {
      subjectModal.dataset.timeValidationAttempted = 'false';
    }, { once: true });
    new bootstrap.Modal(document.getElementById('subjectModal')).show();
}

function selectColor(c) {
    document.getElementById('subColor').value = c;
    document.querySelectorAll('#colorPicker .color-swatch-btn').forEach(d => {
        const isSelected = d.dataset.color === c;
        d.classList.toggle('is-selected', isSelected);
        d.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
}

let subSaving = false;
function saveSubject() {
    // Re-entrancy guard against a rapid double-click duplicating the
    // subject before the modal's fade-out finishes.
    if (subSaving) return;
    const id = document.getElementById('subId').value;
    const codeInput = document.getElementById('subCode');
    const code = codeInput.value.trim();
    const codeInvalid = !code;
    const daysGroup = document.getElementById('subDaysGroup');
    const days = [...daysGroup.querySelectorAll('.day-check:checked')].map(c => c.value);
    const daysInvalid = days.length === 0;
    const codeError = document.getElementById('subCodeError');
    const daysError = document.getElementById('subDaysError');
    const startInput = document.getElementById('subStart');
    const endInput = document.getElementById('subEnd');
    const subjectModal = document.getElementById('subjectModal');
    subjectModal.dataset.timeValidationAttempted = 'true';
    const timeInvalid = updateSubjectTimeValidation();
    codeInput.setAttribute('aria-invalid', codeInvalid ? 'true' : 'false');
    codeError.hidden = !codeInvalid;
    daysGroup.classList.toggle('has-error', daysInvalid);
    daysGroup.setAttribute('aria-invalid', daysInvalid ? 'true' : 'false');
    daysError.hidden = !daysInvalid;
    if (codeInvalid || daysInvalid || timeInvalid.startInvalid || timeInvalid.endInvalid) {
        if (codeInvalid)
            codeInput.focus();
        else if (daysInvalid)
            daysGroup.querySelector('.day-check').focus();
        else if (timeInvalid.startInvalid)
            document.getElementById('subStartText').focus();
        else
            document.getElementById('subEndText').focus();
        return;
    }
    const start = startInput.value;
    const end = endInput.value;
    const data = {
        code, desc: document.getElementById('subDesc').value.trim(),
        type: document.getElementById('subType').value,
        units: parseFloat(document.getElementById('subUnits').value) || 0,
        days, start, end,
        room: document.getElementById('subRoom').value.trim(),
        building: document.getElementById('subBuilding').value.trim(),
        professor: document.getElementById('subProf').value.trim(),
        email: document.getElementById('subEmail').value.trim(),
        color: document.getElementById('subColor').value,
        notes: document.getElementById('subNotes').value.trim(),
    };
    subSaving = true;
    const conflicts = checkSaveConflict(data, id || null);
    const warnEl = document.getElementById('subConflictWarning');
    if (conflicts.length) {
        const conflictNames = conflicts.map(c => `${c.code} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ');
        warnEl.innerHTML = `<i class="icon-lucide-triangle-alert me-1" aria-hidden="true"></i>Schedule conflict with: ${escHtml(conflictNames)}. You can still save.`;
        warnEl.classList.remove('d-none');
    }
    else {
        warnEl.classList.add('d-none');
    }
    const subjects = DB.getSubjects();
    if (id) {
        const idx = subjects.findIndex(s => s.id === id);
        if (idx !== -1) {
            const current = subjects[idx];
            subjects[idx] = { ...current, ...data };
            if (current.source === 'curriculum' && current.setupStatus === 'needs_setup')
                subjects[idx].setupStatus = 'completed';
        }
    }
    else {
        const sem = DB.getActiveSemester();
        subjects.push({
            id: DB.uid(),
            section: '',
            online: false,
            semester: sem ? sem.name : '1st Semester',
            schoolYear: sem ? sem.schoolYear : '2026-2027',
            semesterId: sem ? sem.id : DB.getActiveSemesterId(),
            archived: false,
            source: 'manual',
            setupStatus: 'completed',
            curriculumKey: '',
            ...data,
        });
    }
    if (DB.saveSubjects(subjects) === false) {
        Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'icon-lucide-triangle-alert');
        subSaving = false;
        return;
    }
    bootstrap.Modal.getInstance(document.getElementById('subjectModal')).hide();
    Toast.show(id ? 'Subject updated' : 'Subject added');
    document.dispatchEvent(new CustomEvent('subjects:changed'));
    subSaving = false;
}

// Check conflict for save (returns array of conflicting subjects)

function checkSaveConflict(data, excludeId) {
    const semId = DB.getActiveSemesterId();
    const allSubs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived && s.id !== excludeId);
    const conflicts = [];
    const newStart = _smToMins(data.start), newEnd = _smToMins(data.end);
    allSubs.forEach(s => {
        if (!s.days || !data.days)
            return;
        const sharedDays = s.days.filter(d => data.days.includes(d));
        if (!sharedDays.length)
            return;
        const sStart = _smToMins(s.start), sEnd = _smToMins(s.end);
        if (newStart < sEnd && newEnd > sStart) {
            conflicts.push(s);
        }
    });
    return conflicts;
}

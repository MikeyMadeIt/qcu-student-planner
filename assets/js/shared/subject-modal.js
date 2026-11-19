/* SHARED SUBJECT MODAL
 * One Add/Edit Subject modal for every page (Schedule, Calendar, ...).
 * Usage: openSubjectModal(id?, { presetDays: ['Mon'] })
 * After a save it fires a `subjects:changed` event on document; each page
 * listens for it and re-renders itself. Needs: DB, Toast, TimeField-free
 * (it has its own time pickers), bootstrap, escHtml, fmtTime.
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

const TIME_MENU_FIRST = 5 * 60;
const TIME_MENU_LAST = 23 * 60 + 45;
const TIME_MENU_STEP = 15;
const TIME_ORDER_MSG = 'End time must be later than start time';
const _timeAssumed = { Start: false, End: false };
const _timeActive = { Start: null, End: null };
const _timeNavigated = { Start: false, End: false };

function timeValueToMins(v) {
    const m = /^(\d{2}):(\d{2})/.exec(v || '');
    return m ? (+m[1]) * 60 + (+m[2]) : null;
}

function formatTime12(v) {
    const mins = timeValueToMins(v);
    if (mins == null)
        return '';
    const h = Math.floor(mins / 60), mi = mins % 60;
    return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatClassLength(mins) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

// Returns { empty } | { error } | { value:'HH:MM', assumed:boolean }
function parseTimeText(raw, afterMins) {
    let s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (!s)
        return { empty: true };
    if (s === 'noon')
        return { value: '12:00' };
    const unreadable = { error: "Couldn't read that time. Try 9:30 AM or 14:30, or pick from the list." };
    let mer = null;
    const mm = s.match(/\s*([ap])\.?\s*m?\.?\s*$/);
    if (mm) {
        mer = mm[1] === 'a' ? 'am' : 'pm';
        s = s.slice(0, mm.index).trim();
    }
    let hStr, miStr, m;
    if ((m = s.match(/^(\d{1,2})\s*[:.h]\s*(\d{2})$/)) || (m = s.match(/^(\d{1,2})\s+(\d{2})$/))) {
        hStr = m[1];
        miStr = m[2];
    }
    else if ((m = s.match(/^(\d{3,4})$/))) {
        hStr = m[1].slice(0, -2);
        miStr = m[1].slice(-2);
    }
    else if ((m = s.match(/^(\d{1,2})$/))) {
        hStr = m[1];
        miStr = '00';
    }
    else
        return unreadable;

    let h = +hStr;
    const mi = +miStr;
    if (mi > 59)
        return { error: 'Minutes must be between 00 and 59. Or pick from the list.' };
    let assumed = false;
    if (mer) {
        if (h >= 13 && h <= 23) { /* 24-hour hour typed with a stray am/pm: trust the 24-hour hour */ }
        else if (h < 1 || h > 12)
            return { error: 'With AM/PM, use an hour from 1 to 12.' };
        else if (mer === 'am')
            h = h === 12 ? 0 : h;
        else
            h = h === 12 ? 12 : h + 12;
    }
    else {
        if (h > 23)
            return { error: 'Hours go from 0 to 23 (or 1 to 12 with AM/PM).' };
        const explicit24 = h === 0 || h >= 13 || (hStr.length === 2 && hStr[0] === '0');
        if (!explicit24) {
            assumed = true;
            if (h >= 1 && h <= 6)
                h += 12;
        }
    }
    let mins = h * 60 + mi;
    if (assumed && afterMins != null && mins <= afterMins && mins + 720 > afterMins && mins + 720 < 1440)
        mins += 720;
    return { value: _smFromMins(mins), assumed };
}

function buildTimeFieldHtml(key, label, value, placeholder) {
    const v = timeValueToMins(value) != null ? String(value).slice(0, 5) : '';
    return `<div class="sch-time-col">
      <label class="form-label" style="font-size:.82rem" for="sub${key}Text">${label} <span class="sch-subject-required" aria-hidden="true">*</span></label>
      <div class="sch-time-field" data-time-key="${key}">
        <input type="text" class="form-control sch-time-input" id="sub${key}Text" value="${v ? formatTime12(v) : ''}" placeholder="${placeholder}" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="sub${key}Menu" aria-invalid="false" aria-describedby="sub${key}Error">
        <button type="button" class="sch-time-btn" id="sub${key}Btn" aria-label="Pick ${label.toLowerCase()} from list" aria-haspopup="listbox"><i class="bi bi-clock" aria-hidden="true"></i></button>
        <input type="hidden" id="sub${key}" value="${v}">
        <div class="sch-time-menu" id="sub${key}Menu" role="listbox" aria-label="${label} options" hidden></div>
      </div>
      <p class="sch-subject-error" id="sub${key}Error" hidden></p>
    </div>`;
}

function timeEls(key) {
    return {
        field: document.querySelector(`.sch-time-field[data-time-key="${key}"]`),
        text: document.getElementById(`sub${key}Text`),
        hidden: document.getElementById(`sub${key}`),
        btn: document.getElementById(`sub${key}Btn`),
        menu: document.getElementById(`sub${key}Menu`),
        err: document.getElementById(`sub${key}Error`)
    };
}

function setTimeError(key, msg) {
    const el = timeEls(key);
    el.err.textContent = msg || '';
    el.err.hidden = !msg;
    el.text.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.field.classList.toggle('has-error', !!msg);
}

function validateTimeOrder() {
    const s = timeValueToMins(document.getElementById('subStart').value);
    const e = timeValueToMins(document.getElementById('subEnd').value);
    const endEl = timeEls('End');
    if (s != null && e != null)
        setTimeError('End', e <= s ? TIME_ORDER_MSG : '');
    else if (endEl.err.textContent === TIME_ORDER_MSG)
        setTimeError('End', '');
}

function refreshTimeHint() {
    const hint = document.getElementById('subTimeHint');
    if (!hint)
        return;
    const s = timeValueToMins(document.getElementById('subStart').value);
    const e = timeValueToMins(document.getElementById('subEnd').value);
    const notes = [];
    ['Start', 'End'].forEach(k => {
        const v = document.getElementById('sub' + k).value;
        if (_timeAssumed[k] && v)
            notes.push(`${k} read as ${formatTime12(v)}. Add "am" or "pm" to change.`);
    });
    const parts = [];
    if (s != null && e != null && e > s)
        parts.push(`<i class="bi bi-hourglass-split" aria-hidden="true"></i> ${formatClassLength(e - s)}`);
    if (notes.length)
        parts.push(notes.join(' '));
    hint.innerHTML = parts.length
        ? parts.join(' · ')
        : 'Type a time (9:30 AM, 930, 14:30) or tap the clock to pick.';
}

// Parse whatever is typed, write the clean text + the canonical HH:MM hidden value.
function commitTimeField(key) {
    const el = timeEls(key);
    if (!el.text)
        return;
    const attempted = document.getElementById('subjectModal').dataset.timeValidationAttempted === 'true';
    const raw = el.text.value;
    if (!raw.trim()) {
        el.hidden.value = '';
        _timeAssumed[key] = false;
        setTimeError(key, attempted ? `${key} time is required` : '');
    }
    else {
        const after = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
        const r = parseTimeText(raw, after);
        if (r.error) {
            el.hidden.value = '';
            _timeAssumed[key] = false;
            setTimeError(key, r.error);
        }
        else {
            el.hidden.value = r.value;
            el.text.value = formatTime12(r.value);
            _timeAssumed[key] = !!r.assumed;
            setTimeError(key, '');
        }
    }
    validateTimeOrder();
    refreshTimeHint();
}

function setTimeValue(key, value) {
    const el = timeEls(key);
    el.hidden.value = value;
    el.text.value = formatTime12(value);
    _timeAssumed[key] = false;
    setTimeError(key, '');
    validateTimeOrder();
    refreshTimeHint();
}

function setActiveTimeOption(key, opt, center) {
    const el = timeEls(key);
    if (_timeActive[key])
        _timeActive[key].classList.remove('is-active');
    _timeActive[key] = opt;
    if (!opt) {
        el.text.removeAttribute('aria-activedescendant');
        return;
    }
    opt.classList.add('is-active');
    el.text.setAttribute('aria-activedescendant', opt.id);
    const menu = el.menu;
    const top = opt.offsetTop, h = menu.clientHeight;
    if (center)
        menu.scrollTop = top - h / 2 + opt.offsetHeight / 2;
    else if (top < menu.scrollTop)
        menu.scrollTop = top;
    else if (top + opt.offsetHeight > menu.scrollTop + h)
        menu.scrollTop = top + opt.offsetHeight - h;
}

function openTimeMenu(key) {
    closeAllTimeMenus(key);
    const el = timeEls(key);
    if (!el.menu.hidden)
        return;
    const current = el.hidden.value;
    const startMins = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
    const first = startMins != null ? (Math.floor(startMins / TIME_MENU_STEP) + 1) * TIME_MENU_STEP : TIME_MENU_FIRST;
    const times = [];
    for (let m = first; m <= TIME_MENU_LAST; m += TIME_MENU_STEP)
        times.push(m);
    const curMins = timeValueToMins(current);
    if (curMins != null && !times.includes(curMins) && (startMins == null || curMins > startMins)) {
        times.push(curMins);
        times.sort((a, b) => a - b);
    }
    if (!times.length)
        return;
    el.menu.innerHTML = times.map(m => {
        const v = _smFromMins(m);
        const dur = startMins != null ? `<span class="sch-time-opt-dur">${formatClassLength(m - startMins)}</span>` : '';
        return `<div class="sch-time-opt" role="option" id="sub${key}Opt-${v.replace(':', '')}" data-value="${v}" aria-selected="${v === current}">${formatTime12(v)}${dur}</div>`;
    }).join('');
    el.menu.hidden = false;
    el.text.setAttribute('aria-expanded', 'true');
    _timeNavigated[key] = false;

    el.menu.classList.remove('is-up');
    const fr = el.field.getBoundingClientRect();
    const br = (el.field.closest('.modal-body') || document.body).getBoundingClientRect();
    const below = Math.min(br.bottom, window.innerHeight) - fr.bottom;
    const above = fr.top - Math.max(br.top, 0);
    el.menu.classList.toggle('is-up', below < 240 && above > below);

    const target = curMins != null && times.includes(curMins) ? curMins
        : (startMins != null ? startMins + 90 : 8 * 60);
    const nearest = times.reduce((b, m) => Math.abs(m - target) < Math.abs(b - target) ? m : b, times[0]);
    setActiveTimeOption(key, el.menu.querySelector(`[data-value="${_smFromMins(nearest)}"]`), true);
}

function closeTimeMenu(key) {
    const el = timeEls(key);
    if (!el.menu)
        return;
    el.menu.hidden = true;
    el.text.setAttribute('aria-expanded', 'false');
    el.text.removeAttribute('aria-activedescendant');
    _timeActive[key] = null;
}

function closeAllTimeMenus(exceptKey) {
    ['Start', 'End'].forEach(k => {
        if (k !== exceptKey && document.getElementById(`sub${k}Menu`))
            closeTimeMenu(k);
    });
}

function initSubjectTimeFields() {
    _timeAssumed.Start = _timeAssumed.End = false;
    ['Start', 'End'].forEach(key => {
        const el = timeEls(key);
        el.text.addEventListener('focus', () => setTimeout(() => el.text.select(), 0));
        el.text.addEventListener('input', () => {
            setTimeError(key, '');
            _timeNavigated[key] = false;
            if (!el.menu.hidden) {
                const after = key === 'End' ? timeValueToMins(document.getElementById('subStart').value) : null;
                const r = parseTimeText(el.text.value, after);
                const opt = r.value && el.menu.querySelector(`[data-value="${r.value}"]`);
                if (opt)
                    setActiveTimeOption(key, opt, true);
            }
        });
        el.text.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (el.menu.hidden) {
                    commitTimeField(key);
                    openTimeMenu(key);
                    return;
                }
                const opts = [...el.menu.querySelectorAll('.sch-time-opt')];
                const idx = opts.indexOf(_timeActive[key]);
                const next = Math.max(0, Math.min(opts.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
                _timeNavigated[key] = true;
                setActiveTimeOption(key, opts[next], false);
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!el.menu.hidden && _timeNavigated[key] && _timeActive[key])
                    setTimeValue(key, _timeActive[key].dataset.value);
                else
                    commitTimeField(key);
                closeTimeMenu(key);
                if (window.matchMedia('(hover: none)').matches)
                    el.text.blur();
            }
            else if (e.key === 'Escape' && !el.menu.hidden) {
                e.stopPropagation();
                closeTimeMenu(key);
            }
        });
        el.field.addEventListener('focusout', e => {
            if (!el.field.contains(e.relatedTarget)) {
                commitTimeField(key);
                closeTimeMenu(key);
            }
        });
        el.btn.addEventListener('click', () => {
            if (!el.menu.hidden) {
                closeTimeMenu(key);
                return;
            }
            commitTimeField(key);
            openTimeMenu(key);
        });
        el.menu.addEventListener('mousedown', e => e.preventDefault());
        el.menu.addEventListener('click', e => {
            const opt = e.target.closest('.sch-time-opt');
            if (!opt)
                return;
            setTimeValue(key, opt.dataset.value);
            closeTimeMenu(key);
        });
    });
    if (!window._schTimeGlobalBound) {
        window._schTimeGlobalBound = true;
        document.addEventListener('pointerdown', e => {
            if (!e.target.closest('.sch-time-field') && document.getElementById('subStartMenu'))
                closeAllTimeMenus();
        });
    }
}

// CRUD

function updateSubjectTimeValidation() {
    commitTimeField('Start');
    commitTimeField('End');
    const bad = k => {
        const el = timeEls(k);
        return !el.hidden.value || !el.err.hidden;
    };
    return { startInvalid: bad('Start'), endInvalid: bad('End') };
}

function openSubjectModal(id, opts) {
    ensureSubjectModal();
    opts = opts || {};
    const s = id ? DB.getSubject(id) : null;
    document.getElementById('subjectModalTitle').textContent = s ? 'Edit Subject' : 'Add Subject';
    const sem = DB.getActiveSemester();
    const body = document.getElementById('subjectModalBody');
    const days = s ? s.days : (opts.presetDays || []);
    const isOnline = s ? !!s.online : false;
    body.innerHTML = `
    <input type="hidden" id="subId" value="${s ? s.id : ''}">
    <div class="row g-2">
      <div class="col-5"><label class="form-label" style="font-size:.82rem">Subject Code <span class="sch-subject-required" aria-hidden="true">*</span></label><input class="form-control sch-subject-code" id="subCode" value="${s ? escHtml(s.code) : ''}" placeholder="CS101" aria-label="Subject Code" aria-invalid="false" aria-describedby="subCodeError"><p class="sch-subject-error" id="subCodeError" hidden>Subject code is required</p></div>
      <div class="col-7"><label class="form-label" style="font-size:.82rem">Description</label><input class="form-control" id="subDesc" value="${s ? escHtml(s.desc) : ''}" placeholder="Introduction to Computing" aria-label="Subject Description"></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Type</label>
        <select class="form-select" id="subType" aria-label="Subject Type">${['Lecture', 'Laboratory', 'Seminar', 'Hybrid'].map(t => `<option ${s && s.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Units</label><input type="number" step="0.5" class="form-control" id="subUnits" value="${s ? s.units : 3}" aria-label="Units"></div>
      <div class="col-4"><label class="form-label" style="font-size:.82rem">Section</label><input class="form-control" id="subSection" value="${s ? escHtml(s.section) : ''}" placeholder="BSCS-1A" aria-label="Section"></div>
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
        <p class="sch-time-hint" id="subTimeHint" aria-live="polite"></p>
      </div>
        <div class="col-12"><div class="form-check form-switch mb-1">
          <input class="form-check-input" type="checkbox" id="subOnline" ${isOnline ? 'checked' : ''} aria-label="Online class">
          <label class="form-check-label" for="subOnline" style="font-size:.82rem"><i class="bi bi-wifi me-1" aria-hidden="true"></i>Online Class</label>
        </div>
      </div>
      <div class="col-4 sub-physical-field"><label class="form-label" style="font-size:.82rem">Room</label><input class="form-control" id="subRoom" value="${s && !s.online ? escHtml(s.room) : ''}" placeholder="302" aria-label="Room number"></div>
      <div class="col-8 sub-physical-field"><label class="form-label" style="font-size:.82rem">Building</label><input class="form-control" id="subBuilding" value="${s && !s.online ? escHtml(s.building) : ''}" placeholder="Engineering Building" aria-label="Building name"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Professor</label><input class="form-control" id="subProf" value="${s ? escHtml(s.professor) : ''}" aria-label="Professor"></div>
      <div class="col-6"><label class="form-label" style="font-size:.82rem">Email</label><input type="email" class="form-control" id="subEmail" value="${s ? escHtml(s.email) : ''}" aria-label="Professor email"></div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Color Label</label>
        <div class="color-swatch-group" id="colorPicker" role="radiogroup" aria-label="Select subject color">
          ${DB.colors.map(c => `<button type="button" onclick="selectColor('${c}')" data-color="${c}" class="color-swatch-btn${(s ? s.color : DB.colors[0]) === c ? ' is-selected' : ''}" role="radio" aria-label="Color ${c}" aria-checked="${(s ? s.color : DB.colors[0]) === c}" style="background:${c}"></button>`).join('')}
        </div>
        <input type="hidden" id="subColor" value="${s ? s.color : DB.colors[0]}">
      </div>
      <div class="col-12"><label class="form-label" style="font-size:.82rem">Notes</label><textarea class="form-control" id="subNotes" rows="2" aria-label="Notes">${s ? escHtml(s.notes) : ''}</textarea></div>
    </div>
    <div id="subConflictWarning" class="sch-conflict-warning d-none" role="alert"></div>
    <div class="modal-actions">
      <button class="btn btn-accent flex-grow-1" onclick="saveSubject()"><i class="bi bi-check2 me-1" aria-hidden="true"></i>${s ? 'Update' : 'Save'} Subject</button>
      ${s ? `<button class="btn btn-ghost" onclick="deleteSubject('${s.id}')" aria-label="Delete subject"><i class="bi bi-trash3" aria-hidden="true"></i></button>` : ''}
    </div>`;
    const onlineCheck = body.querySelector('#subOnline');
    function togglePhysical() {
        const isOn = onlineCheck.checked;
        body.querySelectorAll('.sub-physical-field').forEach(el => el.classList.toggle('d-none', isOn));
    }
    togglePhysical();
    onlineCheck.addEventListener('change', togglePhysical);
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
    refreshTimeHint();
    subjectModal.addEventListener('hidden.bs.modal', () => {
      closeAllTimeMenus();
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
    const isOnline = document.getElementById('subOnline').checked;
    const sem = DB.getActiveSemester();
    const data = {
        code, desc: document.getElementById('subDesc').value.trim(),
        type: document.getElementById('subType').value,
        units: parseFloat(document.getElementById('subUnits').value) || 0,
        section: document.getElementById('subSection').value.trim(),
        days, start, end,
        online: isOnline,
        room: isOnline ? '' : document.getElementById('subRoom').value.trim(),
        building: isOnline ? '' : document.getElementById('subBuilding').value.trim(),
        professor: document.getElementById('subProf').value.trim(),
        email: document.getElementById('subEmail').value.trim(),
        color: document.getElementById('subColor').value,
        notes: document.getElementById('subNotes').value.trim(),
        semester: sem ? sem.name : '1st Semester',
        schoolYear: sem ? sem.schoolYear : '2026-2027',
        semesterId: sem ? sem.id : DB.getActiveSemesterId(),
        archived: false,
    };
    subSaving = true;
    const conflicts = checkSaveConflict(data, id || null);
    const warnEl = document.getElementById('subConflictWarning');
    if (conflicts.length) {
        const conflictNames = conflicts.map(c => `${c.code} (${fmtTime(c.start)}–${fmtTime(c.end)})`).join(', ');
        warnEl.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>Schedule conflict with: ${escHtml(conflictNames)}. You can still save.`;
        warnEl.classList.remove('d-none');
    }
    else {
        warnEl.classList.add('d-none');
    }
    const subjects = DB.getSubjects();
    if (id) {
        const idx = subjects.findIndex(s => s.id === id);
        if (idx !== -1)
            subjects[idx] = { ...subjects[idx], ...data };
    }
    else
        subjects.push({ id: DB.uid(), ...data });
    if (DB.saveSubjects(subjects) === false) {
        Toast.show("Couldn't save to this device (storage may be full or blocked).", 'high', 'bi-exclamation-triangle');
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

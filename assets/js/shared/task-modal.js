/* SHARED TASK MODAL
 * One Add/Edit Task modal for every page (Tasks, Calendar, ...).
 * Usage: openTaskModal(id?, title?, presetDueDate?)
 * After a save it fires a `tasks:changed` event on document; each page
 * listens for it and re-renders itself.
 * Needs core/time-field.js, core/ui.js (fireConfetti), DB, Toast, bootstrap.
 * Styles: assets/css/pages/tasks.css */

function ensureTaskModal() {
    if (document.getElementById('taskModal')) return;
    document.body.insertAdjacentHTML('beforeend',
        '<div class="modal fade" id="taskModal" tabindex="-1" aria-modal="true" role="dialog">' +
        '<div class="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title" id="taskModalTitle">Add Task</h5><button class="btn-close" aria-label="Close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body" id="taskModalBody"></div></div></div></div>');
}

// Time estimate helpers

function teHrsMins(te) {
    if (!te)
        return { hrs: 0, mins: 0 };
    return { hrs: Math.floor(te / 60), mins: te % 60 };
}

var TK_EST_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];

function tkFmtDuration(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm';
}

// Returns minutes, null (empty) or NaN (invalid)
function tkParseDuration(str) {
    var s = String(str || '').toLowerCase().trim();
    if (!s) return null;
    var m = s.match(/^(\d+):(\d{1,2})$/);
    var total;
    if (m) {
        total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    } else {
        m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*(?:m(?:in(?:s|utes?)?)?)?)?$/);
        if (!m || (!m[1] && !m[2])) return NaN;
        total = Math.round((parseFloat(m[1]) || 0) * 60 + (parseInt(m[2], 10) || 0));
    }
    return (total > 0 && total <= 5999) ? total : NaN;
}

function tkTimeFieldHtml(key, id, placeholder, label) {
    return '<div class="sch-time-field" data-time-key="' + key + '">' +
        '<input type="text" class="form-control sch-time-input" id="' + id + '" autocomplete="off" placeholder="' + placeholder + '" ' +
        'role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-controls="' + id + 'Menu">' +
        '<button type="button" class="sch-time-btn" tabindex="-1" aria-label="' + label + '"><i class="icon-lucide-clock" aria-hidden="true"></i></button>' +
        '<div class="sch-time-menu" id="' + id + 'Menu" role="listbox" hidden></div></div>' +
        '<p class="sch-subject-error" id="' + id + 'Error" hidden></p>';
}

// cfg: { options:[n], value:n|null, format(n), sub(n), parse(str), allowEmpty, fallback }
function tkInitTimeField(field, cfg) {
    var input = field.querySelector('.sch-time-input');
    var btn = field.querySelector('.sch-time-btn');
    var menu = field.querySelector('.sch-time-menu');
    var active = -1;
    var errEl = document.getElementById(input.id + 'Error');
    document.body.appendChild(menu);
    function reposition() { if (!menu.hidden && window.TimeField) TimeField.position(menu, field); }
    function stopPositioning() { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); }

    function setError(msg) {
    if (errEl) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    field.classList.toggle('has-error', !!msg);
}

    function show(v) { input.value = v == null ? '' : cfg.format(v); }
    function setValue(v) { field._tkValue = v; setError(''); show(v); }
    function isOpen() { return !menu.hidden; }

    function render() {
        menu.innerHTML = cfg.options.map(function (o, i) {
            var sub = cfg.sub ? cfg.sub(o) : '';
            return '<div class="sch-time-opt" role="option" data-i="' + i + '" aria-selected="' + (o === field._tkValue) + '">' +
                '<span>' + escHtml(cfg.format(o)) + '</span>' +
                (sub ? '<span class="sch-time-opt-dur">' + escHtml(sub) + '</span>' : '') + '</div>';
        }).join('');
    }

    function setActive(i, scroll) {
        var opts = menu.querySelectorAll('.sch-time-opt');
        if (!opts.length) return;
        active = Math.max(0, Math.min(opts.length - 1, i));
        opts.forEach(function (el, idx) { el.classList.toggle('is-active', idx === active); });
        var el = opts[active];
        if (scroll === 'center') menu.scrollTop = el.offsetTop - menu.clientHeight / 2 + el.offsetHeight / 2;
        else if (el.offsetTop < menu.scrollTop) menu.scrollTop = el.offsetTop;
        else if (el.offsetTop + el.offsetHeight > menu.scrollTop + menu.clientHeight)
            menu.scrollTop = el.offsetTop + el.offsetHeight - menu.clientHeight;
    }

    function place() {
        reposition();
    }

    function open() {
        if (isOpen()) return;
        render();
        menu.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        place();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        var cur = field._tkValue, best = 0, bestDiff = Infinity;
        cfg.options.forEach(function (o, i) {
            var d = cur == null ? Math.abs(o - cfg.fallback) : Math.abs(o - cur);
            if (d < bestDiff) { bestDiff = d; best = i; }
        });
        setActive(best, 'center');
    }

    function close() {
        menu.hidden = true;
        stopPositioning();
        input.setAttribute('aria-expanded', 'false');
        active = -1;
    }

    function choose(i) {
        setValue(cfg.options[i]);
        close();
    }

    function commit() {
        var r = cfg.parse(input.value);
        if (typeof r === 'number' && isNaN(r)) {
            setError(cfg.error || 'Invalid value');
            return false;
        }
        if (r == null && !cfg.allowEmpty) r = cfg.fallback;
        setValue(r);
        return true;
    }

    field._tkCommit = commit;
    setValue(cfg.value);
    var modal = field.closest('.modal');
    if (modal) modal.addEventListener('hide.bs.modal', close, { once: true });

    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () {
        input.focus();
        if (isOpen()) close(); else open();
    });
    input.addEventListener('click', function () { if (!isOpen()) open(); });
    input.addEventListener('input', function () { setError('') });
    input.addEventListener('blur', function () { commit(); close(); });
    menu.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var opt = e.target.closest('.sch-time-opt');
        if (opt) choose(parseInt(opt.dataset.i, 10));
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen()) { open(); return; }
            setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen() && active >= 0) choose(active);
            else commit();
        } else if (e.key === 'Escape' && isOpen()) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    });
}

function tkInitTaskTimeFields(t) {
    TimeField.init(document.getElementById('taskModalBody'));
    var est = document.querySelector('.sch-time-field[data-time-key="Est"]');
    if (est) tkInitTimeField(est, {
        options: TK_EST_OPTIONS,
        value: t && t.timeEstimate ? t.timeEstimate : null,
        fallback: 60,
        allowEmpty: true,
        format: tkFmtDuration,
        parse: tkParseDuration,
        error: "Couldn't read that estimate. Try 45m, 1h 30m or 90, or pick from the list.",
        sub: function (o) { return o + ' min'; }
    });
}

// Add/Edit Modal

function openTaskModal(id, prefillTitle, presetDate) {
    ensureTaskModal();
    var semId = DB.getActiveSemesterId();
    var t = id ? DB.getTasks().find(function (x) { return x.id === id && x.semesterId === semId; }) : null;
    if (id && !t) {
        Toast.show('That task is not in the selected semester.', 'high', 'icon-lucide-calendar-x-2');
        return;
    }
    var isEdit = !!t;
    if (!isEdit && !semId) {
        Toast.show('The university has not configured an active academic period yet.', 'high', 'icon-lucide-calendar-x-2');
        return;
    }
    document.getElementById('taskModalTitle').textContent = t ? 'Edit Task' : 'Add Task';
    var subs = DB.getSubjects().filter(function (s) { return semId && s.semesterId === semId; });
    var checklist = t && t.checklist ? t.checklist : [];
    var CATEGORIES = ['Academic', 'Assignment', 'Project', 'Exam', 'Quiz', 'Homework', 'Personal', 'Organization', 'Other'];
    var PRIORITIES = ['low', 'medium', 'high'];
    var REPEATS = [
        { value: 'none', label: 'None', desc: '' },
        { value: 'daily', label: 'Daily', desc: 'Repeat this task every day.' },
        { value: 'weekly', label: 'Weekly', desc: 'Repeat this task every week.' },
        { value: 'monthly', label: 'Monthly', desc: 'Repeat this task every month.' },
    ];
    var curRepeat = t ? (t.repeat || 'none') : 'none';
    var repeatOptions = REPEATS.map(function (r) {
        return '<option value="' + r.value + '" ' + (curRepeat === r.value ? 'selected' : '') + ' data-desc="' + r.desc + '">' + r.label + '</option>';
    }).join('');
    var repeatDesc = REPEATS.find(function (r) { return r.value === curRepeat; });
    var repeatDescHtml = (repeatDesc && repeatDesc.desc)
        ? '<div class="tk-repeat-hint" id="tRepeatHint">' + repeatDesc.desc + '</div>'
        : '<div class="tk-repeat-hint" id="tRepeatHint" style="display:none"></div>';
    var te = t && t.timeEstimate ? teHrsMins(t.timeEstimate) : { hrs: 0, mins: 0 };
    var scoreVal = (t && t.score !== null && t.score !== undefined) ? t.score : '';
    var remarksVal = t ? (t.remarks || '') : '';
    var createdNote = t ? '<div class="col-12"><div class="tk-modal-created-note"><i class="icon-lucide-clock" aria-hidden="true"></i> Created ' +
        new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
        new Date(t.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '</div></div>' : '';
    var parentNote = t && t.parentTaskId ? '<div class="col-12"><div class="tk-repeat-hint"><i class="icon-lucide-repeat me-1" aria-hidden="true"></i>This is a recurring instance of another task.</div></div>' : '';
    document.getElementById('taskModalBody').innerHTML =
        '<div class="row g-2">' +
            '<input type="hidden" id="tId" value="' + (t ? t.id : '') + '">' +
            '<div class="col-12"><label class="form-label">Task Title *</label>' +
            '<input class="form-control" id="tTitle" value="' + (t ? escHtml(t.title) : (prefillTitle ? escHtml(prefillTitle) : '')) + '" placeholder="What needs to be done?" autocomplete="off"></div>' +
            '<div class="col-12"><label class="form-label">Description</label>' +
            '<textarea class="form-control" id="tDesc" rows="2" placeholder="Optional details…">' + (t ? escHtml(t.description || '') : '') + '</textarea></div>' +
            '<div class="col-6 col-md-4"><label class="form-label">Category</label><select class="form-select" id="tCategory">' +
            CATEGORIES.map(function (c) { return '<option ' + (t && t.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
            '<div class="col-6 col-md-4"><label class="form-label">Subject</label><select class="form-select" id="tSubject">' +
            '<option value="">None</option>' +
            subs.map(function (s) { return '<option value="' + s.id + '" ' + (t && t.subjectId === s.id ? 'selected' : '') + '>' + escHtml(s.code) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="col-6 col-md-4"><label class="form-label">Priority</label><select class="form-select" id="tPriority">' +
            PRIORITIES.map(function (p) { return '<option value="' + p + '" ' + (t && t.priority === p ? 'selected' : '') + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>'; }).join('') + '</select></div>' +
            '<div class="col-6 col-md-4"><label class="form-label">Due Date</label><input type="date" class="form-control" id="tDueDate" value="' + (t ? t.dueDate : (presetDate || todayKey())) + '"></div>' +
            '<div class="col-6 col-md-4">' + TimeField.html({ id: 'tDueTime', label: 'Due Time', labelClass: 'form-label',
            value: t ? (t.dueTime || '23:59') : '23:59', placeholder: '11:59 PM', fallback: '23:59' }) + '</div>' +
            '<div class="col-6 col-md-4"><label class="form-label">Repeat</label><select class="form-select" id="tRepeat" onchange="updateRepeatHint(this)">' + repeatOptions + '</select>' + repeatDescHtml + '</div>' +
            '<div class="col-6 col-md-4"><label class="form-label" for="tEst">Time Estimate</label>' +
            tkTimeFieldHtml('Est', 'tEst', 'e.g. 1h 30m', 'Choose time estimate') + '</div>' +
            (isEdit ? '<div class="col-6 col-md-4"><label class="form-label">Score (%)</label><input type="number" class="form-control" id="tScore" min="0" max="100" step="0.01" placeholder="e.g. 85" value="' + escHtml(String(scoreVal)) + '"></div>' : '') +
            (isEdit ? '<div class="col-' + (isEdit ? '6 col-md-8' : '12') + '"><label class="form-label">Remarks</label><input type="text" class="form-control" id="tRemarks" placeholder="Optional feedback or remarks…" value="' + escHtml(remarksVal) + '"></div>' : '') +
            '<div class="col-12 mt-1"><label class="form-label">Checklist</label>' +
            '<div id="modalChecklistWrap" class="tk-modal-cl-wrap">' +
            checklist.map(function (c, i) { return modalClItemHtml(c, i); }).join('') +
            '</div><button type="button" class="tk-cl-add-btn mt-1" onclick="modalAddClItem()"><i class="icon-lucide-plus" aria-hidden="true"></i> Add item</button></div>' +
            createdNote + parentNote +
            '</div>' +
            '<div class="modal-actions"><button class="btn btn-accent w-100" onclick="saveTask()">' +
            '<i class="icon-lucide-check me-1" aria-hidden="true"></i>' + (t ? 'Update Task' : 'Save Task') + '</button></div>';

    tkInitTaskTimeFields(t);
    new bootstrap.Modal(document.getElementById('taskModal')).show();
}

function updateRepeatHint(sel) {
    var hint = document.getElementById('tRepeatHint');
    if (!hint)
        return;
    var desc = sel.options[sel.selectedIndex].dataset.desc || '';
    hint.textContent = desc;
    hint.style.display = desc ? '' : 'none';
}

function modalClItemHtml(c, i) {
    return '<div class="tk-modal-cl-row" data-i="' + i + '">' +
        '<input type="checkbox" class="form-check-input" ' + (c.done ? 'checked' : '') + ' aria-label="Item done">' +
        '<input type="text" class="form-control form-control-sm" value="' + escHtml(c.text) + '" placeholder="Item…" aria-label="Checklist item">' +
        '<button type="button" class="btn-icon btn-sm" style="flex-shrink:0" onclick="this.closest(\'.tk-modal-cl-row\').remove()" aria-label="Remove item"><i class="icon-lucide-x" style="font-size:.8rem" aria-hidden="true"></i></button>' +
        '</div>';
}

function modalAddClItem() {
    var wrap = document.getElementById('modalChecklistWrap');
    var i = wrap.children.length;
    wrap.insertAdjacentHTML('beforeend', modalClItemHtml({ text: '', done: false }, i));
    wrap.lastElementChild.querySelector('input[type=text]').focus();
}

let tkSaving = false;
async function saveTask() {
    // Re-entrancy guard: the Save button is a plain onclick, and
    // bootstrap's modal hide() is a non-blocking fade, so a rapid
    // double-click can invoke this function twice before the modal is
    // actually gone — which would push two new tasks for one click.
    if (tkSaving) return;
    var title = document.getElementById('tTitle').value.trim();
    if (!title) {
        Toast.show('Please enter a title', 'high', 'icon-lucide-triangle-alert');
        return;
    }
    if (!TimeField.validate(['tDueTime'])) return;
    var estField = document.querySelector('.sch-time-field[data-time-key="Est"]');
    if (estField && !estField._tkCommit()) {
        estField.querySelector('.sch-time-input').focus();
        return;
    }
    tkSaving = true;
    var saveButton = document.querySelector('#taskModalBody .modal-actions button');
    if (saveButton) { saveButton.disabled = true; saveButton.setAttribute('aria-busy', 'true'); }
    var timeEstimate = estField ? (estField._tkValue || null) : null;
    var checklist = Array.from(document.querySelectorAll('.tk-modal-cl-row')).map(function (row) {
        return { done: row.querySelector('input[type=checkbox]').checked, text: row.querySelector('input[type=text]').value.trim() };
    }).filter(function (c) { return c.text; });
    var idInput = document.getElementById('tId');
    var id = idInput.value;
    var tasks = DB.getTasks();
    var repeatEl = document.getElementById('tRepeat');
    var scoreEl = document.getElementById('tScore');
    var remarksEl = document.getElementById('tRemarks');
    var data = {
        title: title,
        description: document.getElementById('tDesc').value.trim(),
        subjectId: document.getElementById('tSubject').value || null,
        category: document.getElementById('tCategory').value,
        priority: document.getElementById('tPriority').value,
        dueDate: document.getElementById('tDueDate').value,
        dueTime: TimeField.get('tDueTime') || '23:59',
        checklist: checklist,
        repeat: repeatEl ? repeatEl.value : 'none',
        timeEstimate: timeEstimate,
        updatedAt: Date.now(),
        score: scoreEl && scoreEl.value !== '' ? parseFloat(scoreEl.value) : (id ? (tasks.find(function (x) { return x.id === id; }) || {}).score || null : null),
        remarks: remarksEl ? remarksEl.value.trim() : (id ? (tasks.find(function (x) { return x.id === id; }) || {}).remarks || '' : ''),
    };
    data.progress = computeProgressFromChecklist(checklist, id ? ((tasks.find(function (x) { return x.id === id; }) || {}).progress || 0) : 0);
    if (data.progress === 100)
        data.status = 'completed';
    else if (data.progress > 0)
        data.status = 'in-progress';
    else
        data.status = 'not-started';
    if (!id) {
        id = DB.uid();
        idInput.value = id;
    }
    if (id) {
        var idx = tasks.findIndex(function (t) { return t.id === id; });
        var prev = idx >= 0 ? tasks[idx] : null;
        if (!prev) {
            var semId = DB.getActiveSemesterId();
            if (!semId) {
                tkSaving = false;
                if (saveButton) { saveButton.disabled = false; saveButton.removeAttribute('aria-busy'); }
                Toast.show('Select an available semester before saving this task.', 'high', 'icon-lucide-calendar-x-2');
                return;
            }
            prev = { id: id, createdAt: Date.now(), semesterId: semId, status: 'not-started', progress: 0 };
            tasks.push(prev);
        }
        var wasCompleted = prev.status === 'completed';
        var nextTask = Object.assign({}, prev, data);
        if (!wasCompleted && data.status === 'completed') {
            nextTask.completedAt = Date.now();
            fireConfetti();
        }
        if (wasCompleted && data.status !== 'completed') {
            delete nextTask.completedAt;
        }
        tasks[tasks.findIndex(function (t) { return t.id === id; })] = nextTask;
    }
    let saveError = null;
    if (typeof DB.saveTasks === 'function') {
        // Write to local storage first so the task appears immediately; cloud
        // synchronization continues in the background through cloud-sync.js.
        if (DB.saveTasks(tasks) === false) {
            saveError = new Error("Couldn't save the task on this device. Check available storage and retry.");
        }
    } else if (typeof DB.saveTasksAndSync === 'function') {
        // Compatibility for adapters that only expose the server-sync API.
        const saveResult = await DB.saveTasksAndSync(tasks);
        if (!saveResult || !saveResult.ok) saveError = saveResult && saveResult.error || new Error('Task synchronization failed.');
    } else {
        saveError = new Error('Task storage is unavailable. Please retry when the connection is restored.');
    }
    if (saveError) {
        tkSaving = false;
        if (saveButton) { saveButton.disabled = false; saveButton.removeAttribute('aria-busy'); }
        Toast.show('Task was not saved: ' + saveError.message, 'high', 'icon-lucide-cloud-off');
        return;
    }
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    Toast.show(id ? 'Task updated' : 'Task added');
    document.dispatchEvent(new CustomEvent('tasks:changed'));
    tkSaving = false;
}

function computeProgressFromChecklist(cl, fallback) {
    if (!cl || !cl.length)
        return fallback || 0;
    var done = cl.filter(function (c) { return c.done; }).length;
    return Math.round((done / cl.length) * 100);
}

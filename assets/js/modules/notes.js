/* ============================================================
   NOTES.JS — v3 Comprehensive Update
   Features: bulk-select, tags, templates, PDF export, masonry,
             note preview modal, edit button, tag input fix,
             word count, reading time, compact metadata
   ============================================================ */

/* ── State ── */
let favFilterOn = false;
let noteLinkFilter = 'all';
let noteLinkSubId = '';
let noteLinkTaskId = '';
let ntSelectMode = false;
let ntSelected = new Set();
let ntTagFilter = '';
var ntEditorSelection = null;
/* ── Templates ── */
const NOTE_TEMPLATES = {
    blank: { label: 'Blank Note', icon: 'bi-file-earmark', content: '' },
    lecture: {
        label: 'Lecture Notes',
        icon: 'bi-journal-text',
        content: '# Topic\n\n## Key Concepts\n\n- \n\n## Important Details\n\n- \n\n## Questions\n\n- \n\n## Summary\n\n- '
    },
    meeting: {
        label: 'Meeting Minutes',
        icon: 'bi-people',
        content: '# Meeting\n\nDate: \n\n## Attendees\n\n- \n\n## Agenda\n\n- \n\n## Discussion\n\n- \n\n## Decisions\n\n- \n\n## Action Items\n\n- [ ] '
    },
    study: {
        label: 'Study Plan',
        icon: 'bi-book',
        content: '# Study Plan\n\n## Goal\n\n- \n\n## Topics\n\n- [ ] \n\n## Schedule\n\n- \n\n## Resources\n\n- \n\n## Review Checklist\n\n- [ ] '
    }
};

/* ── Init ── */

function initNotes() {
    renderNotes();
    var searchEl = document.getElementById('noteSearch');
    if (searchEl)
        searchEl.addEventListener('input', debounce(renderNotes, 200));
    var catEl = document.getElementById('noteCatFilter');
    if (catEl)
        catEl.addEventListener('change', renderNotes);
    var linkEl = document.getElementById('noteLinkFilterSel');
    if (linkEl) {
        linkEl.addEventListener('change', function () {
            noteLinkFilter = this.value;
            var subDd = document.getElementById('noteSubFilterSelDd');
            var taskDd = document.getElementById('noteTaskFilterSelDd');
            if (subDd)
                subDd.style.display = (noteLinkFilter === 'subject') ? '' : 'none';
            if (taskDd)
                taskDd.style.display = (noteLinkFilter === 'task') ? '' : 'none';
            renderNotes();
        });
    }
    var subEl = document.getElementById('noteSubFilterSel');
    if (subEl)
        subEl.addEventListener('change', function () { noteLinkSubId = this.value; renderNotes(); });
    var taskEl = document.getElementById('noteTaskFilterSel');
    if (taskEl)
        taskEl.addEventListener('change', function () { noteLinkTaskId = this.value; renderNotes(); });
    populateNoteLinkFilters();
    ['noteCatFilter', 'noteLinkFilterSel'].forEach(ntSyncDropdown);
}

/* ── Filter dropdowns (popup menus driven by the hidden selects) ── */

var NT_DD = {
    noteCatFilter: { allLabel: 'Categories', icon: 'bi-tags', optIcons: { '': 'bi-grid', Homework: 'bi-pencil', Lecture: 'bi-mortarboard', Project: 'bi-kanban', Personal: 'bi-person', Organization: 'bi-folder2', Ideas: 'bi-lightbulb' } },
    noteLinkFilterSel: { allLabel: 'All Notes', icon: 'bi-journal-text', optIcons: { all: 'bi-journal-text', subject: 'bi-book', task: 'bi-list-check', unlinked: 'bi-link-45deg' } },
    noteSubFilterSel: { allLabel: 'Subject', icon: 'bi-book', optIcons: { '': 'bi-grid' }, defaultOptIcon: 'bi-book' },
    noteTaskFilterSel: { allLabel: 'Task', icon: 'bi-list-check', optIcons: { '': 'bi-grid' }, defaultOptIcon: 'bi-check2-square' }
};

function ntSyncDropdown(id) {
    var sel = document.getElementById(id);
    var menu = document.getElementById(id + 'Menu');
    var label = document.getElementById(id + 'Label');
    var icon = document.getElementById(id + 'Icon');
    var btn = document.getElementById(id + 'Btn');
    var cfg = NT_DD[id];
    if (!sel || !menu || !cfg)
        return;
    var cur = sel.value;
    var isAll = (cur === '' || cur === 'all');
    var opts = Array.prototype.slice.call(sel.options);
    menu.innerHTML = opts.map(function (o) {
        var on = o.value === cur;
        var ic = cfg.optIcons[o.value] || cfg.defaultOptIcon || 'bi-dot';
        return '<button type="button" class="dropdown-item nt-dd-option' + (on ? ' active' : '') + '" role="radio" aria-checked="' + on + '" data-value="' + escapeHtml(o.value) + '">' +
            '<i class="bi ' + ic + ' nt-dd-option-icon" aria-hidden="true"></i>' +
            '<span class="nt-dd-option-text">' + escapeHtml(o.textContent) + '</span>' +
            '<i class="bi bi-check2 nt-dd-option-check" aria-hidden="true"></i></button>';
    }).join('');
    menu.querySelectorAll('.nt-dd-option').forEach(function (b) {
        b.addEventListener('click', function () {
            sel.value = b.getAttribute('data-value');
            sel.dispatchEvent(new Event('change'));
            ntSyncDropdown(id);
        });
    });
    var curOpt = sel.options[sel.selectedIndex];
    if (label)
        label.textContent = (isAll || !curOpt) ? cfg.allLabel : curOpt.textContent;
    if (icon)
        icon.className = 'bi nt-dd-icon ' + (cfg.optIcons[cur] && !isAll ? cfg.optIcons[cur] : cfg.icon);
    if (btn)
        btn.classList.toggle('nt-dd-btn-active', !isAll);
}

function populateNoteLinkFilters() {
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    var subSel = document.getElementById('noteSubFilterSel');
    var taskSel = document.getElementById('noteTaskFilterSel');
    if (!subSel || !taskSel)
        return;
    var prevSubVal = subSel.value;
    var prevTaskVal = taskSel.value;
    subSel.innerHTML = '<option value="">All Subjects</option>' +
        subs.map(function (s) { return '<option value="' + s.id + '"' + (prevSubVal === s.id ? ' selected' : '') + '>' + escapeHtml(s.code || s.name) + '</option>'; }).join('');
    taskSel.innerHTML = '<option value="">All Tasks</option>' +
        tasks.map(function (t) { return '<option value="' + t.id + '"' + (prevTaskVal === t.id ? ' selected' : '') + '>' + escapeHtml(t.title) + '</option>'; }).join('');
    ntSyncDropdown('noteSubFilterSel');
    ntSyncDropdown('noteTaskFilterSel');
}

/* ── Favorites filter ── */

function toggleFavFilter() {
    favFilterOn = !favFilterOn;
    var btn = document.getElementById('favFilterBtn');
    if (btn) {
        btn.classList.toggle('nt-icon-btn-active', favFilterOn);
        btn.querySelector('i').className = favFilterOn ? 'bi bi-star-fill' : 'bi bi-star';
        btn.title = favFilterOn ? 'Show all notes' : 'Favorites only';
    }
    renderNotes();
}

function clearNoteFilters() {
    ['noteSearch', 'noteCatFilter', 'noteSubFilterSel', 'noteTaskFilterSel'].forEach(function (id) {
        var control = document.getElementById(id);
        if (control)
            control.value = '';
    });
    var linkFilter = document.getElementById('noteLinkFilterSel');
    if (linkFilter)
        linkFilter.value = 'all';
    noteLinkFilter = 'all';
    noteLinkSubId = '';
    noteLinkTaskId = '';
    ntTagFilter = '';
    favFilterOn = false;
    var favButton = document.getElementById('favFilterBtn');
    if (favButton) {
        favButton.classList.remove('nt-icon-btn-active');
        var icon = favButton.querySelector('i');
        if (icon)
            icon.className = 'bi bi-star';
        favButton.title = 'Favorites only';
    }
    var subjectFilter = document.getElementById('noteSubFilterSelDd');
    var taskFilter = document.getElementById('noteTaskFilterSelDd');
    if (subjectFilter)
        subjectFilter.style.display = 'none';
    if (taskFilter)
        taskFilter.style.display = 'none';
    ['noteCatFilter', 'noteLinkFilterSel', 'noteSubFilterSel', 'noteTaskFilterSel'].forEach(ntSyncDropdown);
    renderNotes();
}

/* ── Select mode ── */

function enterSelectMode() {
    ntSelectMode = true;
    ntSelected.clear();
    var btn = document.getElementById('ntSelectBtn');
    if (btn) {
        btn.classList.add('nt-icon-btn-active');
        btn.title = 'Exit selection mode';
        btn.setAttribute('aria-label', 'Exit selection mode');
    }
    renderNotes();
}

function exitSelectMode() {
    ntSelectMode = false;
    ntSelected.clear();
    var btn = document.getElementById('ntSelectBtn');
    if (btn) {
        btn.classList.remove('nt-icon-btn-active');
        btn.title = 'Select notes';
        btn.setAttribute('aria-label', 'Select notes');
    }
    renderNotes();
}

function toggleSelectMode() {
    if (ntSelectMode)
        exitSelectMode();
    else
        enterSelectMode();
}

function toggleNoteSelect(id) {
    if (ntSelected.has(id))
        ntSelected.delete(id);
    else
        ntSelected.add(id);
    renderNotes();
}

function selectAllVisible() {
    var list = getFilteredNotes();
    var ids = list.map(function (n) { return n.id; });
    var allSel = ids.length > 0 && ids.every(function (id) { return ntSelected.has(id); });
    ids.forEach(function (id) { if (allSel)
        ntSelected.delete(id);
    else
        ntSelected.add(id); });
    renderNotes();
}

/* ── Bulk toolbar ── */

function renderNtBulkToolbar() {
    var existing = document.getElementById('ntBulkToolbar');
    if (existing)
        existing.remove();
    if (!ntSelectMode || ntSelected.size === 0)
        return;
    var count = ntSelected.size;
    var visibleIds = getFilteredNotes().map(function (n) { return n.id; });
    var allSel = visibleIds.length > 0 && visibleIds.every(function (id) { return ntSelected.has(id); });
    var allLabel = allSel ? 'Deselect all' : 'Select all';
    var wrap = document.createElement('div');
    wrap.id = 'ntBulkToolbar';
    wrap.className = 'nt-bulk-toolbar fade-in';
    wrap.setAttribute('aria-label', 'Note bulk actions');
    wrap.innerHTML =
        '<span class="nt-bulk-count"><i class="bi bi-check2-square"></i>' + count + ' selected</span>' +
            '<div class="nt-bulk-actions">' +
            '<button class="nt-bulk-btn nt-bulk-all' + (allSel ? ' nt-bulk-all-active' : '') + '" onclick="selectAllVisible()" aria-label="' + allLabel + ' notes" title="' + allLabel + '"><i class="bi ' + (allSel ? 'bi-check2-square' : 'bi-check2-all') + '"></i><span>' + (allSel ? 'None' : 'All') + '</span></button>' +
            '<button class="nt-bulk-btn nt-bulk-fav" onclick="bulkFavoriteNotes(true)" aria-label="Favorite selected notes" title="Favorite"><i class="bi bi-star-fill"></i><span>Fav</span></button>' +
            '<button class="nt-bulk-btn nt-bulk-unfav" onclick="bulkFavoriteNotes(false)" aria-label="Unfavorite selected notes" title="Unfavorite"><i class="bi bi-star"></i><span>Unfav</span></button>' +
            '<button class="nt-bulk-btn nt-bulk-delete" onclick="bulkDeleteNotes()" aria-label="Delete selected notes" title="Delete"><i class="bi bi-trash"></i><span>Delete</span></button>' +
            '<button class="nt-bulk-btn nt-bulk-clear" onclick="exitSelectMode()" aria-label="Exit selection mode" title="Done"><i class="bi bi-x-lg"></i></button>' +
            '</div>';
    var grid = document.getElementById('notesGrid');
    if (grid)
        grid.parentNode.insertBefore(wrap, grid);
}

/* ── Bulk actions ── */

function bulkFavoriteNotes(setFav) {
    var notes = DB.getNotes();
    var ids = Array.from(ntSelected);
    ids.forEach(function (id) {
        var n = notes.find(function (x) { return x.id === id; });
        if (n) {
            n.favorite = setFav;
            n.updatedAt = Date.now();
        }
    });
    DB.saveNotes(notes);
    ntSelected.clear();
    Toast.show(setFav ? 'Added to favorites' : 'Removed from favorites');
    renderNotes();
}

function bulkDeleteNotes() {
    var count = ntSelected.size;
    confirmAction({
        title: 'Delete ' + count + ' note' + (count !== 1 ? 's' : '') + '?',
        message: 'This will permanently remove the selected notes.',
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill',
        onConfirm: function () {
            var ids = Array.from(ntSelected);
            DB.saveNotes(DB.getNotes().filter(function (n) { return !ids.includes(n.id); }));
            ntSelected.clear();
            exitSelectMode();
            Toast.show(count + ' note' + (count !== 1 ? 's' : '') + ' deleted');
            renderNotes();
        }
    });
}

/* ── Filtering ── */

function getFilteredNotes() {
    var q = (document.getElementById('noteSearch') || {}).value || '';
    q = q.toLowerCase().trim();
    var cat = (document.getElementById('noteCatFilter') || {}).value || '';
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    var list = DB.getNotes().filter(function (n) { return n.semesterId === semId; });
    if (q) {
        list = list.filter(function (n) {
            var sub = n.subjectId ? subs.find(function (s) { return s.id === n.subjectId; }) : null;
            var task = n.taskId ? tasks.find(function (t) { return t.id === n.taskId; }) : null;
            var tags = (n.tags || []).join(' ').toLowerCase();
            var subName = sub ? (sub.code || sub.name || '').toLowerCase() : '';
            var taskName = task ? (task.title || '').toLowerCase() : '';
            return n.title.toLowerCase().includes(q) ||
                (n.content || '').toLowerCase().includes(q) ||
                (n.category || '').toLowerCase().includes(q) ||
                tags.includes(q) ||
                subName.includes(q) ||
                taskName.includes(q);
        });
    }
    if (cat)
        list = list.filter(function (n) { return n.category === cat; });
    if (favFilterOn)
        list = list.filter(function (n) { return n.favorite; });
    if (ntTagFilter)
        list = list.filter(function (n) { return (n.tags || []).some(function (t) { return t.toLowerCase() === ntTagFilter.toLowerCase(); }); });
    if (noteLinkFilter === 'subject') {
        list = list.filter(function (n) { return noteLinkSubId ? n.subjectId === noteLinkSubId : !!n.subjectId; });
    }
    else if (noteLinkFilter === 'task') {
        list = list.filter(function (n) { return noteLinkTaskId ? n.taskId === noteLinkTaskId : !!n.taskId; });
    }
    else if (noteLinkFilter === 'unlinked') {
        list = list.filter(function (n) { return !n.subjectId && !n.taskId; });
    }
    list.sort(function (a, b) { return (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt); });
    return list;
}

/* ── Word count + reading time ── */

function calcWordCount(content) {
    if (!content)
        return 0;
    var text = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]+`/g, ' ')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/[*_~`>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[-*] \[[ x]\] /gm, '')
        .replace(/^[-*+] /gm, '')
        .replace(/^\d+\. /gm, '')
        .trim();
    if (!text)
        return 0;
    return text.split(/\s+/).filter(function (w) { return w.length > 0; }).length;
}

function calcReadingTime(words) {
    var mins = Math.max(1, Math.ceil(words / 200));
    return mins + ' min read';
}

/* ── Card preview (short excerpt) ── */

function mdCardPreview(content) {
    var text = (content || '')
        .replace(/```[\s\S]*?```/g, '[code]')
        .replace(/`[^`]+`/g, '[code]')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^- \[[ x]\] /gm, '')
        .replace(/^[-*] /gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
    return escapeHtml(text.slice(0, 140)) + (text.length > 140 ? '…' : '');
}

/* ── Render notes grid (masonry) ── */

function renderNotes() {
    populateNoteLinkFilters();
    renderNtBulkToolbar();
    var wrap = document.getElementById('notesGrid');
    var list = getFilteredNotes();
    if (!list.length) {
        var semId = DB.getActiveSemesterId();
        var hasSemesterNotes = DB.getNotes().some(function (note) { return note.semesterId === semId; });
        var emptyMessage = hasSemesterNotes
            ? '<p>No notes match your current filters.</p><button type="button" class="btn btn-ghost btn-sm" onclick="clearNoteFilters()">Clear filters</button>'
            : '<p>No notes found. Create your first note!</p><button type="button" class="btn btn-ghost btn-sm" onclick="openNoteModal()">Create note</button>';
        wrap.innerHTML = '<div class="nt-empty glass card-pad text-center text-faint"><i class="bi bi-journal-x" style="font-size:2rem;display:block;margin-bottom:8px;opacity:.4" aria-hidden="true"></i>' + emptyMessage + '</div>';
        return;
    }
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    wrap.innerHTML = list.map(function (n) {
        var sub = n.subjectId ? subs.find(function (s) { return s.id === n.subjectId; }) : null;
        var task = n.taskId ? tasks.find(function (t) { return t.id === n.taskId; }) : null;
        var taskBroken = n.taskId && !task;
        var isSelected = ntSelected.has(n.id);
        var tags = n.tags || [];
        // Word count
        var wc = calcWordCount(n.content);
        var wcHtml = '<span class="nt-card-wc">' + (wc > 0 ? wc.toLocaleString() + ' words · ' + calcReadingTime(wc) : 'Empty note') + '</span>';
        var preview = mdCardPreview(n.content);
        var date = new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        // Bottom meta row: subject code · task · tags (all inline)
        var bottomMeta = '';
        var bottomParts = [];
        if (sub)
            bottomParts.push('<span class="nt-bm-sub"><i class="bi bi-book"></i>' + escapeHtml(sub.code || sub.name) + '</span>');
        if (task)
            bottomParts.push('<span class="nt-bm-task"><i class="bi bi-arrow-up-right-square"></i>' + escapeHtml(task.title) + '</span>');
        if (taskBroken)
            bottomParts.push('<span class="nt-bm-broken">Task unavailable</span>');
        if (tags.length > 0) {
            var visibleTags2 = tags.slice(0, 3);
            var hiddenCount2 = tags.length - visibleTags2.length;
            visibleTags2.forEach(function (t) { bottomParts.push('<span class="nt-bm-tag">' + escapeHtml(t) + '</span>'); });
            if (hiddenCount2 > 0)
                bottomParts.push('<span class="nt-bm-more">+' + hiddenCount2 + '</span>');
        }
        if (bottomParts.length > 0) {
            bottomMeta = '<div class="nt-card-bottom-meta">' + bottomParts.join('') + '</div>';
        }
        return '<div class="nt-masonry-item' + (isSelected ? ' nt-note-selected' : '') + '" id="ntCard_' + n.id + '">' +
            '<div class="glass note-card" data-noteid="' + n.id + '">' +
            '<div class="note-card-header">' +
            (ntSelectMode ? '<button class="nt-select-check' + (isSelected ? ' selected' : '') + '" onclick="event.stopPropagation();toggleNoteSelect(\'' + n.id + '\')" aria-label="' + (isSelected ? 'Deselect' : 'Select') + ' note" title="' + (isSelected ? 'Deselect' : 'Select') + '">' + (isSelected ? '<i class="bi bi-check-lg"></i>' : '') + '</button>' : '') +
            '<div class="note-card-title-wrap">' +
            (n.pinned ? '<i class="bi bi-pin-angle-fill note-pin" title="Pinned" aria-hidden="true"></i>' : '') +
            '<span class="note-card-title">' + escapeHtml(n.title) + '</span>' +
            '</div>' +
            '<div class="nt-card-actions">' +
            '<span class="nt-card-cat-pill">' + escapeHtml(n.category) + '</span>' +
            '<button class="nt-card-action-box ' + (n.favorite ? 'nt-fav-active' : '') + '" onclick="event.stopPropagation();toggleFavorite(\'' + n.id + '\')" title="' + (n.favorite ? 'Unfavorite' : 'Favorite') + '" aria-label="' + (n.favorite ? 'Remove from favorites' : 'Add to favorites') + '"><i class="bi ' + (n.favorite ? 'bi-star-fill' : 'bi-star') + '"></i></button>' +
            '<button class="nt-card-action-box" onclick="event.stopPropagation();openNoteModal(\'' + n.id + '\')" title="Edit note" aria-label="Edit note"><i class="bi bi-pencil"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="note-preview-text">' + preview + '</div>' +
            bottomMeta +
            '<div class="note-card-footer">' +
            wcHtml +
            '<span class="note-footer-date">' + date + '</span>' +
            '</div>' +
            '</div></div>';
    }).join('');
    // Attach card-body / preview-text click → open preview
    wrap.querySelectorAll('.note-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            // Only trigger if clicking the card body or preview text (not buttons/chips)
            var isButton = e.target.closest('button') || e.target.closest('.nt-card-action-box') || e.target.closest('.nt-select-check');
            var isInteractive = e.target.closest('.nt-card-actions') || e.target.closest('.nt-card-cat-pill');
            if (isButton || isInteractive)
                return;
            var noteId = card.dataset.noteid;
            if (ntSelectMode) {
                toggleNoteSelect(noteId);
            }
            else {
                openNotePreview(noteId);
            }
        });
    });
}

/* ── Toggle favorite ── */

function toggleFavorite(id) {
    var notes = DB.getNotes();
    var n = notes.find(function (x) { return x.id === id; });
    if (!n)
        return;
    n.favorite = !n.favorite;
    DB.saveNotes(notes);
    renderNotes();
}

/* ── Note Preview Modal ── */

function openNotePreview(id) {
    var notes = DB.getNotes();
    var n = notes.find(function (x) { return x.id === id; });
    if (!n)
        return;
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    var sub = n.subjectId ? subs.find(function (s) { return s.id === n.subjectId; }) : null;
    var task = n.taskId ? tasks.find(function (t) { return t.id === n.taskId; }) : null;
    var tags = n.tags || [];
    var wc = calcWordCount(n.content);
    var metaHtml = '';
    if (sub)
        metaHtml += '<span class="nt-prev-meta-item"><i class="bi bi-book"></i>' + escapeHtml(sub.code || sub.name) + '</span>';
    if (task)
        metaHtml += '<span class="nt-prev-meta-item"><i class="bi bi-arrow-up-right-square"></i>' + escapeHtml(task.title) + '</span>';
    var tagHtml = tags.length > 0
        ? '<div class="nt-prev-tags">' + tags.map(function (t) { return '<span class="nt-tag-chip">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
        : '';
    var wcHtml = wc > 0 ? '<span class="nt-prev-wc"><i class="bi bi-text-paragraph"></i>' + wc.toLocaleString() + ' words · ' + calcReadingTime(wc) + '</span>' : '';
    var dateHtml = n.createdAt ? '<span class="nt-prev-wc"><i class="bi bi-calendar3"></i>Updated ' + new Date(n.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + '</span>' : '';
    var existing = document.getElementById('ntPreviewOverlay');
    if (existing)
        existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'ntPreviewOverlay';
    overlay.className = 'nt-preview-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Note preview');
    overlay.innerHTML =
        '<div class="nt-preview-backdrop" onclick="closeNotePreview()"></div>' +
            '<div class="nt-preview-panel">' +
            '<div class="nt-preview-header">' +
            '<div class="nt-preview-title-wrap">' +
            (n.pinned ? '<i class="bi bi-pin-angle-fill nt-preview-pin" aria-hidden="true"></i>' : '') +
            '<h2 class="nt-preview-title">' + escapeHtml(n.title) + '</h2>' +
            '</div>' +
            '<div class="nt-preview-header-actions">' +
            '<button class="nt-preview-action-btn" onclick="closeNotePreview();openNoteModal(\'' + n.id + '\')" aria-label="Edit note" title="Edit note"><i class="bi bi-pencil"></i></button>' +
            '<button class="nt-preview-action-btn" onclick="exportNotePdf(\'' + n.id + '\')" aria-label="Export PDF" title="Export PDF"><i class="bi bi-file-earmark-pdf"></i></button>' +
            '<button class="nt-preview-close" onclick="closeNotePreview()" aria-label="Close preview"><i class="bi bi-x-lg"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="nt-preview-submeta">' +
            '<span class="nt-prev-cat">' + escapeHtml(n.category) + '</span>' +
            tagHtml +
            (metaHtml ? '<div class="nt-prev-links">' + metaHtml + '</div>' : '') +
            '<div class="nt-prev-stats">' + wcHtml + dateHtml + '</div>' +
            '</div>' +
            '<div class="nt-preview-content" id="ntPreviewContent">' +
            renderMarkdown(n.content, n.id) +
            '</div>' +
            '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    // Trap focus / close on Escape
    overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape')
            closeNotePreview();
    });
    setTimeout(function () {
        var closeBtn = overlay.querySelector('.nt-preview-close');
        if (closeBtn)
            closeBtn.focus();
    }, 100);
}

function closeNotePreview() {
    var overlay = document.getElementById('ntPreviewOverlay');
    if (!overlay)
        return;
    overlay.classList.remove('open');
    setTimeout(function () { if (overlay.parentNode)
        overlay.parentNode.removeChild(overlay); }, 280);
}

/* ── Markdown renderer (unchanged + checklist toggling) ── */

function renderMarkdown(src, noteId, forEditor) {
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var output = [];
    var paragraph = [];

    function inline(text) {
        var code = [];
        var escaped = [];
        var html = escapeHtml(text).replace(/\\([\\`*_{}\[\]()#+.!>-])/g, function (match, character) {
            var token = '\u0002' + escaped.length + '\u0002';
            escaped.push(character);
            return token;
        }).replace(/`([^`]+)`/g, function (match, content) {
            var token = '\u0001' + code.length + '\u0001';
            code.push('<code class="md-inline-code">' + content + '</code>');
            return token;
        });
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (match, label, href) {
                if (!/^(https?:|mailto:|\/|#|\.{1,2}\/)/i.test(href))
                    return label;
                return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
            });
        code.forEach(function (fragment, index) {
            html = html.replace('\u0001' + index + '\u0001', fragment);
        });
        escaped.forEach(function (character, index) {
            html = html.replace('\u0002' + index + '\u0002', escapeHtml(character));
        });
        return html;
    }

    function flushParagraph() {
        if (paragraph.length) {
            output.push('<p class="md-p">' + paragraph.map(inline).join('<br>') + '</p>');
            paragraph = [];
        }
    }

    for (var index = 0; index < lines.length;) {
        var line = lines[index];
        var fence = line.match(/^\s*```/);
        var heading = line.match(/^(#{1,3})\s+(.+)$/);
        var checklist = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        var ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        var bullet = line.match(/^\s*[-*]\s+(.*)$/);

        if (!line.trim()) {
            flushParagraph();
            index++;
            continue;
        }
        if (fence) {
            flushParagraph();
            var codeLines = [];
            index++;
            while (index < lines.length && !/^\s*```\s*$/.test(lines[index]))
                codeLines.push(lines[index++]);
            if (index < lines.length)
                index++;
            output.push('<pre class="md-code-block"><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
            continue;
        }
        if (heading) {
            flushParagraph();
            var headingLevel = heading[1].length + 3;
            output.push('<h' + headingLevel + ' class="md-h">' + inline(heading[2]) + '</h' + headingLevel + '>');
            index++;
            continue;
        }
        if (checklist) {
            flushParagraph();
            var checklistItems = [];
            while (index < lines.length) {
                var checkItem = lines[index].match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
                if (!checkItem)
                    break;
                var checked = checkItem[1].toLowerCase() === 'x';
                var click = noteId ? ' onclick="toggleNoteChecklistItem(\'' + escapeHtml(noteId) + '\', this, ' + checked + ', ' + index + ')"' : '';
                var checklistContent = inline(checkItem[2]);
                if (forEditor) {
                    checklistItems.push('<li class="md-checklist-item' + (checked ? ' md-checked' : '') + '"><input class="md-checklist-input" type="checkbox" contenteditable="false"' + (checked ? ' checked' : '') + ' aria-label="' + (checked ? 'Mark checklist item incomplete' : 'Mark checklist item complete') + '"><span class="md-cl-text' + (checked ? ' md-cl-done' : '') + '">' + checklistContent + '</span></li>');
                } else {
                    checklistItems.push('<li class="md-checklist-item' + (checked ? ' md-checked' : '') + '"' + click + '><span class="md-cl-box' + (checked ? ' md-cl-checked' : '') + '" aria-hidden="true"></span><span class="md-cl-text' + (checked ? ' md-cl-done' : '') + '">' + checklistContent + '</span></li>');
                }
                index++;
            }
            output.push('<ul class="md-ul md-checklist">' + checklistItems.join('') + '</ul>');
            continue;
        }
        if (ordered) {
            flushParagraph();
            var orderedItems = [];
            var listStart = Number(ordered[1]);
            while (index < lines.length) {
                var orderedItem = lines[index].match(/^\s*(\d+)[.)]\s+(.*)$/);
                if (!orderedItem)
                    break;
                orderedItems.push('<li>' + inline(orderedItem[2]) + '</li>');
                index++;
            }
            output.push('<ol' + (listStart === 1 ? '' : ' start="' + listStart + '"') + '>' + orderedItems.join('') + '</ol>');
            continue;
        }
        if (bullet) {
            flushParagraph();
            var bulletItems = [];
            while (index < lines.length) {
                var bulletItem = lines[index].match(/^\s*[-*]\s+(.*)$/);
                if (!bulletItem || /^\[[ xX]\]\s+/.test(bulletItem[1]))
                    break;
                bulletItems.push('<li class="md-li">' + inline(bulletItem[1]) + '</li>');
                index++;
            }
            output.push('<ul class="md-ul">' + bulletItems.join('') + '</ul>');
            continue;
        }
        paragraph.push(line);
        index++;
    }
    flushParagraph();
    return output.join('\n');
}

function toggleNoteChecklistItem(noteId, el, currentlyChecked, sourceLineIndex) {
    var notes = DB.getNotes();
    var n = notes.find(function (x) { return x.id === noteId; });
    if (!n)
        return;
    var changed = false;
    var lines = n.content.split('\n');
    n.content = lines.map(function (line, index) {
        var item = line.match(/^([-*])\s+\[([ xX])\]\s+(.*)$/);
        var matchesTarget = Number.isInteger(sourceLineIndex)
            ? index === sourceLineIndex
            : item && (el.querySelector('.md-cl-text') || {}).textContent === item[3];
        if (!changed && matchesTarget && item && (item[2].toLowerCase() === 'x') === currentlyChecked) {
            changed = true;
            return item[1] + (currentlyChecked ? ' [ ] ' : ' [x] ') + item[3];
        }
        return line;
    }).join('\n');
    if (changed) {
        n.updatedAt = Date.now();
        DB.saveNotes(notes);
        var previewEl = document.getElementById('nPreview');
        if (previewEl)
            previewEl.innerHTML = renderMarkdown(n.content, n.id);
        var previewContent = document.getElementById('ntPreviewContent');
        if (previewContent)
            previewContent.innerHTML = renderMarkdown(n.content, n.id);
        var ta = document.getElementById('nContent');
        if (ta) {
            ta.innerHTML = renderMarkdown(n.content, null, true);
            updateNotePreview();
        }
    }
}

/* ── Markdown toolbar ── */

function saveNoteEditorSelection(editor) {
    if (!editor)
        return;
    var selection = window.getSelection();
    if (selection && selection.rangeCount && editor.contains(selection.anchorNode)) {
        ntEditorSelection = { editor: editor, range: selection.getRangeAt(0).cloneRange() };
    }
}

function restoreNoteEditorSelection(editor) {
    if (!ntEditorSelection || ntEditorSelection.editor !== editor) {
        editor.focus();
        var fallbackSelection = window.getSelection();
        var fallbackRange = document.createRange();
        fallbackRange.selectNodeContents(editor);
        fallbackRange.collapse(false);
        fallbackSelection.removeAllRanges();
        fallbackSelection.addRange(fallbackRange);
        ntEditorSelection = { editor: editor, range: fallbackRange.cloneRange() };
        return true;
    }
    editor.focus();
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(ntEditorSelection.range);
    return true;
}

function serializeNoteInline(node, blockSeparator) {
    if (node.nodeType === 3)
        return node.nodeValue.replace(/([\\`*_{}\[\]()])/g, '\\$1');
    if (node.nodeType !== 1)
        return '';
    var tag = node.tagName.toLowerCase();
    if (tag === 'br')
        return '\n';
    if (tag === 'input')
        return '';
    var childSeparator = blockSeparator || (tag === 'li' ? ' ' : '\n');
    var content = serializeNoteChildren(node, childSeparator);
    if (tag === 'strong' || tag === 'b')
        return '**' + content + '**';
    if (tag === 'em' || tag === 'i')
        return '*' + content + '*';
    if (tag === 'del' || tag === 's' || tag === 'strike')
        return '~~' + content + '~~';
    if (tag === 'code')
        return '`' + content.replace(/`/g, '\\`') + '`';
    if (tag === 'a') {
        var href = node.getAttribute('href') || '';
        return /^(https?:|mailto:|\/|#|\.{1,2}\/)/i.test(href) ? '[' + content + '](' + href.replace(/[)\s]/g, encodeURIComponent) + ')' : content;
    }
    return content;
}

function serializeNoteChildren(node, blockSeparator, excludedNode) {
    var output = '';
    Array.prototype.forEach.call(node.childNodes, function (child) {
        if (child === excludedNode || (child.nodeType === 1 && child.tagName.toLowerCase() === 'input' && child.type === 'checkbox'))
            return;
        var isBlock = child.nodeType === 1 && /^(P|DIV)$/.test(child.tagName);
        var content = serializeNoteInline(child, blockSeparator);
        if (!content)
            return;
        if (isBlock && output && !/\s$/.test(output) && !/^\s/.test(content))
            output += blockSeparator;
        output += content;
    });
    return output;
}

function isNoteChecklistChecked(checkbox) {
    return !!(checkbox && (checkbox.checked || checkbox.getAttribute('checked') !== null));
}

function serializeNoteBlock(node) {
    if (node.nodeType !== 1)
        return node.nodeType === 3 ? node.nodeValue.trim() : '';
    var tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
        var headingLevel = Math.max(1, Math.min(3, Number(tag.slice(1)) - 3));
        return new Array(headingLevel + 1).join('#') + ' ' + serializeNoteInline(node).trim();
    }
    if (tag === 'pre')
        return '```\n' + node.textContent.replace(/\n+$/, '') + '\n```';
    if (tag === 'ul' || tag === 'ol') {
        var items = Array.prototype.filter.call(node.children, function (child) { return child.tagName.toLowerCase() === 'li'; });
        return items.map(function (item, index) {
            var checkbox = item.querySelector('input[type="checkbox"]');
            var text = serializeNoteChildren(item, ' ', checkbox).trim();
            if (node.classList.contains('md-checklist'))
                return '- [' + (isNoteChecklistChecked(checkbox) ? 'x' : ' ') + '] ' + text;
            var start = tag === 'ol' ? Number(node.getAttribute('start')) || 1 : 1;
            return (tag === 'ol' ? (start + index) + '. ' : '- ') + text;
        }).join('\n');
    }
    if (tag === 'p' || tag === 'div')
        return serializeNoteChildren(node, '\n').trim();
    return serializeNoteInline(node).trim();
}

function serializeNoteEditor(editor) {
    var blocks = [];
    var inlineNodes = [];
    function flushInline() {
        if (inlineNodes.length) {
            blocks.push(inlineNodes.map(serializeNoteInline).join('').trim());
            inlineNodes = [];
        }
    }
    Array.prototype.forEach.call(editor.childNodes, function (node) {
        var isBlock = node.nodeType === 1 && /^(P|DIV|H[1-6]|UL|OL|PRE)$/.test(node.tagName);
        if (isBlock) {
            flushInline();
            blocks.push(serializeNoteBlock(node));
        } else {
            inlineNodes.push(node);
        }
    });
    flushInline();
    return blocks.filter(Boolean).join('\n\n').replace(/\n{3,}/g, '\n\n');
}

function getNoteEditorBlock(editor) {
    var selection = window.getSelection();
    var node = selection && selection.anchorNode;
    if (node && node.nodeType === 3)
        node = node.parentElement;
    while (node && node !== editor) {
        if (/^(P|DIV|H[1-6]|LI|PRE)$/.test(node.tagName))
            return node;
        node = node.parentElement;
    }
    return null;
}

function updateNoteToolbarState(editor) {
    var formats = { bold: 'bold', italic: 'italic', strike: 'strikeThrough' };
    Object.keys(formats).forEach(function (name) {
        var button = document.querySelector('.note-md-btn[data-format="' + name + '"]');
        if (!button)
            return;
        var active = typeof document.queryCommandState === 'function'
            ? document.queryCommandState(formats[name])
            : false;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var codeButton = document.querySelector('.note-md-btn[data-format="code"]');
    if (codeButton) {
        var block = getNoteEditorBlock(editor);
        var activeCode = !!(block && (block.tagName === 'PRE' || block.closest('code')));
        codeButton.classList.toggle('active', activeCode);
        codeButton.setAttribute('aria-pressed', activeCode ? 'true' : 'false');
    }
}

function wireNoteEditor(editor) {
    if (!editor || editor.dataset.formattingWired)
        return;
    editor.dataset.formattingWired = 'true';
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.innerHTML = renderMarkdown(editor.dataset.markdown || '', null, true);
    editor.addEventListener('focus', function () { saveNoteEditorSelection(editor); });
    editor.addEventListener('keyup', function () { saveNoteEditorSelection(editor); updateNoteToolbarState(editor); });
    editor.addEventListener('mouseup', function () { saveNoteEditorSelection(editor); updateNoteToolbarState(editor); });
    editor.addEventListener('input', function () { saveNoteEditorSelection(editor); updateNotePreview(); updateNoteToolbarState(editor); });
    editor.addEventListener('change', function (event) {
        if (event.target.matches('.md-checklist-input')) {
            updateNoteChecklistInput(event.target);
        }
    });
    editor.addEventListener('keydown', function (event) {
        if (!(event.ctrlKey || event.metaKey) || event.altKey)
            return;
        var key = event.key.toLowerCase();
        var command = key === 'b' ? 'bold' : key === 'i' ? 'italic'
            : key === 'x' && event.shiftKey ? 'strikeThrough' : '';
        if (!command)
            return;
        event.preventDefault();
        restoreNoteEditorSelection(editor);
        document.execCommand(command, false, null);
        saveNoteEditorSelection(editor);
        updateNotePreview();
        updateNoteToolbarState(editor);
    });
    editor.addEventListener('paste', function (event) {
        var text = event.clipboardData && event.clipboardData.getData('text/plain');
        if (text == null)
            return;
        event.preventDefault();
        restoreNoteEditorSelection(editor);
        document.execCommand('insertText', false, text);
        updateNotePreview();
    });
    var toolbar = editor.closest('.modal-body').querySelector('.note-md-toolbar');
    toolbar.addEventListener('pointerdown', function (event) {
        if (event.target.closest('.note-md-btn'))
            saveNoteEditorSelection(editor);
    });
    toolbar.addEventListener('mousedown', function (event) {
        if (event.button === 0 && event.target.closest('.note-md-btn'))
            event.preventDefault();
    });
    editor.addEventListener('click', function (event) {
        if (event.target.matches('.md-checklist-input'))
            event.stopPropagation();
    });
}

function updateNoteChecklistInput(checkbox) {
    var checked = checkbox.checked;
    if (checked)
        checkbox.setAttribute('checked', '');
    else
        checkbox.removeAttribute('checked');
    var item = checkbox.closest('.md-checklist-item');
    if (item) {
        item.classList.toggle('md-checked', checked);
        var text = item.querySelector('.md-cl-text');
        if (text)
            text.classList.toggle('md-cl-done', checked);
    }
    checkbox.setAttribute('aria-label', checked ? 'Mark checklist item incomplete' : 'Mark checklist item complete');
    updateNotePreview();
}

function runNoteEditorCommand(command, value) {
    var editor = document.getElementById('nContent');
    if (!editor)
        return;
    restoreNoteEditorSelection(editor);
    document.execCommand(command, false, value || null);
    saveNoteEditorSelection(editor);
    updateNotePreview();
    updateNoteToolbarState(editor);
}

function mdToggleInline(marker) {
    var commands = { '**': 'bold', '*': 'italic', '~~': 'strikeThrough' };
    var editor = document.getElementById('nContent');
    if (!editor)
        return;
    if (marker === '`') {
        restoreNoteEditorSelection(editor);
        var selection = window.getSelection();
        if (!selection || !selection.rangeCount)
            return;
        var range = selection.getRangeAt(0);
        var parentCode = range.commonAncestorContainer.nodeType === 1
            ? range.commonAncestorContainer.closest('code')
            : range.commonAncestorContainer.parentElement.closest('code');
        if (parentCode) {
            var plain = document.createTextNode(parentCode.textContent);
            parentCode.replaceWith(plain);
            range.selectNodeContents(plain);
        } else {
            var code = document.createElement('code');
            if (range.collapsed)
                code.textContent = 'code';
            else
                code.appendChild(range.extractContents());
            range.insertNode(code);
            range.selectNodeContents(code);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        saveNoteEditorSelection(editor);
        updateNotePreview();
        return;
    }
    runNoteEditorCommand(commands[marker], null);
}

function mdInsertLink() {
    var editor = document.getElementById('nContent');
    if (!editor)
        return;
    var href = prompt('Enter a link URL');
    if (!href)
        return;
    if (!/^(https?:|mailto:|\/|#|\.{1,2}\/)/i.test(href)) {
        Toast.show('Enter a valid http, https, or mailto link', 'warning');
        return;
    }
    var selection = window.getSelection();
    restoreNoteEditorSelection(editor);
    if (selection && selection.isCollapsed)
        document.execCommand('insertHTML', false, '<a href="' + escapeHtml(href) + '">' + escapeHtml(href) + '</a>');
    else
        document.execCommand('createLink', false, href);
    updateNotePreview();
}

function mdInsertLine(prefix) {
    var levels = { '# ': 'H4', '## ': 'H5', '### ': 'H6' };
    var editor = document.getElementById('nContent');
    if (!editor)
        return;
    restoreNoteEditorSelection(editor);
    var block = getNoteEditorBlock(editor);
    var target = levels[prefix];
    document.execCommand('formatBlock', false, block && block.tagName === target ? 'P' : target);
    var formattedBlock = getNoteEditorBlock(editor);
    if (formattedBlock && /^H[4-6]$/.test(formattedBlock.tagName))
        formattedBlock.classList.add('md-h');
    updateNotePreview();
}

function convertChecklistList(list) {
    list.classList.add('md-checklist');
    Array.prototype.forEach.call(list.children, function (item) {
        if (item.tagName.toLowerCase() !== 'li' || Array.prototype.some.call(item.children, function (child) {
            return child.tagName.toLowerCase() === 'input' && child.type === 'checkbox';
        }))
            return;
        var checkbox = document.createElement('input');
        checkbox.className = 'md-checklist-input';
        checkbox.type = 'checkbox';
        checkbox.setAttribute('contenteditable', 'false');
        checkbox.setAttribute('aria-label', 'Mark checklist item complete');
        var text = document.createElement('span');
        text.className = 'md-cl-text';
        while (item.firstChild)
            text.appendChild(item.firstChild);
        item.appendChild(checkbox);
        item.appendChild(text);
        item.classList.add('md-checklist-item');
    });
}

function removeChecklistFormatting(list) {
    Array.prototype.forEach.call(list.querySelectorAll('input[type="checkbox"]'), function (checkbox) { checkbox.remove(); });
    Array.prototype.forEach.call(list.querySelectorAll('.md-cl-text'), function (span) {
        span.replaceWith.apply(span, Array.prototype.slice.call(span.childNodes));
    });
    list.classList.remove('md-checklist');
    list.querySelectorAll('li').forEach(function (item) {
        item.classList.remove('md-checklist-item', 'md-checked');
    });
}

function mdInsertBlock(text) {
    var editor = document.getElementById('nContent');
    if (!editor)
        return;
    restoreNoteEditorSelection(editor);
    if (text.startsWith('```')) {
        var block = getNoteEditorBlock(editor);
        document.execCommand('formatBlock', false, block && block.tagName === 'PRE' ? 'P' : 'PRE');
    } else if (text.startsWith('- [ ]')) {
        var listItem = getNoteEditorBlock(editor);
        var currentList = listItem && listItem.closest('ul,ol');
        if (currentList && currentList.classList.contains('md-checklist')) {
            removeChecklistFormatting(currentList);
            document.execCommand('insertUnorderedList', false, null);
        } else {
            document.execCommand('insertUnorderedList', false, null);
            var selection = window.getSelection();
            var node = selection && selection.anchorNode;
            if (node && node.nodeType === 3)
                node = node.parentElement;
            var li = node && node.closest('li');
            var list = li && li.closest('ul');
            if (list)
                convertChecklistList(list);
        }
    } else {
        var activeBlock = getNoteEditorBlock(editor);
        var activeList = activeBlock && activeBlock.closest('ul,ol');
        if (activeList && activeList.classList.contains('md-checklist')) {
            removeChecklistFormatting(activeList);
            if (text.startsWith('1.'))
                document.execCommand('insertOrderedList', false, null);
        } else {
            document.execCommand(text.startsWith('1.') ? 'insertOrderedList' : 'insertUnorderedList', false, null);
        }
    }
    saveNoteEditorSelection(editor);
    updateNotePreview();
}

/* ── Tag management for modal ── */
var ntCurrentTags = [];

function initTagInput(existingTags) {
    ntCurrentTags = existingTags ? existingTags.slice() : [];
    renderTagChips();
    var input = document.getElementById('nTagInput');
    if (!input)
        return;
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            addTagFromInput();
        }
        else if (e.key === 'Backspace' && input.value === '' && ntCurrentTags.length > 0) {
            ntCurrentTags.pop();
            renderTagChips();
        }
    });
    input.addEventListener('blur', function () {
        if (input.value.trim())
            addTagFromInput();
    });
}

function addTagFromInput() {
    var input = document.getElementById('nTagInput');
    if (!input)
        return;
    var val = input.value.trim();
    if (!val)
        return;
    addTag(val);
    input.value = '';
    input.focus();
}

function addTag(tag) {
    if (!tag)
        return;
    var normalized = tag.trim().toLowerCase();
    if (!normalized)
        return;
    var exists = ntCurrentTags.some(function (t) { return t.toLowerCase() === normalized; });
    if (exists)
        return;
    ntCurrentTags.push(tag.trim());
    renderTagChips();
}

function removeTag(idx) {
    ntCurrentTags.splice(idx, 1);
    renderTagChips();
    var input = document.getElementById('nTagInput');
    if (input)
        input.focus();
}

function renderTagChips() {
    var container = document.getElementById('nTagsContainer');
    if (!container)
        return;
    var chips = ntCurrentTags.map(function (t, i) {
        return '<span class="nt-tag-edit-chip">' + escapeHtml(t) +
            '<button type="button" class="nt-tag-remove" onclick="removeTag(' + i + ')" aria-label="Remove tag ' + escapeHtml(t) + '"><i class="bi bi-x"></i></button></span>';
    }).join('');
    container.innerHTML = chips;
}

/* ── Note Templates ── */

function applyTemplate(key) {
    var tmpl = NOTE_TEMPLATES[key];
    if (!tmpl)
        return;
    var ta = document.getElementById('nContent');
    if (!ta)
        return;
    if (serializeNoteEditor(ta).trim() && key !== 'blank') {
        if (!confirm('Replace current content with the "' + tmpl.label + '" template?'))
            return;
    }
    ta.innerHTML = renderMarkdown(tmpl.content, null, true);
    updateNotePreview();
    ta.focus();
    saveNoteEditorSelection(ta);
    // Close template dropdown if open
    var dd = document.getElementById('ntTemplateDropdown');
    if (dd)
        dd.style.display = 'none';
}

function toggleTemplateDropdown() {
    var dd = document.getElementById('ntTemplateDropdown');
    if (!dd)
        return;
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

/* ── Note Modal ── */

function openNoteModal(id) {
    var n = id ? DB.getNotes().find(function (x) { return x.id === id; }) : null;
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    var curSubId = n ? (n.subjectId || '') : '';
    var curTaskId = n ? (n.taskId || '') : '';
    document.getElementById('noteModalTitle').textContent = n ? 'Edit Note' : 'New Note';
    var subOptions = '<option value="">No Subject</option>' +
        subs.map(function (s) { return '<option value="' + s.id + '" ' + (curSubId === s.id ? 'selected' : '') + '>' + escapeHtml(s.code || s.name) + '</option>'; }).join('');
    var taskOptions = '<option value="">No Task</option>' +
        tasks.map(function (t) { return '<option value="' + t.id + '" ' + (curTaskId === t.id ? 'selected' : '') + '>' + escapeHtml(t.title) + '</option>'; }).join('');
    var CATS = ['Homework', 'Lecture', 'Project', 'Personal', 'Organization', 'Ideas'];
    // Template buttons
    var tmplHtml = '<div class="nt-template-wrap">' +
        '<button type="button" class="nt-template-trigger btn-ghost btn btn-sm" onclick="toggleTemplateDropdown()" aria-haspopup="true" aria-expanded="false"><i class="bi bi-layout-text-window me-1"></i>Template</button>' +
        '<div class="nt-template-dropdown" id="ntTemplateDropdown" style="display:none">' +
        Object.entries(NOTE_TEMPLATES).map(function (entry) {
            var k = entry[0], v = entry[1];
            return '<button type="button" class="nt-template-item" onclick="applyTemplate(\'' + k + '\')" aria-label="Apply ' + v.label + ' template"><i class="bi ' + v.icon + '"></i>' + v.label + '</button>';
        }).join('') +
        '</div></div>';
    document.getElementById('noteModalBody').innerHTML =
        '<input type="hidden" id="nId" value="' + (n ? n.id : '') + '">' +
            '<div class="row g-2">' +
            '<div class="col-12"><label>Title</label><input class="form-control" id="nTitle" value="' + (n ? escapeHtml(n.title) : '') + '" placeholder="Note title…" autocomplete="off"></div>' +
            '<div class="col-sm-6 col-md-4"><label>Category</label><select class="form-select" id="nCategory">' + CATS.map(function (c) { return '<option ' + (n && n.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
            '<div class="col-sm-6 col-md-4"><label>Subject</label><select class="form-select" id="nSubject">' + subOptions + '</select></div>' +
            '<div class="col-sm-6 col-md-4"><label>Related Task</label><select class="form-select" id="nTask">' + taskOptions + '</select></div>' +
            '<div class="col-12">' +
            '<label>Tags <span class="text-faint" style="font-weight:400;font-size:.75rem">(press Enter to add each tag)</span></label>' +
            '<div class="nt-tags-input-wrap" id="nTagsWrap" onclick="document.getElementById(\'nTagInput\').focus()">' +
            '<div class="nt-tags-chips" id="nTagsContainer"></div>' +
            '<input type="text" class="nt-tag-text-input" id="nTagInput" placeholder="' + (n && n.tags && n.tags.length ? '' : 'Add tag…') + '" autocomplete="off" aria-label="Add tag">' +
            '</div>' +
            '</div>' +
            '<div class="col-12">' +
            '<div class="d-flex align-items-center justify-content-between mb-1">' +
            '<div class="note-editor-tabs">' +
            '<button class="note-tab-btn active" id="noteTabWrite" onclick="switchNoteTab(\'write\')" type="button"><i class="bi bi-pencil"></i> Write</button>' +
            '<button class="note-tab-btn" id="noteTabPreview" onclick="switchNoteTab(\'preview\')" type="button"><i class="bi bi-eye"></i> Preview</button>' +
            '</div>' +
            tmplHtml +
            '</div>' +
            '<div class="note-md-toolbar">' +
            '<button type="button" class="note-md-btn" data-format="bold" onclick="mdToggleInline(\'**\')" title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed="false"><b>B</b></button>' +
            '<button type="button" class="note-md-btn" data-format="italic" onclick="mdToggleInline(\'*\')" title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed="false"><i>I</i></button>' +
            '<button type="button" class="note-md-btn" data-format="strike" onclick="mdToggleInline(\'~~\')" title="Strikethrough" aria-label="Strikethrough" aria-pressed="false"><s>S</s></button>' +
            '<div class="nt-tb-sep"></div>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertLine(\'# \')" title="Heading 1" aria-label="Heading 1"><span style="font-weight:800;font-size:.75rem">H1</span></button>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertLine(\'## \')" title="Heading 2" aria-label="Heading 2"><span style="font-weight:700;font-size:.72rem">H2</span></button>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertLine(\'### \')" title="Heading 3" aria-label="Heading 3"><span style="font-weight:600;font-size:.68rem">H3</span></button>' +
            '<div class="nt-tb-sep"></div>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertBlock(\'- item\')" title="Bullet list" aria-label="Bullet list"><i class="bi bi-list-ul"></i></button>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertBlock(\'1. item\')" title="Numbered list" aria-label="Numbered list"><i class="bi bi-list-ol"></i></button>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertBlock(\'- [ ] item\')" title="Checklist item" aria-label="Checklist item"><i class="bi bi-check2-square"></i></button>' +
            '<div class="nt-tb-sep"></div>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertLink()" title="Link" aria-label="Link"><i class="bi bi-link-45deg"></i></button>' +
            '<button type="button" class="note-md-btn" data-format="code" onclick="mdToggleInline(\'`\')" title="Inline code" aria-label="Inline code" aria-pressed="false"><i class="bi bi-code"></i></button>' +
            '<button type="button" class="note-md-btn" onclick="mdInsertBlock(\'```\\n\\n```\')" title="Code block" aria-label="Code block"><i class="bi bi-code-slash"></i></button>' +
            '</div>' +
            '<div id="noteTabWritePane">' +
            '<div class="form-control note-editor-ta" id="nContent" data-markdown="' + escapeHtml(n ? n.content || '' : '') + '" data-placeholder="Write your note here…" aria-label="Note content"></div>' +
            '</div>' +
            '<div id="noteTabPreviewPane" style="display:none">' +
            '<div class="note-preview-pane" id="nPreview"><span class="text-faint">Switch to Write tab to enter content.</span></div>' +
            '</div>' +
            '</div>' +
            '<div class="col-12 d-flex gap-3 mt-1">' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" id="nPinned" ' + (n && n.pinned ? 'checked' : '') + '><label class="form-check-label" for="nPinned">Pin note</label></div>' +
            '<div class="form-check"><input class="form-check-input" type="checkbox" id="nFavorite" ' + (n && n.favorite ? 'checked' : '') + '><label class="form-check-label" for="nFavorite">Favorite</label></div>' +
            '</div></div>' +
            '<div class="d-flex gap-2 mt-3">' +
            '<button class="btn btn-accent flex-grow-1" type="button" onclick="saveNote()"><i class="bi bi-check2 me-1"></i>' + (n ? 'Update' : 'Save') + ' Note</button>' +
            (n ? '<button class="btn btn-ghost" type="button" onclick="exportNotePdf(\'' + n.id + '\')" aria-label="Export PDF" title="Export PDF"><i class="bi bi-file-earmark-pdf"></i></button>' : '') +
            (n ? '<button class="btn btn-ghost" type="button" onclick="deleteNote(\'' + n.id + '\')" aria-label="Delete note"><i class="bi bi-trash"></i></button>' : '') +
            '</div>';
    wireNoteEditor(document.getElementById('nContent'));
    updateNotePreview();
    // Prevent Enter from submitting modal when in tag input
    document.getElementById('noteModalBody').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target && e.target.id === 'nTagInput') {
            e.preventDefault();
        }
    });
    // Close template dropdown when clicking outside
    document.addEventListener('click', function onOutsideClick(e) {
        var dd = document.getElementById('ntTemplateDropdown');
        if (dd && !e.target.closest('.nt-template-wrap')) {
            dd.style.display = 'none';
        }
        // Clean up listener when modal closes
        var modal = document.getElementById('noteModal');
        if (modal && !modal.classList.contains('show')) {
            document.removeEventListener('click', onOutsideClick);
        }
    });
    // Init tag input with existing tags
    setTimeout(function () { initTagInput(n ? (n.tags || []) : []); }, 10);
    new bootstrap.Modal(document.getElementById('noteModal')).show();
}

function switchNoteTab(tab) {
    var writePan = document.getElementById('noteTabWritePane');
    var prevPan = document.getElementById('noteTabPreviewPane');
    var wBtn = document.getElementById('noteTabWrite');
    var pBtn = document.getElementById('noteTabPreview');
    if (tab === 'write') {
        writePan.style.display = '';
        prevPan.style.display = 'none';
        wBtn.classList.add('active');
        pBtn.classList.remove('active');
    }
    else {
        writePan.style.display = 'none';
        prevPan.style.display = '';
        wBtn.classList.remove('active');
        pBtn.classList.add('active');
        updateNotePreview();
    }
}

function updateNotePreview() {
    var editor = document.getElementById('nContent');
    var content = editor ? serializeNoteEditor(editor) : '';
    var idEl = document.getElementById('nId');
    var noteId = idEl ? idEl.value : null;
    var previewEl = document.getElementById('nPreview');
    if (previewEl) {
        previewEl.innerHTML = content.trim()
            ? renderMarkdown(content, noteId || null)
            : '<span class="text-faint">Nothing to preview yet.</span>';
    }
}

/* ── Save note ── */

function saveNote() {
    var title = (document.getElementById('nTitle').value.trim()) || 'Untitled';
    var content = serializeNoteEditor(document.getElementById('nContent'));
    var category = document.getElementById('nCategory').value;
    var pinned = document.getElementById('nPinned').checked;
    var favorite = document.getElementById('nFavorite').checked;
    var subjectId = document.getElementById('nSubject').value || null;
    var taskId = document.getElementById('nTask').value || null;
    var id = document.getElementById('nId').value;
    var tags = ntCurrentTags.slice();
    var notes = DB.getNotes();
    if (id) {
        var idx = notes.findIndex(function (n) { return n.id === id; });
        if (idx !== -1) {
            notes[idx] = Object.assign({}, notes[idx], { title, content, category, pinned, favorite, subjectId, taskId, tags, updatedAt: Date.now() });
        }
    }
    else {
        var semId = DB.getActiveSemesterId();
        notes.unshift({ id: DB.uid(), title, content, category, pinned, favorite, subjectId, taskId, tags, checklist: [], semesterId: semId, createdAt: Date.now(), updatedAt: Date.now() });
    }
    DB.saveNotes(notes);
    bootstrap.Modal.getInstance(document.getElementById('noteModal')).hide();
    Toast.show(id ? 'Note updated' : 'Note added');
    renderNotes();
}

/* ── Delete note ── */

function deleteNote(id) {
    var n = DB.getNotes().find(function (x) { return x.id === id; });
    if (!n)
        return;
    confirmAction({
        title: 'Delete note?',
        message: '"' + n.title + '" will be permanently removed.',
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill',
        onConfirm: function () {
            DB.saveNotes(DB.getNotes().filter(function (x) { return x.id !== id; }));
            var modalEl = document.getElementById('noteModal');
            var inst = bootstrap.Modal.getInstance(modalEl);
            if (inst)
                inst.hide();
            Toast.show('Note deleted');
            renderNotes();
        }
    });
}

/* ── PDF Export ── */

function exportNotePdf(id) {
    var notes = DB.getNotes();
    var n = notes.find(function (x) { return x.id === id; });
    if (!n)
        return;
    var semId = DB.getActiveSemesterId();
    var subs = DB.getSubjects().filter(function (s) { return s.semesterId === semId; });
    var tasks = DB.getTasks().filter(function (t) { return t.semesterId === semId; });
    var sub = n.subjectId ? subs.find(function (s) { return s.id === n.subjectId; }) : null;
    var task = n.taskId ? tasks.find(function (t) { return t.id === n.taskId; }) : null;
    var tags = n.tags || [];
    var wc = calcWordCount(n.content);
    var metaRows = '';
    function addMetadata(label, value) {
        metaRows += '<div class="meta-row"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
    }
    if (n.category)
        addMetadata('Category', n.category);
    if (sub)
        addMetadata('Subject', sub.code || sub.name);
    if (task)
        addMetadata('Task', task.title);
    if (tags.length)
        addMetadata('Tags', tags.join(', '));
    if (wc)
        addMetadata('Length', wc.toLocaleString() + ' words · ' + calcReadingTime(wc));
    addMetadata('Updated', new Date(n.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    var renderedContent = renderMarkdown(n.content, null);
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<title>' + escapeHtml(n.title) + '</title>' +
        '<style>' +
        '@page{size:auto;margin:20mm}' +
        '*{box-sizing:border-box}' +
        'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a2e;margin:0;overflow-wrap:anywhere;word-break:normal}' +
        '.page{width:100%;max-width:180mm;margin:0 auto}' +
        'h1.note-title{font-size:22pt;font-weight:700;color:#1a1a2e;margin:0 0 8pt;line-height:1.25;overflow-wrap:anywhere}' +
        '.meta-list{display:grid;grid-template-columns:max-content 1fr;gap:3pt 12pt;margin:12pt 0 20pt;font-size:9pt}' +
        '.meta-row{display:contents}.meta-row dt{color:#666}.meta-row dd{margin:0;overflow-wrap:anywhere}' +
        '.divider{border:none;border-top:1px solid #d5d8e0;margin:0 0 18pt}' +
        '.md-h{font-weight:700;margin:1em 0 .35em;padding-bottom:3pt;border-bottom:1px solid #e8e8f0;color:#1a1a2e;break-after:avoid}' +
        'h4.md-h{font-size:1.1rem}h5.md-h{font-size:.96rem}h6.md-h{font-size:.88rem}' +
        '.md-p{margin:0 0 .75em;white-space:normal}' +
        '.md-ul,ol{margin:0 0 .75em;padding-left:1.5em}' +
        '.md-li,ol li{margin:0 0 3pt;break-inside:avoid}' +
        '.md-inline-code{background:#f0f0f8;border:1px solid #ddd;border-radius:3px;padding:1px 4px;font-family:monospace;font-size:.9em;overflow-wrap:anywhere}' +
        '.md-code-block{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;overflow:hidden;background:#f5f5fa;border:1px solid #ddd;border-radius:4px;padding:10pt;margin:.75em 0;font-family:monospace;font-size:9pt;line-height:1.5}' +
        '.md-checklist{list-style:none;padding-left:0}.md-checklist-item{display:flex;align-items:flex-start;gap:7pt;margin:4pt 0;break-inside:avoid}.md-cl-box{width:11pt;height:11pt;min-width:11pt;border:1px solid #888;margin-top:3pt;flex-shrink:0}.md-cl-checked{background:#555}.md-cl-checked::after{content:"✓";display:block;color:#fff;text-align:center;font-size:8pt;line-height:10pt}.md-cl-done{text-decoration:line-through;color:#777}' +
        'a{color:#2548a8;overflow-wrap:anywhere}' +
        '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{max-width:none}pre,li{break-inside:avoid}}' +
        '</style></head><body>' +
        '<div class="page">' +
        '<h1 class="note-title">' + escapeHtml(n.title) + '</h1>' +
        (metaRows ? '<dl class="meta-list">' + metaRows + '</dl>' : '') +
        '<hr class="divider">' +
        renderedContent +
        '</div></body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var win = window.open(url, '_blank');
    if (win) {
        win.addEventListener('load', function () {
            setTimeout(function () { win.print(); }, 400);
        });
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    Toast.show('Opening print dialog…', 'accent', 'bi-file-earmark-pdf');
}

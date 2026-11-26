// Curriculum viewer, subject importer, and academic progress tracker.
// Structured program data is loaded from assets/data/curriculum-*.json.

const CURRICULA = {
    'BSA':       { title: 'Bachelor of Science in Accountancy', version: 'AY 2025-2026', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsa.pdf', structured: true },
    'BS Entrep': { title: 'Bachelor of Science in Entrepreneurship', version: 'AY 2021-2022', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsentrep.pdf', structured: true },
    'BSECE':     { title: 'Bachelor of Science in Electronics Engineering', version: 'BSECE-2021', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsece.pdf', structured: true },
    'BSIE':      { title: 'Bachelor of Science in Industrial Engineering', version: 'BSIE-2021', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsie.pdf', structured: true },
    'BSIT':      { title: 'Bachelor of Science in Information Technology', version: 'BSIT-2021', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsit.pdf', structured: true },
    'BSIS':      { title: 'Bachelor of Science in Information Systems', version: 'AY 2023-2024', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bsis.pdf', structured: true },
    'BSCS':      { title: 'Bachelor of Science in Computer Science', version: 'AY 2023-2024', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/bscs.pdf', structured: true },
    'BECEd':     { title: 'Bachelor of Early Childhood Education', version: 'BECEd-2022', file: 'https://pjafmgabajqqozdxhzvz.supabase.co/storage/v1/object/public/curriculum/becd.pdf', structured: true },

    'BSMA':      { title: 'Bachelor of Science in Management Accounting', version: '', file: null },
    'BSCpE':     { title: 'Bachelor of Science in Computer Engineering', version: '', file: null },
};

// Program codes that have a structured (JSON-backed) curriculum, mapped to
// the data file relative to pages/app/*.html.
const STRUCTURED_CURRICULA = {
    'BSCS':      '../../assets/data/curriculum-bscs.json',
    'BSIT':      '../../assets/data/curriculum-bsit.json',
    'BSIS':      '../../assets/data/curriculum-bsis.json',
    'BSIE':      '../../assets/data/curriculum-bsie.json',
    'BSECE':     '../../assets/data/curriculum-bsece.json',
    'BECEd':     '../../assets/data/curriculum-beced.json',
    'BSA':       '../../assets/data/curriculum-bsa.json',
    'BS Entrep': '../../assets/data/curriculum-bsentrep.json',
};

// Cache of loaded structured curriculum JSON, keyed by program code.
const curStructuredCache = {};

// Live filter/UI state for the viewer (reset per program render).
const curViewState = {
    activeYear: 1,
    activeSemester: 1,
    query: '',
};
const curSelectedCourses = new Set();
let curImportMessage = '';
let curRegisteredProgram = '';
let curRegisteredYearLevel = '';
let curProfile = null;

function curEl(id) { return document.getElementById(id); }

function curCard(bodyHtml) {
    return `<div class="cur-card glass" id="curCard">${bodyHtml}</div>`;
}

function curProgramSelectHtml(selected) {
    return `
        <div class="cur-nav-group cur-program-group">
            <div class="cur-nav-label"><i class="icon-lucide-graduation-cap" aria-hidden="true"></i> Select Program</div>
            <select id="curProgramSelect" class="form-select">
                <option value="">Select a program</option>
                ${Object.entries(CURRICULA).map(([code, d]) =>
                    `<option value="${code}"${code === selected ? ' selected' : ''}>${d.title}</option>`).join('')}
            </select>
        </div>`;
}

function bindProgramSelect() {
    const select = curEl('curProgramSelect');
    if (!select) return;
    select.addEventListener('change', e => {
        setSelectedProgram(e.target.value);
        renderProgram(e.target.value);
    });
    // Re-skin the freshly injected native <select> as the app's custom dropdown.
    if (window.enhanceSelects) enhanceSelects(curEl('curCard'));
}

function renderEmptyState() {
    curEl('curProgram').textContent = 'No program selected';
    curEl('curVersion').textContent = '';
    curEl('curriculumContainer').innerHTML = curCard(`
        ${curProgramSelectHtml('')}
        <div class="cur-empty">
            <div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-bookmark"></i></div>
            <p>Select a program above to view its curriculum.</p>
        </div>`);
    bindProgramSelect();
}

function renderUnavailable(code, c) {
    curEl('curProgram').textContent = c.title;
    curEl('curVersion').textContent = '';
    curEl('curriculumContainer').innerHTML = curCard(`
        ${curProgramSelectHtml(code)}
        <div class="cur-empty">
            <div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-hourglass"></i></div>
            <p>The curriculum for <strong>${escHtml(c.title)}</strong> is not available yet.</p>
        </div>`);
    bindProgramSelect();
}

function curPdfActionsHtml(file) {
    return `
        <div class="curv-actions mt-3">
            <a class="curv-btn curv-btn-accent" href="${file}" download>
                <i class="icon-lucide-download" aria-hidden="true"></i> Download PDF
            </a>
            <a class="curv-btn" href="${file}" target="_blank" rel="noopener">
                <i class="icon-lucide-external-link" aria-hidden="true"></i> Open PDF
            </a>
        </div>`;
}

// Program has a PDF but no structured JSON data behind it yet.
function renderPdfOnly(code, c) {
    curEl('curProgram').textContent = c.title;
    curEl('curVersion').textContent = c.version;
    curEl('curriculumContainer').innerHTML = curCard(`
        ${curProgramSelectHtml(code)}
        <div class="cur-empty">
            <div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-file-down"></i></div>
            <p>A structured view isn't available for <strong>${escHtml(c.title)}</strong> yet. Use the buttons below to view the official curriculum PDF.</p>
        </div>
        ${curPdfActionsHtml(c.file)}`);
    bindProgramSelect();
}

function renderProgram(code) {
    const c = CURRICULA[code];

    if (!c) {
        renderEmptyState();
        return;
    }
    if (c.structured && STRUCTURED_CURRICULA[code]) {
        curEl('curProgram').textContent = c.title;
        curEl('curVersion').textContent = c.version;
        curViewState.activeYear = 1;
        curViewState.activeSemester = 1;
        curViewState.query = '';
        curSelectedCourses.clear();
        curImportMessage = '';
        renderStructuredCurriculum(code, c);
        return;
    }
    if (!c.file) {
        renderUnavailable(code, c);
        return;
    }
    renderPdfOnly(code, c);
}

async function initCurriculum() {
    let registered = '';
    try {
        const { AuthService } = await import(new URL('../../assets/js/services/auth-service.js', location.href).href);
        const result = await AuthService.getCurrentProfile();
        curProfile = result.ok ? (result.data || null) : null;
        registered = curProfile ? String(curProfile.course || '').trim() : '';
        curRegisteredYearLevel = curProfile ? String(curProfile.year_level || '').trim() : '';
    } catch (error) {
        console.warn('Could not load registered program; using the saved curriculum choice.', error);
    }
    curRegisteredProgram = registered;
    const saved = getSelectedProgram();
    const code = CURRICULA[registered] ? registered : (CURRICULA[saved] ? saved : '');
    if (code) setSelectedProgram(code);
    renderProgram(code);
    if (!window._curriculumAcademicCalendarBound) {
        window._curriculumAcademicCalendarBound = true;
        window.addEventListener('planner:academic-calendar-changed', () => renderProgram(code));
    }
}


// ============================================================
// STRUCTURED CURRICULUM VIEWER
// ============================================================

async function loadStructuredCurriculum(code) {
    if (curStructuredCache[code]) return curStructuredCache[code];
    const url = STRUCTURED_CURRICULA[code];
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load curriculum data: ' + res.status);
    const data = await res.json();
    curStructuredCache[code] = data;
    return data;
}

// Whether this program's data includes lecture/lab hour breakdowns at all.
// Some source PDFs only list units (no hour columns), so we never fabricate
// lecHours/labHours for those — we just don't show those stats/columns.
function curHasHours(data) {
    return data.years.some(y => y.semesters.some(s => s.courses.some(c =>
        c.lecHours !== undefined || c.labHours !== undefined)));
}

function curSemUnits(sem) {
    return sem.courses.reduce((a, c) => a + c.units, 0);
}
function curMatchesQuery(course, q) {
    if (!q) return true;
    const hay = (course.code + ' ' + course.title).toLowerCase();
    return hay.includes(q);
}

async function renderStructuredCurriculum(code, meta) {
    const container = curEl('curriculumContainer');
    container.innerHTML = curCard(`
        ${curProgramSelectHtml(code)}
        <div class="cur-empty"><div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-hourglass"></i></div><p>Loading curriculum…</p></div>`);
    bindProgramSelect();

    let data;
    try {
        data = await loadStructuredCurriculum(code);
    } catch (err) {
        container.innerHTML = curCard(`
            ${curProgramSelectHtml(code)}
            <div class="cur-empty">
                <div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-triangle-alert"></i></div>
                <p>Could not load the curriculum data. Please try again later.</p>
            </div>`);
        bindProgramSelect();
        return;
    }

    curSyncViewToAcademicContext(data);

    container.innerHTML = curCard(`
        <div class="cur-curriculum-shell">
            <header class="cur-curriculum-header">
                <div class="cur-program-heading">
                    <span class="cur-program-kicker">ACADEMIC PROGRAM</span>
                    <strong>${escHtml(meta.title || 'Academic program')}</strong>
                    <span>${escHtml(meta.version || 'Current reference curriculum')}</span>
                </div>
                <div class="cur-program-switcher cur-area-select">
                    ${curProgramSelectHtml(code)}
                </div>
            </header>

            <div class="cur-layout">
                <section class="cur-tracker-panel">
                    <div class="cur-panel-heading">
                        <div>
                            <span class="cur-program-kicker">CURRICULUM TRACKER</span>
                            <h2>Progress overview</h2>
                        </div>
                        <span class="cur-panel-note">Your academic progress at a glance</span>
                    </div>
                    <div id="curTrackerStats" class="cur-area-tracker-stats"></div>
                    <div id="curTrackerMain" class="cur-area-tracker-main"></div>
                </section>

                <section class="cur-subject-panel">
                    <div class="cur-subject-top">
                        <div class="cur-panel-heading">
                            <div>
                                <span class="cur-program-kicker">SUBJECT CATALOG</span>
                                <h2>Curriculum subjects</h2>
                            </div>
                            <span class="cur-panel-note">Select subjects to add to your active semester</span>
                        </div>
                        <div class="cur-search-wrap cur-search-standalone cur-area-search">
                            <i class="icon-lucide-search cur-search-icon" aria-hidden="true"></i>
                            <input type="text" class="form-control cur-search-input" id="curSearchInput"
                                placeholder="Search subjects…" value="${escHtml(curViewState.query)}">
                        </div>
                    </div>
                    <div id="curNavWrap" class="cur-area-nav"></div>
                    <div class="cur-area-results">
                        <div id="curYearResults"></div>
                        ${curPdfActionsHtml(meta.file)}
                    </div>
                </section>
            </div>
        </div>`);
    bindProgramSelect();
    renderCurNav(data);
    renderCurResults(data);
    renderCurriculumTracker(data, code);

    const search = curEl('curSearchInput');
    search.addEventListener('input', debounce(e => {
        curViewState.query = e.target.value.trim().toLowerCase();
        renderCurNav(data);
        renderCurResults(data);
    }, 200));
}

function curSyncViewToAcademicContext(data) {
    if (!data || !Array.isArray(data.years) || !data.years.length) return;
    const activeSemester = trackerExplicitActiveSemester();
    const profileYear = trackerYearNumber(curRegisteredYearLevel);
    const semesterYear = activeSemester && (activeSemester.yearLevel || activeSemester.year_level)
        ? trackerYearNumber(activeSemester.yearLevel || activeSemester.year_level) : 0;
    const preferredYear = profileYear || semesterYear;
    const year = data.years.find(item => item.yearLevel === preferredYear) || data.years[0];
    curViewState.activeYear = year.yearLevel;
    const semesterName = activeSemester && (activeSemester.name || activeSemester.semester);
    const preferredSemester = trackerSemesterNumber(semesterName);
    curViewState.activeSemester = preferredSemester && year.semesters[preferredSemester - 1]
        ? preferredSemester : 1;
}

function renderCurNav(data) {
    const wrap = curEl('curNavWrap');
    if (!wrap) return;

    const activeYear = data.years.find(y => y.yearLevel === curViewState.activeYear) || data.years[0];

    wrap.innerHTML = `
        <div class="cur-nav-grid">
            <div class="cur-nav-label cur-nav-year-label"><i class="icon-lucide-calendar-days" aria-hidden="true"></i> Select Year Level</div>
            <div class="cur-pill-row cur-pill-row-years">
                ${data.years.map(y => `
                    <button type="button" class="cur-pill-btn${y.yearLevel === curViewState.activeYear ? ' active' : ''}"
                        data-year="${y.yearLevel}">${escHtml(y.yearLabel)}</button>
                `).join('')}
            </div>
            <div class="cur-nav-label cur-nav-sem-label"><i class="icon-lucide-calendar-days" aria-hidden="true"></i> Select Semester</div>
            <div class="cur-pill-row cur-pill-row-sems">
                ${activeYear.semesters.map((s, i) => `
                    <button type="button" class="cur-pill-btn cur-pill-btn-sem${(i + 1) === curViewState.activeSemester ? ' active' : ''}"
                        data-sem="${i + 1}">${escHtml(s.semesterLabel)}</button>
                `).join('')}
            </div>
        </div>`;

    wrap.querySelectorAll('[data-year]').forEach(btn => {
        btn.addEventListener('click', () => {
            curViewState.activeYear = Number(btn.dataset.year);
            curViewState.activeSemester = 1;
            curSelectedCourses.clear();
            renderCurNav(data);
            renderCurResults(data);
        });
    });
    wrap.querySelectorAll('[data-sem]').forEach(btn => {
        btn.addEventListener('click', () => {
            curViewState.activeSemester = Number(btn.dataset.sem);
            curSelectedCourses.clear();
            curImportMessage = '';
            renderCurNav(data);
            renderCurResults(data);
        });
    });
}

function curCanImport() {
    const current = getSelectedProgram();
    return !curRegisteredProgram || !current || current === curRegisteredProgram;
}

function curProgramReminderHtml() {
    if (!curRegisteredProgram || getSelectedProgram() === curRegisteredProgram) return '';
    const registeredTitle = CURRICULA[curRegisteredProgram] ? CURRICULA[curRegisteredProgram].title : curRegisteredProgram;
    return `<div class="cur-program-reminder" role="status"><i class="icon-lucide-info" aria-hidden="true"></i><span>This is a different program from your registered program. You can view it, but you cannot select or add its subjects. Your registered program is <strong>${escHtml(registeredTitle)}</strong>.</span></div>`;
}

// Each course rendered as its own accordion item (collapsed by default):
// header = code + title + units, body = lec/lab hours + prerequisites.
function curCourseAccordionHtml(courses, groupId) {
    if (!courses.length) {
        return `<div class="cur-empty"><div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-search"></i></div><p>No subjects found.</p></div>`;
    }

    const items = courses.map((c, i) => {
        const id = `curCourse-${groupId}-${i}`;
        const unitLabel = `${c.units} unit${c.units === 1 ? '' : 's'}`;
        const added = curCourseAlreadyAdded(c);
        return `
        <div class="cur-course-item">
            <button class="cur-course-btn collapsed" type="button"
                data-bs-toggle="collapse" data-bs-target="#${id}"
                aria-expanded="false" aria-controls="${id}">
                <span class="cur-course-select" onclick="event.stopPropagation()">
                    <span class="tk-bulk-check cur-select-course ${curSelectedCourses.has(c.code) ? 'selected' : ''}" role="checkbox" tabindex="0" data-course-code="${escHtml(c.code)}" data-course-units="${c.units}" aria-checked="${curSelectedCourses.has(c.code) ? 'true' : 'false'}" aria-label="Select ${escHtml(c.code)}" ${added || !curCanImport() ? 'aria-disabled="true"' : ''}>${curSelectedCourses.has(c.code) ? '<i class="icon-lucide-check" aria-hidden="true"></i>' : ''}</span>
                </span>
                <span class="cur-course-btn-main">
                    <span class="cur-course-pills">
                        <span class="cur-code">${escHtml(c.code)}</span>
                        <span class="cur-unit-pill">${unitLabel}</span>
                        ${added ? '<span class="cur-badge">ADDED</span>' : ''}
                        ${c.graduatingStudentOnly ? ' <span class="cur-badge cur-badge-grad" title="For graduating student only">GRAD</span>' : ''}
                    </span>
                    <span class="cur-course-btn-title">${escHtml(c.title)}</span>
                </span>
                <span class="cur-chevron-box"><i class="icon-lucide-chevron-down" aria-hidden="true"></i></span>
            </button>
            <div class="collapse" id="${id}">
                <div class="cur-course-body">
                    ${c.lecHours !== undefined ? `<div class="cur-course-detail"><i class="icon-lucide-presentation" aria-hidden="true"></i> ${c.lecHours} Lecture hrs</div>` : ''}
                    ${c.labHours !== undefined ? `<div class="cur-course-detail"><i class="icon-lucide-monitor" aria-hidden="true"></i> ${c.labHours} Lab hrs</div>` : ''}
                    <div class="cur-course-detail-req"><span class="cur-req-label">Pre-requisite / Co-requisite</span><div class="cur-card-req-chips">${c.prerequisites.length ? c.prerequisites.map(p => `<span class="cur-badge">${escHtml(p)}</span>`).join('') : '<span class="cur-num">NONE</span>'}</div></div>
                </div>
            </div>
        </div>`;
    }).join('');
    return `<div class="cur-course-accordion">${items}</div>`;
}

// Desktop table: Code | Course Title | Units | [Lab | Lec] | Prerequisite
// The Lab/Lec columns only appear when this program's data has hour info.
function curCourseTableHtml(courses, hasHours) {
    const rows = courses.map(c => `
        <tr>
            <td><span class="tk-bulk-check cur-select-course ${curSelectedCourses.has(c.code) ? 'selected' : ''}" role="checkbox" tabindex="0" data-course-code="${escHtml(c.code)}" data-course-units="${c.units}" aria-checked="${curSelectedCourses.has(c.code) ? 'true' : 'false'}" aria-label="Select ${escHtml(c.code)}" ${curCourseAlreadyAdded(c) || !curCanImport() ? 'aria-disabled="true"' : ''}>${curSelectedCourses.has(c.code) ? '<i class="icon-lucide-check" aria-hidden="true"></i>' : ''}</span></td>
            <td><span class="cur-code">${escHtml(c.code)}</span>${curCourseAlreadyAdded(c) ? ' <span class="cur-badge">ADDED</span>' : ''}</td>
            <td class="cur-title">${escHtml(c.title)}${c.graduatingStudentOnly ? ' <span class="cur-badge cur-badge-grad" title="For graduating student only">GRAD</span>' : ''}</td>
            <td class="cur-num">${c.units}</td>
            ${hasHours ? `<td class="cur-num">${c.labHours !== undefined ? c.labHours : '—'}</td>` : ''}
            ${hasHours ? `<td class="cur-num">${c.lecHours !== undefined ? c.lecHours : '—'}</td>` : ''}
            <td>${c.prerequisites.length ? c.prerequisites.map(p => `<span class="cur-badge">${escHtml(p)}</span>`).join('') : '<span class="cur-num">NONE</span>'}</td>
        </tr>`).join('');

    return `
        <div class="cur-course-table-wrap">
            <div class="cur-table-wrap">
                <table class="cur-table cur-list-table">
                    <thead>
                        <tr>
                            <th aria-label="Select"></th>
                            <th>Code</th>
                            <th>Course Title</th>
                            <th>Units</th>
                            ${hasHours ? '<th>Lab</th>' : ''}
                            ${hasHours ? '<th>Lec</th>' : ''}
                            <th>Pre-requisite / Co-requisite</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

// Mobile: accordion. Desktop (md+): table. Same data, two presentations.
function curCourseAlreadyAdded(course) {
    const activeId = DB.getActiveSemesterId();
    return !!activeId && DB.getSubjects().some(s => activeId && s.semesterId === activeId && String(s.code || '').toLowerCase() === String(course.code || '').toLowerCase());
}

function curActiveSemesterForImport() {
    const activeId = DB.getActiveSemesterId();
    const sem = activeId ? DB.getSemesters().find(s => s.id === activeId) : null;
    if (!sem) return null;
    if (sem.endDate && sem.endDate < ymdLocal(new Date())) return null;
    return sem;
}

function curSelectionSummary(courses) {
    const selected = courses.filter(c => curCanImport() && curSelectedCourses.has(c.code) && !curCourseAlreadyAdded(c));
    return { count: selected.length, units: selected.reduce((sum, c) => sum + Number(c.units || 0), 0) };
}

function curCourseListBlockHtml(courses, groupId, hasHours) {
    if (!courses.length) {
        return `<div class="cur-empty"><div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-search"></i></div><p>No subjects found.</p></div>`;
    }
    return `
        <div class="d-none d-lg-block">${curCourseTableHtml(courses, hasHours)}</div>
        <div class="d-lg-none">${curCourseAccordionHtml(courses, groupId)}</div>`;
}

function renderCurResults(data) {
    const el = curEl('curYearResults');
    if (!el) return;

    const hasHours = curHasHours(data);
    const searching = !!curViewState.query;

    if (searching) {
        const q = curViewState.query;
        const groups = [];
        data.years.forEach(year => year.semesters.forEach(sem => {
            const matches = sem.courses.filter(c => curMatchesQuery(c, q));
            if (matches.length) groups.push({ year, sem, matches });
        }));

        if (!groups.length) {
            el.innerHTML = `
                <div class="cur-empty">
                    <div class="empty-icon-circle" aria-hidden="true"><i class="icon-lucide-search"></i></div>
                    <p>No subjects match "<strong>${escHtml(q)}</strong>".</p>
                </div>`;
            return;
        }

        el.innerHTML = groups.map((g, gi) => `
            <div class="cur-list-group mb-3">
                ${curProgramReminderHtml()}
                <div class="cur-list-header mb-2">
                    <span class="cur-list-header-title">${escHtml(g.year.yearLabel)} • ${escHtml(g.sem.semesterLabel)}</span>
                    <span class="cur-sem-meta">${g.matches.length} subject${g.matches.length === 1 ? '' : 's'}</span>
                </div>
                ${curCourseListBlockHtml(g.matches, `search-${gi}`, hasHours)}
            </div>`).join('');
        curBindCourseSelection(data);
        return;
    }

    const year = data.years.find(y => y.yearLevel === curViewState.activeYear) || data.years[0];
    const sem = year.semesters[curViewState.activeSemester - 1] || year.semesters[0];
    const groupId = `${year.yearLevel}-${curViewState.activeSemester}`;

    const summary = curSelectionSummary(sem.courses);
    el.innerHTML = `
        ${curProgramReminderHtml()}
        ${curImportMessage ? `<div class="cur-import-notice" role="alert">${curImportMessage}</div>` : ''}
        <div class="cur-list-header mb-2">
            <span class="cur-list-header-title">${escHtml(year.yearLabel)} • ${escHtml(sem.semesterLabel)}</span>
            <span class="cur-sem-meta">${sem.courses.length} subject${sem.courses.length === 1 ? '' : 's'} <span class="cur-sem-dot">·</span> ${curSemUnits(sem)} units</span>
        </div>
        <div class="cur-selection-toolbar">
            <div><strong>${summary.count}</strong> selected <span class="cur-sem-dot">·</span> <strong>${summary.units}</strong> units</div>
            <div class="cur-selection-actions">
                <button type="button" class="btn btn-ghost btn-sm" onclick="curSelectAll()" ${curCanImport() ? '' : 'disabled'}>Select All</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="curDeselectAll()" ${curCanImport() ? '' : 'disabled'}>Deselect All</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="curClearSelection()" ${curCanImport() ? '' : 'disabled'}>Clear Selection</button>
                <button type="button" class="btn btn-accent btn-sm" onclick="curAddSelected()" ${summary.count ? '' : 'disabled'}><i class="icon-lucide-plus me-1" aria-hidden="true"></i>Add Selected</button>
            </div>
        </div>
        ${curCourseListBlockHtml(sem.courses, groupId, hasHours)}`;
    curBindCourseSelection(data);
}

function curBindCourseSelection(data) {
    const el = curEl('curYearResults');
    if (!el) return;
    el.querySelectorAll('.cur-select-course').forEach(control => {
        const toggle = event => {
            event.preventDefault();
            event.stopPropagation();
            if (control.getAttribute('aria-disabled') === 'true') return;
            const selected = control.getAttribute('aria-checked') === 'true';
            if (selected) curSelectedCourses.delete(control.dataset.courseCode);
            else curSelectedCourses.add(control.dataset.courseCode);
            renderCurResults(data);
        };
        control.addEventListener('click', toggle);
        control.addEventListener('keydown', event => {
            if (event.key === ' ' || event.key === 'Enter') toggle(event);
        });
    });
}

function curSelectAll() {
    if (!curCanImport()) return;
    const year = curViewState.activeYear;
    const data = curStructuredCache[getSelectedProgram()];
    const sem = data && (data.years.find(y => y.yearLevel === year) || data.years[0]).semesters[curViewState.activeSemester - 1];
    if (!sem) return;
    sem.courses.forEach(c => { if (!curCourseAlreadyAdded(c)) curSelectedCourses.add(c.code); });
    renderCurResults(data);
}
function curDeselectAll() {
    const data = curStructuredCache[getSelectedProgram()];
    const sem = data && (data.years.find(y => y.yearLevel === curViewState.activeYear) || data.years[0]).semesters[curViewState.activeSemester - 1];
    if (sem) sem.courses.forEach(c => curSelectedCourses.delete(c.code));
    renderCurResults(data);
}
function curClearSelection() { curSelectedCourses.clear(); const data = curStructuredCache[getSelectedProgram()]; if (data) renderCurResults(data); }

function curAddSelected() {
    if (!curCanImport()) {
        curImportMessage = curProgramReminderHtml();
        const lockedData = curStructuredCache[getSelectedProgram()]; if (lockedData) renderCurResults(lockedData);
        return;
    }
    const sem = curActiveSemesterForImport();
    if (!sem) {
        curImportMessage = '<i class="icon-lucide-triangle-alert" aria-hidden="true"></i><span>No active university academic period is available yet. Contact your QCU administrator before importing subjects.</span>';
        const data = curStructuredCache[getSelectedProgram()]; if (data) renderCurResults(data);
        return;
    }
    const data = curStructuredCache[getSelectedProgram()];
    const year = data.years.find(y => y.yearLevel === curViewState.activeYear) || data.years[0];
    const semData = year.semesters[curViewState.activeSemester - 1] || year.semesters[0];
    const subjects = DB.getSubjects();
    const existingCodes = new Set(subjects.filter(s => s.semesterId === sem.id).map(s => String(s.code || '').toLowerCase()));
    const selected = semData.courses.filter(c => curSelectedCourses.has(c.code) && !existingCodes.has(String(c.code).toLowerCase()));
    selected.forEach(c => subjects.push({ id: DB.uid(), code: c.code, desc: c.title, type: c.labHours ? 'Laboratory' : 'Lecture', units: Number(c.units || 0), section: '', days: [], start: '', end: '', online: false, room: '', building: '', professor: '', email: '', color: DB.colors[subjects.length % DB.colors.length], notes: c.prerequisites && c.prerequisites.length ? `Prerequisites: ${c.prerequisites.join(', ')}` : '', semester: sem.name, schoolYear: sem.schoolYear, semesterId: sem.id, archived: false, source: 'curriculum', setupStatus: 'needs_setup', curriculumKey: `${getSelectedProgram()}:${curViewState.activeYear}:${curViewState.activeSemester}:${c.code}` }));
    if (selected.length && DB.saveSubjects(subjects) === false) { curImportMessage = '<i class="icon-lucide-triangle-alert" aria-hidden="true"></i><span>Could not save the selected subjects on this device. Please try again.</span>'; }
    else { const skipped = curSelectedCourses.size - selected.length; curImportMessage = selected.length ? `<i class="icon-lucide-circle-check" aria-hidden="true"></i><span>${selected.length} subject${selected.length === 1 ? '' : 's'} added to ${escHtml(sem.name)}. Complete their details in Schedule.${skipped ? ` ${skipped} already existed and were skipped.` : ''}</span>` : `<i class="icon-lucide-info" aria-hidden="true"></i><span>Those subjects are already in this semester.</span>`; curSelectedCourses.clear(); }
    renderCurResults(data);
}


// ============================================================
// CURRICULUM TRACKER
// Uses curriculum JSON + profile + active semester + existing subject/grade rows.
// It never writes academic history and counts each curriculum course once.
// ============================================================

function trackerNormalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[\s._-]+/g, '');
}

function trackerYearNumber(value) {
    const text = String(value || '').toLowerCase();
    const words = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4 };
    const word = Object.keys(words).find(key => text.includes(key));
    if (word) return words[word];
    const match = text.match(/[1-4]/);
    return match ? Number(match[0]) : 0;
}

function trackerSemesterNumber(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('2nd') || text.includes('second')) return 2;
    if (text.includes('1st') || text.includes('first')) return 1;
    return 0;
}

function trackerExplicitActiveSemester() {
    const id = DB.getActiveSemesterId();
    if (!id) return null;
    return DB.getSemesters().find(s => s.id === id) || null;
}

function trackerGradeForSubjects(subjectRows) {
    const grades = DB.getGrades().map(g => {
        const copy = JSON.parse(JSON.stringify({ ...g, components: Array.isArray(g.components) ? g.components : [] }));
        return typeof normalizeGradeRecord === 'function' ? normalizeGradeRecord(copy) : copy;
    });
    const byId = new Map(grades.map(g => [g.subjectId, g]));
    let passing = false, failed = false, hasGradeRecord = false, pct = null;
    subjectRows.forEach(subject => {
        const grade = byId.get(subject.id);
        if (!grade) return;
        hasGradeRecord = true;
        const finalPct = typeof computeSubjectFinalPct === 'function' ? computeSubjectFinalPct(grade.components) : null;
        if (finalPct !== null && typeof isPassingPct === 'function') {
            pct = pct === null ? finalPct : Math.max(pct, finalPct);
            if (isPassingPct(finalPct)) passing = true;
            else failed = true;
        }
    });
    return { passing, failed, hasGradeRecord, pct };
}

function trackerGetOverrides() {
    try { return DB.getSettings().curriculumStatusOverrides || {}; } catch (error) { return {}; }
}

function trackerGetOverride(code) {
    return trackerGetOverrides()[trackerNormalizeCode(code)] || '';
}

function trackerSetStatus(code, status) {
    const openKeys = [...document.querySelectorAll('#curTrackerMain details[open][data-tracker-key]')]
        .map(details => details.dataset.trackerKey);
    const overrides = trackerGetOverrides();
    const key = trackerNormalizeCode(code);
    if (!status) delete overrides[key];
    else overrides[key] = status;
    try {
        const settings = DB.getSettings();
        settings.curriculumStatusOverrides = overrides;
        DB.saveSettings(settings);
    } catch (error) { /* keep the automatic status if preferences cannot be saved */ }
    const program = getSelectedProgram();
    const data = curStructuredCache[program];
    if (!data) return;
    renderCurriculumTracker(data, program);
    const openKeySet = new Set(openKeys);
    document.querySelectorAll('#curTrackerMain details[data-tracker-key]').forEach(details => {
        if (openKeySet.has(details.dataset.trackerKey)) details.open = true;
    });
}

function trackerAutoCompleteContext(course, activeSemester) {
    const registeredYear = trackerYearNumber(curRegisteredYearLevel);
    const activeYear = activeSemester && (activeSemester.yearLevel || activeSemester.year_level) ? trackerYearNumber(activeSemester.yearLevel || activeSemester.year_level) : registeredYear;
    const activeSemNo = trackerSemesterNumber(activeSemester && activeSemester.name);
    if (!registeredYear || !activeSemNo) return false;
    return course.yearLevel < activeYear || (course.yearLevel === activeYear && course.semesterIndex + 1 < activeSemNo);
}

function trackerSubjectRows(code) {
    const key = trackerNormalizeCode(code);
    return DB.getSubjects().filter(s => !s.archived && trackerNormalizeCode(s.code) === key);
}

function trackerClassify(course, activeSemester) {
    const rows = trackerSubjectRows(course.code);
    const grade = trackerGradeForSubjects(rows);
    const activeId = activeSemester ? activeSemester.id : null;
    const activeRows = rows.filter(s => activeId && s.semesterId === activeId);
    const confirmedActive = activeRows.some(s => s.setupStatus !== 'needs_setup');
    const override = trackerGetOverride(course.code);
    let status = 'not-taken';
    let label = 'Not Taken';
    let detail = 'No confirmed subject record yet.';
    let inferred = false;
    if (override) {
        status = override;
        label = { completed: 'Completed', ongoing: 'Ongoing', 'not-taken': 'Not Taken', 'needs-verification': 'Needs Verification' }[status] || 'Not Taken';
        detail = 'Status set by you from the tracker.';
    } else if (grade.passing) {
        status = 'completed';
        label = 'Completed';
        detail = `Verified passing grade${grade.pct !== null ? ` · ${grade.pct.toFixed(1)}%` : ''}`;
    } else if (grade.failed) {
        status = 'needs-verification';
        label = 'Needs Verification';
        detail = 'A recorded grade is below the passing threshold; review the subject and any repeat record.';
    } else if (trackerAutoCompleteContext(course, activeSemester)) {
        status = 'completed';
        label = 'Completed';
        inferred = true;
        detail = 'Marked complete from your registered year level and active semester. Edit the status if this is incorrect.';
    } else if (activeSemester && confirmedActive) {
        status = 'ongoing';
        label = 'Ongoing';
        detail = 'Confirmed in the active semester; no verified passing grade yet.';
    } else if (activeSemester && activeRows.length && activeRows.every(s => s.setupStatus === 'needs_setup')) {
        status = 'not-taken';
        label = 'Not Taken';
        detail = 'Imported for reference but still awaiting setup; not counted as ongoing.';
    } else if (rows.length) {
        status = 'needs-verification';
        label = 'Needs Verification';
        detail = grade.hasGradeRecord ? 'Grade record is incomplete.' : 'Subject history exists without enough academic data to confirm completion.';
    }
    return { course, rows, activeRows, grade, status, label, detail, inferred, override };
}
function trackerBuildModel(data, activeSemester) {
    const items = [];
    data.years.forEach(year => year.semesters.forEach((semester, semesterIndex) => {
        semester.courses.forEach(course => {
            items.push({ ...trackerClassify({ ...course, yearLevel: year.yearLevel, semesterIndex }, activeSemester), year, semester, semesterIndex });
        });
    }));
    const unique = new Map();
    items.forEach(item => {
        const key = trackerNormalizeCode(item.course.code);
        const current = unique.get(key);
        // A curriculum code is counted once. Prefer a verified completion record,
        // then active enrollment, when repeated curriculum rows exist.
        if (!current || (item.status === 'completed' && current.status !== 'completed') ||
            (item.status === 'ongoing' && current.status === 'not-taken')) unique.set(key, item);
    });
    return { items, uniqueItems: [...unique.values()] };
}

function trackerStatusClass(status) {
    return { completed: 'cur-tracker-status-completed', ongoing: 'cur-tracker-status-ongoing', 'not-taken': 'cur-tracker-status-not-taken', 'needs-verification': 'cur-tracker-status-needs' }[status] || 'cur-tracker-status-not-taken';
}

function trackerStatusIcon(status) {
    return { completed: 'icon-lucide-circle-check', ongoing: 'icon-lucide-repeat', 'not-taken': 'icon-lucide-circle-minus', 'needs-verification': 'icon-lucide-circle-help' }[status] || 'icon-lucide-circle-minus';
}

function trackerStatusBadge(item) {
    return `<span class="cur-tracker-status ${trackerStatusClass(item.status)}"><i class="${trackerStatusIcon(item.status)}" aria-hidden="true"></i>${item.label}</span>`;
}

function trackerContextHtml(activeSemester, model, data) {
    const registeredYear = trackerYearNumber(curRegisteredYearLevel);
    const semesterYear = activeSemester && (activeSemester.yearLevel || activeSemester.year_level) ? trackerYearNumber(activeSemester.yearLevel || activeSemester.year_level) : 0;
    const mismatch = registeredYear && semesterYear && registeredYear !== semesterYear;
    const currentItems = model.uniqueItems.filter(item => item.status === 'ongoing');
    const currentUnits = currentItems.reduce((sum, item) => sum + Number(item.course.units || 0), 0);
    const completedUnits = model.uniqueItems.filter(i => i.status === 'completed').reduce((sum, i) => sum + Number(i.course.units || 0), 0);
    const totalUnits = Number(data.totalUnits || model.uniqueItems.reduce((sum, i) => sum + Number(i.course.units || 0), 0));
    const pct = totalUnits > 0 ? Math.min(100, (completedUnits / totalUnits) * 100) : 0;
    return `<div class="cur-tracker-context cur-tracker-current-card">
      <div class="cur-tracker-context-main"><span class="cur-tracker-eyebrow">CURRENT YEAR & TERM</span><strong>${escHtml(curRegisteredYearLevel || 'Year level not available')}</strong><span class="cur-tracker-context-term">${activeSemester ? `${escHtml(activeSemester.schoolYear || 'Academic year unavailable')} · ${escHtml(activeSemester.name || 'Semester unavailable')}` : 'No active university academic period'}</span></div>
      <div class="cur-tracker-current-progress"><span class="cur-tracker-eyebrow">CURRICULUM PROGRESS</span><strong>${pct.toFixed(1)}%</strong><span>${completedUnits} of ${totalUnits} units completed</span></div>
      <div class="cur-tracker-current-bar"><div class="cur-tracker-progress-bar"><span style="width:${pct.toFixed(1)}%"></span></div></div>
      <div class="cur-tracker-context-stats"><span><b>${currentItems.length}</b> taking now</span><span><b>${currentUnits}</b> units enrolled</span></div>
      ${mismatch ? `<div class="cur-tracker-warning" role="alert"><i class="icon-lucide-triangle-alert" aria-hidden="true"></i>Registered year level and active semester year level do not match. The tracker is using your registered year level as the reference.</div>` : ''}
    </div>`;
}

function trackerOverviewHtml(model) {
    const completed = model.uniqueItems.filter(i => i.status === 'completed');
    const ongoing = model.uniqueItems.filter(i => i.status === 'ongoing');
    const verify = model.uniqueItems.filter(i => i.status === 'needs-verification');
    const stat = (label, count, units, cls) => `<div class="cur-tracker-stat ${cls}"><span class="cur-tracker-stat-value">${count}</span><span class="cur-tracker-stat-label">${label}</span><span class="cur-tracker-stat-units">${units} units</span></div>`;
    return `<div class="cur-tracker-overview"><div class="cur-tracker-stats">${stat('Completed', completed.length, completed.reduce((sum, i) => sum + Number(i.course.units || 0), 0), 'cur-tracker-stat-done')}${stat('Ongoing', ongoing.length, ongoing.reduce((sum, i) => sum + Number(i.course.units || 0), 0), 'cur-tracker-stat-current')}${stat('Not Taken', model.uniqueItems.filter(i => i.status === 'not-taken').length, model.uniqueItems.filter(i => i.status === 'not-taken').reduce((sum, i) => sum + Number(i.course.units || 0), 0), 'cur-tracker-stat-muted')}${stat('Needs Verification', verify.length, verify.reduce((sum, i) => sum + Number(i.course.units || 0), 0), 'cur-tracker-stat-warning')}</div></div>`;
}

function trackerStatusEditorHtml(item) {
    const options = [['completed', 'Completed'], ['ongoing', 'Ongoing'], ['not-taken', 'Not Taken'], ['needs-verification', 'Needs Verification']];
    return `<div class="cur-tracker-editor"><span class="cur-tracker-detail-label">Edit tracker status</span><div class="cur-tracker-editor-actions">${options.map(([value, label]) => `<button type="button" class="btn btn-ghost btn-sm ${item.status === value ? 'active' : ''}" onclick="trackerSetStatus('${escHtml(item.course.code)}','${value}')">${label}</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" onclick="trackerSetStatus('${escHtml(item.course.code)}','')">Use Automatic</button></div></div>`;
}

function trackerSubjectRowHtml(item) {
    const subject = item.rows.find(s => s.semesterId === (trackerExplicitActiveSemester() || {}).id) || item.rows[0];
    const grade = item.grade.pct !== null ? `${item.grade.pct.toFixed(1)}%` : 'No verified grade';
    const prereqs = (item.course.prerequisites || []).length ? item.course.prerequisites.map(p => `<span class="cur-badge">${escHtml(p)}</span>`).join('') : '<span class="cur-num">NONE</span>';
    const trackerKey = `subject-${item.year.yearLevel}-${item.semesterIndex}-${trackerNormalizeCode(item.course.code)}`;
    return `<details class="cur-tracker-subject" data-tracker-key="${escHtml(trackerKey)}"><summary><span class="cur-tracker-subject-main"><span class="cur-tracker-subject-code">${escHtml(item.course.code)}</span><span class="cur-tracker-subject-name">${escHtml(item.course.title)}</span></span><span class="cur-tracker-subject-meta"><span class="cur-tracker-subject-units">${item.course.units} units</span>${trackerStatusBadge(item)}</span></summary><div class="cur-tracker-subject-detail"><div><span class="cur-tracker-detail-label">Curriculum</span>${escHtml(item.year.yearLabel)} · ${escHtml(item.semester.semesterLabel)}</div><div><span class="cur-tracker-detail-label">Grade</span>${grade}</div><div><span class="cur-tracker-detail-label">Prerequisites</span><span class="cur-tracker-prereqs">${prereqs}</span></div><p>${escHtml(item.detail)}</p>${trackerStatusEditorHtml(item)}<div class="cur-tracker-links"><a class="btn btn-ghost btn-sm" href="schedule.html${subject ? `?subject=${encodeURIComponent(subject.id)}` : ''}"><i class="icon-lucide-calendar-days me-1" aria-hidden="true"></i>View Subject</a><a class="btn btn-ghost btn-sm" href="grades.html${subject ? `?subject=${encodeURIComponent(subject.id)}` : ''}"><i class="icon-lucide-graduation-cap me-1" aria-hidden="true"></i>View Grade</a></div></div></details>`;
}

function trackerBreakdownHtml(model, data, activeSemester) {
    const registeredYear = trackerYearNumber(curRegisteredYearLevel);
    const activeSemNo = trackerSemesterNumber(activeSemester && activeSemester.name);
    return `<div class="cur-tracker-breakdown"><div class="cur-tracker-section-heading"><div><span class="cur-tracker-eyebrow">REQUIREMENTS BY YEAR</span><h2>Academic progress</h2></div><span class="cur-tracker-hint">Select a year or semester to inspect subjects</span></div>${data.years.map(year => { const yearItems = model.items.filter(i => i.year.yearLevel === year.yearLevel); const yearDone = yearItems.filter(i => i.status === 'completed').reduce((sum, i) => sum + Number(i.course.units || 0), 0); const yearTotal = yearItems.reduce((sum, i) => sum + Number(i.course.units || 0), 0); const isCurrent = year.yearLevel === registeredYear; return `<details class="cur-tracker-year" data-tracker-key="year-${year.yearLevel}"><summary><span class="cur-tracker-year-number">${year.yearLevel}</span><span class="cur-tracker-year-title">${escHtml(year.yearLabel)}</span>${isCurrent ? '<span class="cur-tracker-current-chip">CURRENT YEAR</span>' : ''}<span class="cur-tracker-year-progress">${yearDone} / ${yearTotal} units</span></summary><div class="cur-tracker-year-body">${year.semesters.map((semester, si) => { const semItems = yearItems.filter(i => i.semester === semester); const required = semItems.reduce((sum, i) => sum + Number(i.course.units || 0), 0); const done = semItems.filter(i => i.status === 'completed').reduce((sum, i) => sum + Number(i.course.units || 0), 0); const ongoing = semItems.filter(i => i.status === 'ongoing').reduce((sum, i) => sum + Number(i.course.units || 0), 0); const currentSem = isCurrent && activeSemNo && activeSemNo === si + 1; const semPct = required ? (done / required) * 100 : 0; return `<details class="cur-tracker-semester" data-tracker-key="semester-${year.yearLevel}-${si}"><summary><span>${escHtml(semester.semesterLabel)}</span>${currentSem ? '<span class="cur-tracker-current-chip">ACTIVE</span>' : ''}<span class="cur-tracker-sem-meta">${done} completed · ${ongoing} ongoing · ${required} units</span></summary><div class="cur-tracker-sem-body"><div class="cur-tracker-sem-progress"><span style="width:${Math.min(100, semPct).toFixed(1)}%"></span></div><div class="cur-tracker-sem-caption">${semPct.toFixed(1)}% complete · ${semItems.length} subjects · ${Math.max(0, required - done)} units remaining</div>${semItems.map(trackerSubjectRowHtml).join('')}</div></details>`; }).join('')}</div></details>`; }).join('')}</div>`;
}

function renderCurriculumTracker(data, code) {
    const statsHost = document.getElementById('curTrackerStats');
    const mainHost = document.getElementById('curTrackerMain');
    if (!statsHost || !mainHost) return;
    if (curRegisteredProgram && code !== curRegisteredProgram) {
        statsHost.innerHTML = '';
        mainHost.innerHTML = `<div class="cur-tracker-locked"><i class="icon-lucide-info" aria-hidden="true"></i><span>The tracker follows your registered program. Switch back to <strong>${escHtml(CURRICULA[curRegisteredProgram] ? CURRICULA[curRegisteredProgram].title : curRegisteredProgram)}</strong> to view your progress.</span></div>`;
        return;
    }
    const activeSemester = trackerExplicitActiveSemester();
    const model = trackerBuildModel(data, activeSemester);
    statsHost.innerHTML = `${trackerContextHtml(activeSemester, model, data)}${trackerOverviewHtml(model)}`;
    mainHost.innerHTML = trackerBreakdownHtml(model, data, activeSemester);
}

import { requireAdmin } from './admin-guard.js';
import { AcademicCalendarService } from '../services/academic-calendar-service.js';
import { mountAdminTopbar, renderErrorWithRetry, escHtml } from './admin-shared.js';

let calendar = { available: false, academicYears: [], semesters: [], activeSemester: null };
let editingYearId = null;
let editingSemesterId = null;

function dateLabel(value) {
    if (!value) return 'Date not set';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusClass(status) {
    return `ac-status ac-status-${escHtml(status || 'planned')}`;
}

function renderCalendar() {
    const active = document.getElementById('acActive');
    const yearsHost = document.getElementById('acYears');
    const addSemester = document.getElementById('acAddSemester');
    if (!calendar.available) {
        active.innerHTML = '<div class="ac-empty-period"><i class="icon-lucide-hard-drive" aria-hidden="true"></i><div><strong>Calendar migration not installed</strong><span>Run migration 0031_centralized_academic_calendar.sql in the Supabase Dashboard SQL Editor before managing academic periods.</span></div></div>';
        yearsHost.innerHTML = '';
        addSemester.disabled = true;
        return;
    }
    addSemester.disabled = !calendar.academicYears.length;
    active.innerHTML = calendar.activeSemester
        ? `<div class="ac-active-icon"><i class="icon-lucide-calendar-check-2" aria-hidden="true"></i></div><div class="ac-active-copy"><span class="ac-eyebrow">CURRENT UNIVERSITY ACADEMIC PERIOD</span><strong>${escHtml(calendar.activeSemester.academicYear)} · ${escHtml(calendar.activeSemester.name)}</strong><span>${dateLabel(calendar.activeSemester.startDate)} – ${dateLabel(calendar.activeSemester.endDate)} · Visible to all approved students</span></div><span class="${statusClass('active')}">Active</span>`
        : '<div class="ac-empty-period"><i class="icon-lucide-calendar-x-2" aria-hidden="true"></i><div><strong>No active semester</strong><span>Create an academic year and semester, then activate one to publish the university calendar to students.</span></div></div>';

    if (!calendar.academicYears.length) {
        yearsHost.innerHTML = '<div class="ac-empty">No academic years yet. Add an academic year to begin.</div>';
        return;
    }
    yearsHost.innerHTML = [...calendar.academicYears].sort((a, b) => b.start_date.localeCompare(a.start_date)).map(year => {
        const semesters = calendar.semesters.filter(sem => sem.academicYearId === year.id).sort((a, b) => a.startDate.localeCompare(b.startDate));
        return `<section class="ac-year" data-year-id="${year.id}">
          <header class="ac-year-head"><div><strong>${escHtml(year.name)}</strong><span>${dateLabel(year.start_date)} – ${dateLabel(year.end_date)}</span></div><div class="ac-year-actions"><span class="${statusClass(year.status)}">${escHtml(year.status)}</span><button type="button" class="btn btn-ghost btn-sm" data-action="edit-year" data-id="${year.id}" aria-label="Edit ${escHtml(year.name)}"><i class="icon-lucide-pencil" aria-hidden="true"></i><span>Edit year</span></button><button type="button" class="btn btn-ghost btn-sm" data-action="add-semester" data-year="${year.id}"><i class="icon-lucide-plus" aria-hidden="true"></i><span>Add semester</span></button></div></header>
          ${semesters.length ? `<div class="ac-semester-list">${semesters.map(sem => `<article class="ac-semester ${sem.status === 'active' ? 'is-active' : ''}"><div class="ac-semester-main"><strong>${escHtml(sem.name)}</strong><span>${dateLabel(sem.startDate)} – ${dateLabel(sem.endDate)}</span></div><span class="${statusClass(sem.status)}">${escHtml(sem.status)}</span><div class="ac-semester-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-semester" data-id="${sem.id}" aria-label="Edit ${escHtml(sem.name)}"><i class="icon-lucide-pencil" aria-hidden="true"></i><span>Edit</span></button>${sem.status !== 'active' && sem.status !== 'archived' ? `<button type="button" class="btn btn-accent btn-sm" data-action="activate" data-id="${sem.id}"><i class="icon-lucide-check" aria-hidden="true"></i><span>Set active</span></button>` : ''}${sem.status !== 'active' && sem.status !== 'archived' ? `<button type="button" class="btn btn-ghost btn-sm" data-action="archive" data-id="${sem.id}"><i class="icon-lucide-archive" aria-hidden="true"></i><span>Archive</span></button>` : ''}</div></article>`).join('')}</div>` : '<div class="ac-empty-year">No semesters in this academic year.</div>'}
        </section>`;
    }).join('');
}

async function loadCalendar() {
    const host = document.getElementById('acYears');
    host.setAttribute('aria-busy', 'true');
    const result = await AcademicCalendarService.getCalendar();
    host.removeAttribute('aria-busy');
    if (!result.ok) {
        renderErrorWithRetry(host, result.message, loadCalendar);
        return;
    }
    calendar = result.data;
    if (typeof DB !== 'undefined') DB.setUniversityCalendar(calendar);
    renderCalendar();
}

function openYearModal(id = null) {
    const year = calendar.academicYears.find(item => item.id === id);
    editingYearId = id;
    editingSemesterId = null;
    document.getElementById('acModalTitle').textContent = year ? 'Edit Academic Year' : 'Add Academic Year';
    document.getElementById('acModalBody').innerHTML = `<form id="acYearForm" class="ac-form"><label for="acYearName">Academic year</label><input class="form-control" id="acYearName" required maxlength="30" placeholder="2026–2027" value="${year ? escHtml(year.name) : ''}"><div class="ac-form-grid"><div><label for="acYearStart">Start date</label><input class="form-control" type="date" id="acYearStart" required value="${year ? year.start_date : ''}"></div><div><label for="acYearEnd">End date</label><input class="form-control" type="date" id="acYearEnd" required value="${year ? year.end_date : ''}"></div></div><div class="modal-actions"><button class="btn btn-accent" type="submit">${year ? 'Save changes' : 'Create academic year'}</button></div></form>`;
    document.getElementById('acYearForm').addEventListener('submit', saveYear);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('acModal')).show();
}

function openSemesterModal(id = null, yearId = null) {
    const semester = calendar.semesters.find(item => item.id === id);
    editingSemesterId = id;
    editingYearId = null;
    const availableYears = calendar.academicYears.filter(year => year.status !== 'archived');
    const selectedYearId = yearId || (semester && semester.academicYearId) || (availableYears[0] && availableYears[0].id) || '';
    document.getElementById('acModalTitle').textContent = semester ? 'Edit Semester' : 'Add Semester';
    document.getElementById('acModalBody').innerHTML = `<form id="acSemesterForm" class="ac-form"><label for="acSemesterYear">Academic year</label><select class="form-select" id="acSemesterYear" required>${availableYears.map(year => `<option value="${year.id}" ${year.id === selectedYearId ? 'selected' : ''}>${escHtml(year.name)}</option>`).join('')}</select><label for="acSemesterName">Semester</label><select class="form-select" id="acSemesterName" required>${['1st Semester', '2nd Semester', 'Summer'].map(name => `<option ${semester && semester.name === name ? 'selected' : ''}>${name}</option>`).join('')}</select><div class="ac-form-grid"><div><label for="acSemesterStart">Start date</label><input class="form-control" type="date" id="acSemesterStart" required value="${semester ? semester.startDate : ''}"></div><div><label for="acSemesterEnd">End date</label><input class="form-control" type="date" id="acSemesterEnd" required value="${semester ? semester.endDate : ''}"></div></div><div class="modal-actions"><button class="btn btn-accent" type="submit">${semester ? 'Save changes' : 'Create semester'}</button></div></form>`;
    document.getElementById('acSemesterForm').addEventListener('submit', saveSemester);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('acModal')).show();
}

async function submitForm(form, action) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const result = await action();
    button.disabled = false;
    if (!result.ok) {
        Toast.show(result.message, 'danger', 'icon-lucide-triangle-alert');
        return;
    }
    bootstrap.Modal.getInstance(document.getElementById('acModal')).hide();
    Toast.show('Academic calendar saved.', 'accent', 'icon-lucide-circle-check');
    await loadCalendar();
}

function saveYear(event) {
    event.preventDefault();
    const form = event.currentTarget;
    return submitForm(form, () => AcademicCalendarService.upsertAcademicYear({
        id: editingYearId,
        name: document.getElementById('acYearName').value.trim(),
        startDate: document.getElementById('acYearStart').value,
        endDate: document.getElementById('acYearEnd').value,
    }));
}

function saveSemester(event) {
    event.preventDefault();
    const form = event.currentTarget;
    return submitForm(form, () => AcademicCalendarService.upsertSemester({
        id: editingSemesterId,
        academicYearId: document.getElementById('acSemesterYear').value,
        name: document.getElementById('acSemesterName').value,
        startDate: document.getElementById('acSemesterStart').value,
        endDate: document.getElementById('acSemesterEnd').value,
    }));
}

function onAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const { action, id, year } = button.dataset;
    if (action === 'edit-year') return openYearModal(id);
    if (action === 'add-semester') return openSemesterModal(null, year);
    if (action === 'edit-semester') return openSemesterModal(id);
    const semester = calendar.semesters.find(item => item.id === id);
    if (!semester) return;
    if (action === 'activate') {
        confirmAction({
            title: `Set ${semester.academicYear} · ${semester.name} as active?`,
            message: 'This changes the academic period displayed throughout the planner for every student at QCU. Existing student records will remain in their original semesters.',
            confirmLabel: 'Set university active period',
            icon: 'icon-lucide-calendar-check-2',
            onConfirm: async () => {
                const result = await AcademicCalendarService.activateSemester(id);
                if (!result.ok) Toast.show(result.message, 'danger', 'icon-lucide-triangle-alert');
                else { Toast.show('University active semester updated.', 'accent', 'icon-lucide-circle-check'); await loadCalendar(); }
            },
        });
    } else if (action === 'archive') {
        confirmAction({
            title: `Archive ${semester.academicYear} · ${semester.name}?`,
            message: 'The semester will remain available for historical records and cannot be activated again. No student records will be deleted.',
            confirmLabel: 'Archive semester',
            icon: 'icon-lucide-archive',
            onConfirm: async () => {
                const result = await AcademicCalendarService.archiveSemester(id);
                if (!result.ok) Toast.show(result.message, 'danger', 'icon-lucide-triangle-alert');
                else { Toast.show('Semester archived.', 'accent', 'icon-lucide-circle-check'); await loadCalendar(); }
            },
        });
    }
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;
    renderShell('admin-academic-calendar', admin);
    mountAdminTopbar(admin);
    document.getElementById('acAddYear').addEventListener('click', () => openYearModal());
    document.getElementById('acAddSemester').addEventListener('click', () => openSemesterModal());
    document.getElementById('acYears').addEventListener('click', onAction);
    await loadCalendar();
}

init();

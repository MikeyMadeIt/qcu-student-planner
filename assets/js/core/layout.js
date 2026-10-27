/* ============================================================
   NAV
   ============================================================ */
const NAV_ITEMS = [
    { href: 'dashboard.html', icon: 'bi-grid-1x2-fill', label: 'Dashboard', key: 'dashboard' },
    { href: 'schedule.html', icon: 'bi-calendar2-week-fill', label: 'Schedule', key: 'schedule' },
    { href: 'tasks.html', icon: 'bi-check2-square', label: 'Tasks', key: 'tasks' },
    { href: 'calendar.html', icon: 'bi-calendar3', label: 'Calendar', key: 'calendar' },
    { href: 'grades.html', icon: 'bi-mortarboard-fill', label: 'Grades', key: 'grades' },
    { href: 'attendance.html', icon: 'bi-person-check-fill', label: 'Attendance', key: 'attendance' },
    { href: 'syllabus.html', icon: 'bi-journal-bookmark-fill', label: 'Syllabus', key: 'syllabus' },
    { href: 'notes.html', icon: 'bi-journal-text', label: 'Notes', key: 'notes' },
    { href: 'university.html', icon: 'bi-building-fill', label: 'University', key: 'university' },
    { href: 'curriculum.html', icon: 'bi-book-half', label: 'Curriculum', key: 'curriculum' },
    { href: 'wallpaper.html', icon: 'bi-phone-fill', label: 'Wallpaper', key: 'wallpaper' },
    { href: 'settings.html', icon: 'bi-gear-fill', label: 'Settings', key: 'settings' },
];
const THEME_OPTIONS = [
    { value: 'dark', label: 'Dark', icon: 'bi-moon-stars' },
    { value: 'light', label: 'Light', icon: 'bi-sun' },
    { value: 'amoled', label: 'AMOLED', icon: 'bi-circle-fill' }
];
const PAGE_SECTIONS = {
    dashboard: 'Overview',
    schedule: 'Academics',
    tasks: 'Academics',
    calendar: 'Academics',
    grades: 'Academics',
    attendance: 'Academics',
    syllabus: 'Academics',
    notes: 'Academics',
    university: 'University',
    curriculum: 'University',
    wallpaper: 'App',
    settings: 'App',
    admin: 'Administration'
};
function renderShellBar(activeKey) {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('shellBar'))
        return;
    const settings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
    const name = (settings.name || '').trim() || 'Student';
    const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
    const navItem = NAV_ITEMS.find(item => item.key === activeKey);
    const pageLabel = navItem ? navItem.label : 'Account verification';
    const pageIcon = navItem ? navItem.icon : 'bi-shield-check';
    const sectionLabel = PAGE_SECTIONS[activeKey] || '';
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const activeSemester = (typeof DB !== 'undefined') ? DB.getActiveSemester() : null;
    const semesterChip = activeSemester
        ? `<span class="shell-semester" title="Active semester"><i class="bi bi-calendar3" aria-hidden="true"></i>${escHtml(activeSemester.schoolYear)} &bull; ${escHtml(activeSemester.name)}</span>`
        : '';
    const themeButtons = THEME_OPTIONS.map(option => `
        <button type="button" class="theme-option" data-theme-value="${option.value}"
            role="radio" aria-checked="${option.value === currentTheme}">
            <i class="bi ${option.icon}" aria-hidden="true"></i>
            <span>${option.label}</span>
        </button>`).join('');
    const bar = document.createElement('header');
    bar.id = 'shellBar';
    bar.className = 'shell-bar';
    bar.innerHTML = `
        <button type="button" class="shell-menu-btn" data-drawer-open aria-haspopup="dialog" aria-expanded="false" aria-label="Open navigation menu">
            <i class="bi bi-list" aria-hidden="true"></i>
        </button>
        <a class="shell-brand" href="../app/dashboard.html" aria-label="QCU Planner dashboard">
            <span class="dot"><i class="bi bi-mortarboard" aria-hidden="true"></i></span>
            <span>QCU Planner</span>
        </a>
        <nav class="shell-crumbs" aria-label="Breadcrumb">
            <span>${escHtml(sectionLabel)}</span>
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
            <span class="shell-crumb-current"><i class="bi ${pageIcon}" aria-hidden="true"></i>${escHtml(pageLabel)}</span>
        </nav>
        ${semesterChip}
        <div class="profile-menu" id="profileMenu">
            <button type="button" class="profile-trigger" id="profileTrigger"
                aria-haspopup="true" aria-expanded="false" aria-controls="profilePanel">
                <span class="profile-avatar" aria-hidden="true">${initial}</span>
                <span class="profile-name">${escHtml(name)}</span>
                <i class="bi bi-chevron-down profile-caret" aria-hidden="true"></i>
            </button>
            <div class="profile-panel" id="profilePanel" role="menu" aria-label="Account menu" hidden>
                <div class="profile-panel-head">
                    <span class="profile-avatar profile-avatar-lg" aria-hidden="true">${initial}</span>
                    <div>
                        <div class="profile-panel-name">${escHtml(name)}</div>
                        <div class="profile-panel-sub">Local profile on this device</div>
                    </div>
                </div>
                <div class="profile-panel-section">
                    <div class="profile-panel-label" id="themeGroupLabel">Appearance</div>
                    <div class="theme-options" role="radiogroup" aria-labelledby="themeGroupLabel">${themeButtons}</div>
                </div>
                <div class="profile-panel-section">
                    <a class="profile-item" role="menuitem" href="../app/settings.html"><i class="bi bi-sliders" aria-hidden="true"></i>Settings</a>
                    <a class="profile-item" role="menuitem" href="../app/wallpaper.html"><i class="bi bi-image" aria-hidden="true"></i>Wallpaper</a>
                    <a class="profile-item" role="menuitem" href="../admin/verification.html"><i class="bi bi-shield-check" aria-hidden="true"></i>Account verification</a>
                </div>
                <div class="profile-panel-section">
                    <a class="profile-item" role="menuitem" href="../auth/login.html"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i>Go to sign in</a>
                </div>
            </div>
        </div>`;
    main.insertBefore(bar, main.firstChild);
    initProfileMenu(bar);
}
function initProfileMenu(bar) {
    const trigger = bar.querySelector('#profileTrigger');
    const panel = bar.querySelector('#profilePanel');
    const wrapper = bar.querySelector('#profileMenu');
    function setOpen(isOpen) {
        panel.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', String(isOpen));
    }
    trigger.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('click', event => {
        if (!panel.hidden && !wrapper.contains(event.target))
            setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            setOpen(false);
            trigger.focus();
        }
    });
    bar.querySelectorAll('.theme-option').forEach(button => {
        button.addEventListener('click', () => {
            setTheme(button.dataset.themeValue);
            bar.querySelectorAll('.theme-option').forEach(other => {
                other.setAttribute('aria-checked', String(other === button));
            });
        });
    });
}
function renderShell(activeKey) {
    renderShellBar(activeKey);
    // sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        const sidebarGroups = [
            { label: null, keys: ['dashboard'] },
            { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'syllabus', 'notes'] },
            { label: 'University', keys: ['university', 'curriculum'] },
            { label: 'App', keys: ['wallpaper', 'settings'] },
        ];
        const itemMap = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n]));
        let sidebarHtml = `<div class="brand" role="banner"><span class="dot"><i class="bi bi-mortarboard" aria-hidden="true"></i></span> QCU Planner</div><nav class="d-flex flex-column gap-0 flex-grow-1" aria-label="Main navigation">`;
        sidebarGroups.forEach(g => {
            if (g.label)
                sidebarHtml += `<div class="nav-group-label" role="heading" aria-level="2">${g.label}</div>`;
            g.keys.forEach(k => {
                const n = itemMap[k];
                if (!n)
                    return;
                const isActive = n.key === activeKey;
                sidebarHtml += `<a class="nav-link ${isActive ? 'active' : ''}" href="../app/${n.href}" ${isActive ? 'aria-current="page"' : ''}><i class="bi ${n.icon}" aria-hidden="true"></i>${n.label}</a>`;
            });
        });
        const _sem = DB.getActiveSemester();
        const _semLabel = _sem ? `${_sem.schoolYear} &bull; ${_sem.name}` : '';
        sidebarHtml += `</nav><div class="sidebar-sep">
      <a class="nav-link" href="#" onclick="openQuickAdd('task');return false;"><i class="bi bi-plus-circle" aria-hidden="true"></i>Add Task</a>
      <a class="nav-link" href="#" onclick="Toast.confirmExport();return false;"><i class="bi bi-download" aria-hidden="true"></i>Export</a>
    </div>${_semLabel ? `<div class="sem-banner-nav"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${_semLabel}</div>` : ''}`;
        sidebar.innerHTML = sidebarHtml;
    }
    ensureNavDrawer(activeKey);
    document.querySelectorAll('[data-drawer-open]').forEach(el => el.addEventListener('click', openNavDrawer));
}
/* ---------- MOBILE NAVIGATION DRAWER ---------- */
const DRAWER_GROUPS = [
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'syllabus', 'notes'] },
    { label: 'University', keys: ['university', 'curriculum'] },
    { label: 'App', keys: ['wallpaper', 'settings'] }
];
function ensureNavDrawer(activeKey) {
    const existing = document.getElementById('navDrawer');
    if (existing)
        existing.remove();
    const itemMap = Object.fromEntries(NAV_ITEMS.map(item => [item.key, item]));
    const groupsHtml = DRAWER_GROUPS.map(group => `
        <div class="drawer-group">
            <div class="drawer-group-label">${group.label}</div>
            ${group.keys.map(key => {
        const item = itemMap[key];
        const isActive = key === activeKey;
        return `<a class="drawer-link${isActive ? ' active' : ''}" href="../app/${item.href}"${isActive ? ' aria-current="page"' : ''}>
                    <i class="bi ${item.icon}" aria-hidden="true"></i>
                    <span>${item.label}</span>
                </a>`;
    }).join('')}
        </div>`).join('');
    const drawer = document.createElement('div');
    drawer.id = 'navDrawer';
    drawer.className = 'nav-drawer';
    drawer.hidden = true;
    drawer.innerHTML = `
        <div class="nav-drawer-backdrop" data-drawer-close></div>
        <aside class="nav-drawer-panel" role="dialog" aria-modal="true" aria-label="Site navigation">
            <div class="nav-drawer-head">
                <span class="shell-brand-inline">
                    <span class="dot"><i class="bi bi-mortarboard" aria-hidden="true"></i></span>
                    <span>QCU Planner</span>
                </span>
                <button type="button" class="drawer-close" data-drawer-close aria-label="Close navigation">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>
            <nav class="nav-drawer-body" aria-label="All pages">${groupsHtml}</nav>
        </aside>`;
    document.body.appendChild(drawer);
    drawer.querySelectorAll('[data-drawer-close]').forEach(el => {
        el.addEventListener('click', closeNavDrawer);
    });
}
let drawerReturnFocus = null;
function openNavDrawer() {
    const drawer = document.getElementById('navDrawer');
    if (!drawer)
        return;
    drawerReturnFocus = document.activeElement;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    document.body.classList.add('drawer-open');
    document.querySelectorAll('[data-drawer-open]').forEach(el => el.setAttribute('aria-expanded', 'true'));
    const firstLink = drawer.querySelector('.drawer-link.active, .drawer-link');
    if (firstLink)
        firstLink.focus();
}
function closeNavDrawer() {
    const drawer = document.getElementById('navDrawer');
    if (!drawer || drawer.hidden)
        return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    document.querySelectorAll('[data-drawer-open]').forEach(el => el.setAttribute('aria-expanded', 'false'));
    setTimeout(() => { drawer.hidden = true; }, 220);
    if (drawerReturnFocus)
        drawerReturnFocus.focus();
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape')
        closeNavDrawer();
});
window.matchMedia('(min-width: 992px)').addEventListener('change', event => {
    if (event.matches)
        closeNavDrawer();
});
function greetingText() {
    const h = new Date().getHours();
    if (h < 5)
        return 'Burning the midnight oil';
    if (h < 12)
        return 'Good morning';
    if (h < 17)
        return 'Good afternoon';
    if (h < 21)
        return 'Good evening';
    return 'Working late';
}
function startClock(clockEl, dateEl, greetEl) {
    function tick() {
        const now = new Date();
        if (clockEl)
            clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (dateEl)
            dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (greetEl) {
            const s = DB.getSettings();
            const name = s.name ? s.name.split(' ')[0] : 'there';
            greetEl.textContent = `${greetingText()}, ${name}`;
        }
    }
    tick();
    setInterval(tick, 1000);
}
function openQuickAdd(type) {
    if (window.quickAddHandlers && window.quickAddHandlers[type])
        window.quickAddHandlers[type]();
    else
        window.location.href = type === 'task' ? '../app/tasks.html?new=1' : '../app/dashboard.html';
}

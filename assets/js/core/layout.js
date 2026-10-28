/* ============================================================
   NAV
   ============================================================ */
const NAV_ITEMS = [
    { href: 'dashboard.html', icon: 'bi-grid-1x2-fill', label: 'Dashboard', key: 'dashboard', base: 'app' },
    { href: 'schedule.html', icon: 'bi-calendar2-week-fill', label: 'Schedule', key: 'schedule', base: 'app' },
    { href: 'tasks.html', icon: 'bi-check2-square', label: 'Tasks', key: 'tasks', base: 'app' },
    { href: 'calendar.html', icon: 'bi-calendar3', label: 'Calendar', key: 'calendar', base: 'app' },
    { href: 'grades.html', icon: 'bi-mortarboard-fill', label: 'Grades', key: 'grades', base: 'app' },
    { href: 'attendance.html', icon: 'bi-person-check-fill', label: 'Attendance', key: 'attendance', base: 'app' },
    { href: 'syllabus.html', icon: 'bi-journal-bookmark-fill', label: 'Syllabus', key: 'syllabus', base: 'app' },
    { href: 'notes.html', icon: 'bi-journal-text', label: 'Notes', key: 'notes', base: 'app' },
    { href: 'university.html', icon: 'bi-building-fill', label: 'University', key: 'university', base: 'app' },
    { href: 'curriculum.html', icon: 'bi-book-half', label: 'Curriculum', key: 'curriculum', base: 'app' },
    { href: 'wallpaper.html', icon: 'bi-phone-fill', label: 'Wallpaper', key: 'wallpaper', base: 'app' },
    { href: 'settings.html', icon: 'bi-gear-fill', label: 'Settings', key: 'settings', base: 'app' },
    { href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Admin dashboard', key: 'admin-dashboard', base: 'admin' },
    { href: 'verification.html', icon: 'bi-person-check', label: 'Account verification', key: 'admin-verification', base: 'admin' },
    { href: 'users.html', icon: 'bi-people-fill', label: 'User management', key: 'admin-users', base: 'admin' },
    { href: 'activity-log.html', icon: 'bi-clock-history', label: 'Activity logs', key: 'admin-activity', base: 'admin' },
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
    'admin-dashboard': 'Administration',
    'admin-verification': 'Administration',
    'admin-users': 'Administration',
    'admin-activity': 'Administration',
};
/* ---------- Sign out ---------- */
/* Classic (non-module) scripts resolve a dynamic import() specifier against the document's URL,
   not the importing script's URL. Every page that loads layout.js lives two levels under /pages/
   (pages/app/*.html or pages/admin/*.html), so this relative path resolves correctly from both. */
async function signOutAndRedirect(button) {
    if (button) button.disabled = true;
    try {
        const { AuthService } = await import('../../assets/js/services/auth-service.js');
        await AuthService.signOut();
    } catch (error) {
        /* Even if sign-out fails client-side, still send the user back to the login page. */
    }
    location.href = '../auth/login.html';
}
window.signOutAndRedirect = signOutAndRedirect;

/* ---------- Theme switcher (topbar) ---------- */
function renderThemeSwitchHtml() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    return THEME_OPTIONS.map(option => `
        <button type="button" class="theme-switch-btn" data-theme-value="${option.value}"
            role="radio" aria-checked="${option.value === currentTheme}" aria-label="${option.label} theme" title="${option.label}">
            <i class="bi ${option.icon}" aria-hidden="true"></i>
        </button>`).join('');
}
function syncThemeSwitches() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('[data-theme-switch] .theme-switch-btn').forEach(btn => {
        btn.setAttribute('aria-checked', String(btn.dataset.themeValue === currentTheme));
    });
}
function initThemeSwitches() {
    document.querySelectorAll('[data-theme-switch]').forEach(el => {
        if (!el.childElementCount) el.innerHTML = renderThemeSwitchHtml();
    });
    document.querySelectorAll('[data-theme-switch] .theme-switch-btn').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.themeValue);
            syncThemeSwitches();
            syncThemeOptions();
        });
    });
}

/* ---------- Theme switcher (labeled, 3-across — used in the student profile panel) ---------- */
function renderThemeOptionsHtml() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    return THEME_OPTIONS.map(option => `
        <button type="button" class="theme-option" data-theme-value="${option.value}"
            role="radio" aria-checked="${option.value === currentTheme}">
            <i class="bi ${option.icon}" aria-hidden="true"></i>
            <span>${option.label}</span>
        </button>`).join('');
}
function syncThemeOptions() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('[data-theme-options] .theme-option').forEach(btn => {
        btn.setAttribute('aria-checked', String(btn.dataset.themeValue === currentTheme));
    });
}
function initThemeOptions() {
    document.querySelectorAll('[data-theme-options]').forEach(el => {
        if (!el.childElementCount) el.innerHTML = renderThemeOptionsHtml();
    });
    document.querySelectorAll('[data-theme-options] .theme-option').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.themeValue);
            syncThemeOptions();
            syncThemeSwitches();
        });
    });
}

/* ---------- Sidebar toggle (topbar) ---------- */
/* On desktop the sidebar is a static column, so "toggling" it collapses/reveals that column.
   Below the desktop breakpoint there is no static sidebar, so it opens the same mobile drawer
   the old hamburger button used. */
function toggleSidebar() {
    if (window.matchMedia('(min-width: 992px)').matches) {
        document.body.classList.toggle('sidebar-collapsed');
    } else {
        openNavDrawer();
    }
}
function wireSidebarToggles() {
    document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', toggleSidebar);
    });
}

function renderShellBar(activeKey) {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('shellBar'))
        return;
    const settings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
    const name = (settings.name || '').trim() || 'Student';
    const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
    const bar = document.createElement('header');
    bar.id = 'shellBar';
    bar.className = 'shell-bar';
    bar.innerHTML = `
        <a class="shell-brand" href="../app/dashboard.html" aria-label="QCU Planner dashboard">
            <span class="dot"><i class="bi bi-mortarboard" aria-hidden="true"></i></span>
            <span>QCU Planner</span>
        </a>
        <div class="shell-bar-right">
            <div class="profile-menu" id="profileMenu">
                <button type="button" class="profile-trigger profile-trigger-circle" id="profileTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="profilePanel" aria-label="Account menu">
                    <span class="profile-avatar" aria-hidden="true">${initial}</span>
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
                        <div class="profile-panel-label">Theme</div>
                        <div class="theme-options" role="radiogroup" aria-label="Theme" data-theme-options></div>
                    </div>
                    <div class="profile-panel-section">
                        <a class="profile-item" role="menuitem" href="../app/settings.html"><i class="bi bi-sliders" aria-hidden="true"></i>Settings</a>
                        <a class="profile-item" role="menuitem" href="../app/wallpaper.html"><i class="bi bi-image" aria-hidden="true"></i>Wallpaper</a>
                    </div>
                </div>
            </div>
            <button type="button" class="shell-menu-btn" data-sidebar-toggle aria-label="Toggle sidebar">
                <i class="bi bi-list" aria-hidden="true"></i>
            </button>
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
}
function renderShell(activeKey) {
    const isAdminArea = String(activeKey).startsWith('admin-');
    /* Admin pages use only the sidebar for navigation — no top profile/brand
       bar, and no link back into the student app. The sidebar brand itself
       is plain text (not a link) so there's nothing to click into student
       pages from here. */
    if (!isAdminArea) renderShellBar(activeKey);
    // sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        const sidebarGroups = isAdminArea
            ? [{ label: 'Administration', keys: ['admin-dashboard', 'admin-verification', 'admin-users', 'admin-activity'] }]
            : [
                { label: null, keys: ['dashboard'] },
                { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'syllabus', 'notes'] },
                { label: 'University', keys: ['university', 'curriculum'] },
                { label: 'App', keys: ['wallpaper', 'settings'] },
            ];
        const itemMap = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n]));
        const sidebarSettings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
        const name = (sidebarSettings.name || '').trim() || 'Student';
        const brandLabel = isAdminArea ? 'Planner Admin' : 'QCU Planner';
        const brandIcon = isAdminArea ? 'bi-shield-lock-fill' : 'bi-mortarboard';
        let sidebarHtml = `<div class="brand" role="banner"><span class="dot"><i class="bi ${brandIcon}" aria-hidden="true"></i></span> ${brandLabel}</div><nav class="d-flex flex-column gap-0 flex-grow-1" aria-label="Main navigation">`;
        sidebarGroups.forEach(g => {
            if (g.label)
                sidebarHtml += `<div class="nav-group-label" role="heading" aria-level="2">${g.label}</div>`;
            g.keys.forEach(k => {
                const n = itemMap[k];
                if (!n)
                    return;
                const isActive = n.key === activeKey;
                sidebarHtml += `<a class="nav-link ${isActive ? 'active' : ''}" href="../${n.base}/${n.href}" ${isActive ? 'aria-current="page"' : ''}><i class="bi ${n.icon}" aria-hidden="true"></i>${n.label}</a>`;
            });
        });

        if (isAdminArea) {
            sidebarHtml += `</nav><div class="sidebar-sep sidebar-logout-sep">
      <div class="sidebar-user" id="admSidebarName">Administrator</div>
      <button type="button" class="nav-link sidebar-logout-btn" id="admSidebarLogoutBtn"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
    </div>`;
        } else {
            const _sem = DB.getActiveSemester();
            const _semLabel = _sem ? `${_sem.schoolYear} &bull; ${_sem.name}` : '';
            sidebarHtml += `</nav><div class="sidebar-sep">
      <a class="nav-link" href="#" onclick="openQuickAdd('task');return false;"><i class="bi bi-plus-circle" aria-hidden="true"></i>Add Task</a>
      <a class="nav-link" href="#" onclick="Toast.confirmExport();return false;"><i class="bi bi-download" aria-hidden="true"></i>Export</a>
    </div>${_semLabel ? `<div class="sem-banner-nav"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${_semLabel}</div>` : ''}
    <div class="sidebar-sep sidebar-logout-sep">
      <div class="sidebar-user" id="sidebarUserName">Signed in as ${escHtml(name)}</div>
      <button type="button" class="nav-link sidebar-logout-btn" id="sidebarLogoutBtn" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
    </div>`;
        }
        sidebar.innerHTML = sidebarHtml;
    }
    ensureNavDrawer(activeKey);
    document.querySelectorAll('[data-drawer-open]').forEach(el => el.addEventListener('click', openNavDrawer));
    initThemeSwitches();
    initThemeOptions();
    wireSidebarToggles();
}
/* ---------- MOBILE NAVIGATION DRAWER ---------- */
const DRAWER_GROUPS = [
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'syllabus', 'notes'] },
    { label: 'University', keys: ['university', 'curriculum'] },
    { label: 'App', keys: ['wallpaper', 'settings'] }
];
const ADMIN_DRAWER_GROUPS = [
    { label: 'Administration', keys: ['admin-dashboard', 'admin-verification', 'admin-users', 'admin-activity'] },
];
function ensureNavDrawer(activeKey) {
    const existing = document.getElementById('navDrawer');
    if (existing)
        existing.remove();
    const isAdminArea = String(activeKey).startsWith('admin-');
    const groups = isAdminArea ? ADMIN_DRAWER_GROUPS : DRAWER_GROUPS;
    const itemMap = Object.fromEntries(NAV_ITEMS.map(item => [item.key, item]));
    const groupsHtml = groups.map(group => `
        <div class="drawer-group">
            <div class="drawer-group-label">${group.label}</div>
            ${group.keys.map(key => {
        const item = itemMap[key];
        const isActive = key === activeKey;
        return `<a class="drawer-link${isActive ? ' active' : ''}" href="../${item.base}/${item.href}"${isActive ? ' aria-current="page"' : ''}>
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

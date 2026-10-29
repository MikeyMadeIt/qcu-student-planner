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
    { href: 'help.html', icon: 'bi-question-circle', label: 'Help', key: 'help', base: 'app' },
    { href: 'report.html', icon: 'bi-flag', label: 'Report', key: 'report', base: 'app' },
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
/* ---------- Dynamic page titles (shown in the mobile/desktop header) ---------- */
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n.label]));

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
    settings: 'Utilities',
    help: 'Utilities',
    report: 'Utilities',
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

/* ---------- Sidebar toggle (header) ---------- */
/* The desktop sidebar is a permanent static column and cannot be collapsed or hidden — this
   toggle only ever opens/closes the mobile nav drawer. The icon reflects the drawer's state. */
function toggleSidebar() {
    const drawer = document.getElementById('navDrawer');
    if (drawer && drawer.classList.contains('is-open'))
        closeNavDrawer();
    else
        openNavDrawer();
}
function syncSidebarToggleIcon(isOpen) {
    document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        const icon = btn.querySelector('i');
        if (icon)
            icon.className = isOpen ? 'bi bi-x-lg' : 'bi bi-layout-sidebar';
    });
}
function wireSidebarToggles() {
    document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', toggleSidebar);
    });
    /* Normalizes the icon on load — some pages (e.g. the admin topbar) still markup their
       toggle button with the old hamburger glyph in HTML; this makes every toggle consistent
       without having to hand-edit each page. */
    syncSidebarToggleIcon(false);
}

/* ---------- Notifications (derived from real task data — never fabricated) ---------- */
/* Surfaces tasks that are due soon or overdue, the same "assignmentDue" reminders the
   Settings page already lets the user toggle off. There is no separate notifications
   store: this list is recomputed from the user's actual tasks every time it is opened. */
function getTaskNotifications() {
    if (typeof DB === 'undefined') return [];
    const settings = DB.getSettings();
    if (settings.notifications && settings.notifications.assignmentDue === false) return [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const horizon = new Date(todayStart.getTime() + 1000 * 60 * 60 * 24 * 3);
    let tasks = [];
    try { tasks = DB.getActiveTasks(); } catch (e) { tasks = []; }
    return tasks
        .filter(t => t && t.status !== 'completed' && t.dueDate)
        .map(t => ({ task: t, due: new Date(t.dueDate + 'T' + (t.dueTime || '23:59')) }))
        .filter(x => !isNaN(x.due) && x.due <= horizon)
        .sort((a, b) => a.due - b.due)
        .map(x => ({
            id: x.task.id,
            title: x.task.title || 'Untitled task',
            overdue: x.due < new Date(),
            due: x.due,
        }));
}
function renderNotifPanelBody() {
    const items = getTaskNotifications();
    if (!items.length)
        return `<div class="header-panel-empty"><i class="bi bi-check2-circle" aria-hidden="true"></i>Nothing due soon</div>`;
    return items.slice(0, 8).map(n => `
        <a class="header-panel-item" href="../app/tasks.html">
            <span class="header-panel-dot ${n.overdue ? 'is-overdue' : ''}" aria-hidden="true"></span>
            <span class="header-panel-item-text">
                <span class="header-panel-item-title">${escHtml(n.title)}</span>
                <span class="header-panel-item-sub">${n.overdue ? 'Overdue' : 'Due ' + n.due.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </span>
        </a>`).join('');
}

/* ---------- Inbox ----------
   The project has no backend for system messages/announcements — there is no table or API
   to read them from, so this always renders a genuine empty state rather than invented
   messages. The interface is fully wired (icon, panel, sidebar row); only the data source
   is missing. See the delivery summary for what a real implementation would need. */
function renderInboxPanelBody() {
    return `<div class="header-panel-empty"><i class="bi bi-inbox" aria-hidden="true"></i>No messages yet<span>Announcements from QCU Planner admins will appear here.</span></div>`;
}

function renderShellBar(activeKey) {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('shellBar'))
        return;
    const settings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
    const name = (settings.name || '').trim() || 'Student';
    const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
    const pageTitle = PAGE_TITLES[activeKey] || 'Dashboard';
    const bar = document.createElement('header');
    bar.id = 'shellBar';
    bar.className = 'shell-bar';
    bar.innerHTML = `
        <div class="shell-bar-left">
            <button type="button" class="shell-menu-btn" data-sidebar-toggle aria-haspopup="true"
                aria-expanded="false" aria-controls="navDrawer" aria-label="Open navigation">
                <i class="bi bi-layout-sidebar" aria-hidden="true"></i>
            </button>
            <h1 class="shell-page-title" id="shellPageTitle" title="${escHtml(pageTitle)}">${escHtml(pageTitle)}</h1>
        </div>
        <div class="shell-bar-right">
            <div class="header-panel-wrap" id="notifMenu">
                <button type="button" class="shell-icon-btn" id="notifTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="notifPanel" aria-label="Notifications">
                    <i class="bi bi-bell" aria-hidden="true"></i>
                </button>
                <div class="header-panel" id="notifPanel" role="menu" aria-label="Notifications" hidden>
                    <div class="header-panel-title">Notifications</div>
                    <div class="header-panel-body">${renderNotifPanelBody()}</div>
                </div>
            </div>
            <div class="header-panel-wrap" id="inboxMenu">
                <button type="button" class="shell-icon-btn" id="inboxTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="inboxPanel" aria-label="Inbox">
                    <i class="bi bi-inbox" aria-hidden="true"></i>
                </button>
                <div class="header-panel" id="inboxPanel" role="menu" aria-label="Inbox" hidden>
                    <div class="header-panel-title">Inbox</div>
                    <div class="header-panel-body">${renderInboxPanelBody()}</div>
                </div>
            </div>
            <div class="profile-menu" id="profileMenu">
                <button type="button" class="profile-trigger profile-trigger-circle" id="profileTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="profilePanel" aria-label="Account menu">
                    <span class="profile-avatar" aria-hidden="true">${initial}</span>
                </button>
                <div class="profile-panel" id="profilePanel" role="menu" aria-label="Account menu" hidden>
                    <div class="profile-panel-head">
                        <span class="profile-avatar profile-avatar-lg" aria-hidden="true" id="topbarProfileAvatar">${initial}</span>
                        <div>
                            <div class="profile-panel-name" id="topbarProfileName">${escHtml(name)}</div>
                            <div class="profile-panel-sub" id="topbarUserEmail">Signed in on this device</div>
                        </div>
                    </div>
                    <div class="profile-panel-section">
                        <div class="profile-panel-label">Theme</div>
                        <div class="theme-options" role="radiogroup" aria-label="Theme" data-theme-options></div>
                    </div>
                    <div class="profile-panel-section">
                        <a class="profile-item" role="menuitem" href="../app/settings.html"><i class="bi bi-sliders" aria-hidden="true"></i>Settings</a>
                        <a class="profile-item" role="menuitem" href="../app/wallpaper.html"><i class="bi bi-image" aria-hidden="true"></i>Wallpaper</a>
                        <a class="profile-item" role="menuitem" href="../app/help.html"><i class="bi bi-question-circle" aria-hidden="true"></i>Help</a>
                        <a class="profile-item" role="menuitem" href="../app/report.html"><i class="bi bi-flag" aria-hidden="true"></i>Report</a>
                    </div>
                </div>
            </div>
        </div>`;
    main.insertBefore(bar, main.firstChild);
    initHeaderPanel(bar, 'profileTrigger', 'profilePanel', 'profileMenu');
    initHeaderPanel(bar, 'notifTrigger', 'notifPanel', 'notifMenu');
    initHeaderPanel(bar, 'inboxTrigger', 'inboxPanel', 'inboxMenu');
}
/* Generic open/close wiring shared by the profile, notifications and inbox popovers:
   click-outside closes, Escape closes, and only one popover is open at a time. */
function initHeaderPanel(bar, triggerId, panelId, wrapId) {
    const trigger = bar.querySelector('#' + triggerId);
    const panel = bar.querySelector('#' + panelId);
    const wrapper = bar.querySelector('#' + wrapId);
    if (!trigger || !panel || !wrapper) return;
    function closeOthers() {
        document.querySelectorAll('.header-panel, .profile-panel').forEach(p => {
            if (p.id !== panelId && !p.hidden) {
                p.hidden = true;
                const t = document.querySelector('[aria-controls="' + p.id + '"]');
                if (t) t.setAttribute('aria-expanded', 'false');
            }
        });
    }
    function setOpen(isOpen) {
        if (isOpen) closeOthers();
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

/* The sidebar's Inbox/Notifications rows reuse the exact same popovers as the header icons
   (no second inbox/notifications implementation) — they simply delegate the click. */
function wireSidebarQuickLinks(sidebar) {
    const inboxBtn = sidebar.querySelector('#sidebarInboxBtn');
    const notifBtn = sidebar.querySelector('#sidebarNotifBtn');
    if (inboxBtn) inboxBtn.addEventListener('click', () => document.getElementById('inboxTrigger') && document.getElementById('inboxTrigger').click());
    if (notifBtn) notifBtn.addEventListener('click', () => document.getElementById('notifTrigger') && document.getElementById('notifTrigger').click());
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
                { label: 'Overview', keys: ['dashboard'] },
                { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'notes', 'syllabus'] },
                { label: 'University', keys: ['university', 'curriculum'] },
                { label: 'App', keys: ['wallpaper'] },
            ];
        const itemMap = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n]));
        const sidebarSettings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
        const name = (sidebarSettings.name || '').trim() || 'Student';
        const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
        const brandLabel = isAdminArea ? 'Planner Admin' : 'QCU Planner';
        const brandIcon = isAdminArea ? 'bi-shield-lock-fill' : 'bi-mortarboard';
        let sidebarHtml = `<div class="brand" role="banner"><span class="dot"><i class="bi ${brandIcon}" aria-hidden="true"></i></span> ${brandLabel}</div>`;
        if (!isAdminArea) {
            sidebarHtml += `<div class="sidebar-quick-row" role="group" aria-label="Inbox and notifications">
      <button type="button" class="nav-link sidebar-quick-link" id="sidebarInboxBtn" aria-haspopup="true" aria-expanded="false" aria-controls="inboxPanel"><i class="bi bi-inbox" aria-hidden="true"></i>Inbox</button>
      <button type="button" class="nav-link sidebar-quick-link" id="sidebarNotifBtn" aria-haspopup="true" aria-expanded="false" aria-controls="notifPanel"><i class="bi bi-bell" aria-hidden="true"></i>Notifications</button>
    </div>`;
        }
        sidebarHtml += `<nav class="d-flex flex-column gap-0 flex-grow-1" aria-label="Main navigation">`;
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
        sidebarHtml += `</nav><div class="sidebar-bottom">`;

        if (isAdminArea) {
            sidebarHtml += `<div class="sidebar-utility">
      <button type="button" class="nav-link sidebar-logout-btn js-admin-logout" id="admSidebarLogoutBtn"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
    </div>
    <div class="sidebar-user js-admin-name" id="admSidebarName">Administrator</div>`;
        } else {
            /* "Add Task" and "Export" used to live here as sidebar-only shortcuts. Both actions
               already have a real home on their own pages (the Tasks page toolbar's "Add Task"
               button, and Settings' "Export All Data" button) — removing the sidebar-only copy
               does not remove any functionality, it just stops duplicating nav real estate on
               desktop. See tasks.html and settings.html. */
            const _sem = DB.getActiveSemester();
            const _semLabel = _sem ? `${_sem.schoolYear} &bull; ${_sem.name}` : '';
            sidebarHtml += `${_semLabel ? `<div class="sem-banner-nav"><i class="bi bi-calendar3 me-1" aria-hidden="true"></i>${_semLabel}</div>` : ''}
    <div class="sidebar-utility">
      <a class="nav-link" href="../app/settings.html"><i class="bi bi-gear-fill" aria-hidden="true"></i>Settings</a>
      <a class="nav-link" href="../app/help.html"><i class="bi bi-question-circle" aria-hidden="true"></i>Help</a>
      <a class="nav-link" href="../app/report.html"><i class="bi bi-flag" aria-hidden="true"></i>Report</a>
      <button type="button" class="nav-link sidebar-logout-btn" id="sidebarLogoutBtn" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
    </div>
    <div class="sidebar-profile" id="sidebarProfile">
      <span class="profile-avatar" aria-hidden="true" id="sidebarProfileAvatar">${initial}</span>
      <div class="sidebar-profile-text">
        <div class="sidebar-profile-name" id="sidebarProfileName">${escHtml(name)}</div>
        <div class="sidebar-profile-sub" id="sidebarUserName">Signed in on this device</div>
      </div>
    </div>`;
        }
        sidebarHtml += `</div>`;
        sidebar.innerHTML = sidebarHtml;
        if (!isAdminArea) wireSidebarQuickLinks(sidebar);
    }
    ensureNavDrawer(activeKey);
    initThemeSwitches();
    initThemeOptions();
    wireSidebarToggles();
    if (!isAdminArea) hydrateProfileIdentity();
}

/* ---------- Real authenticated identity (profile sections, bottom of both sidebars) ----------
   The local "name" field in Settings is a user-editable device-local label (shown instantly,
   before this resolves, so the sidebar never looks empty). The user's actual authenticated
   email can only come from the live Supabase session, and the most reliable real name comes
   from the `profiles` row created at sign-up — both are fetched here, once, straight from the
   same AuthService/Supabase client every other page already uses. Never fabricated: if the
   session/profile call fails (e.g. offline, or this is a static preview with no backend), the
   device-local fallback already in the DOM is simply left in place. */
async function hydrateProfileIdentity() {
    try {
        const [{ AuthService }, { getSupabase }] = await Promise.all([
            import('../../assets/js/services/auth-service.js'),
            import('../../assets/js/core/supabase-client.js'),
        ]);
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData && sessionData.session && sessionData.session.user
            ? sessionData.session.user.email
            : '';
        if (!email) return;

        let fullName = '';
        const profileResult = await AuthService.getCurrentProfile();
        if (profileResult.ok && profileResult.data && profileResult.data.full_name)
            fullName = profileResult.data.full_name;

        document.querySelectorAll('#sidebarUserName, #drawerUserEmail, #topbarUserEmail').forEach(el => {
            el.textContent = email;
            el.title = email;
        });
        if (fullName) {
            const initial = escHtml(fullName.charAt(0).toUpperCase() || 'S');
            document.querySelectorAll('#sidebarProfileName, #drawerProfileName, #topbarProfileName').forEach(el => { el.textContent = fullName; });
            document.querySelectorAll('#sidebarProfileAvatar, #drawerProfileAvatar, #topbarProfileAvatar').forEach(el => { el.textContent = initial; });
        }
    } catch (error) {
        /* No live Supabase session available (offline, static preview, etc.) — keep the
           device-local fallback already rendered. */
    }
}
/* ---------- MOBILE NAVIGATION DRAWER ---------- */
/* Same information hierarchy as the desktop sidebar (branding, then the categorized groups —
   Inbox/Notifications and the bottom utility/profile rows are added separately in
   ensureNavDrawer, same as the desktop sidebar builds them outside sidebarGroups). */
const DRAWER_GROUPS = [
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'notes', 'syllabus'] },
    { label: 'University', keys: ['university', 'curriculum'] },
    { label: 'App', keys: ['wallpaper'] }
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
    const quickRowHtml = isAdminArea ? '' : `
            <div class="drawer-quick-row" role="group" aria-label="Inbox and notifications">
                <button type="button" class="drawer-link drawer-quick-link" id="drawerInboxBtn"><i class="bi bi-inbox" aria-hidden="true"></i><span>Inbox</span></button>
                <button type="button" class="drawer-link drawer-quick-link" id="drawerNotifBtn"><i class="bi bi-bell" aria-hidden="true"></i><span>Notifications</span></button>
            </div>`;
    const sidebarSettingsForDrawer = (!isAdminArea && typeof DB !== 'undefined') ? DB.getSettings() : {};
    const drawerName = (sidebarSettingsForDrawer.name || '').trim() || 'Student';
    const drawerInitial = escHtml(drawerName.charAt(0).toUpperCase() || 'S');
    const bottomHtml = isAdminArea ? `
            <div class="drawer-group drawer-bottom">
                <button type="button" class="drawer-link drawer-link-danger js-admin-logout" id="admDrawerLogoutBtn"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>
            </div>` : `
            <div class="drawer-group drawer-bottom">
                <a class="drawer-link" href="../app/settings.html"><i class="bi bi-gear-fill" aria-hidden="true"></i><span>Settings</span></a>
                <a class="drawer-link" href="../app/help.html"><i class="bi bi-question-circle" aria-hidden="true"></i><span>Help</span></a>
                <a class="drawer-link" href="../app/report.html"><i class="bi bi-flag" aria-hidden="true"></i><span>Report</span></a>
                <button type="button" class="drawer-link drawer-link-danger" id="drawerLogoutBtn" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>
            </div>
            <div class="drawer-profile" id="drawerProfile">
                <span class="profile-avatar" aria-hidden="true" id="drawerProfileAvatar">${drawerInitial}</span>
                <div class="drawer-profile-text">
                    <div class="drawer-profile-name" id="drawerProfileName">${escHtml(drawerName)}</div>
                    <div class="drawer-profile-sub" id="drawerUserEmail">Signed in on this device</div>
                </div>
            </div>`;
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
            <nav class="nav-drawer-body" aria-label="All pages">${quickRowHtml}${groupsHtml}</nav>
            ${bottomHtml}
        </aside>`;
    document.body.appendChild(drawer);
    drawer.querySelectorAll('[data-drawer-close]').forEach(el => {
        el.addEventListener('click', closeNavDrawer);
    });
    /* Close the drawer once a destination is chosen, so it never lingers open behind the
       page that just loaded (and doesn't trap focus if the browser serves a cached page). */
    drawer.querySelectorAll('.drawer-link[href]').forEach(el => {
        el.addEventListener('click', closeNavDrawer);
    });
    const inboxBtn = drawer.querySelector('#drawerInboxBtn');
    const notifBtn = drawer.querySelector('#drawerNotifBtn');
    if (inboxBtn) inboxBtn.addEventListener('click', () => { closeNavDrawer(); setTimeout(() => document.getElementById('inboxTrigger') && document.getElementById('inboxTrigger').click(), 230); });
    if (notifBtn) notifBtn.addEventListener('click', () => { closeNavDrawer(); setTimeout(() => document.getElementById('notifTrigger') && document.getElementById('notifTrigger').click(), 230); });
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
    syncSidebarToggleIcon(true);
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
    syncSidebarToggleIcon(false);
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

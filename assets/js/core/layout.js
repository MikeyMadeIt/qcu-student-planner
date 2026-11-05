/* ============================================================
   NAV
   ============================================================ */
const NAV_ITEMS = [
    /* COMMUNICATION */
    { href: 'inbox.html', icon: 'bi-inbox', label: 'Inbox', key: 'inbox', base: 'app' },
    { href: 'notifications.html', icon: 'bi-bell', label: 'Notifications', key: 'notifications', base: 'app' },
    { href: 'announcements.html', icon: 'bi-megaphone', label: 'Announcements', key: 'announcements', base: 'app', soon: true },
    /* OVERVIEW */
    { href: 'dashboard.html', icon: 'bi-grid-1x2-fill', label: 'Dashboard', key: 'dashboard', base: 'app' },
    /* ACADEMICS */
    { href: 'schedule.html', icon: 'bi-calendar2-week-fill', label: 'Schedule', key: 'schedule', base: 'app' },
    { href: 'tasks.html', icon: 'bi-check2-square', label: 'Tasks', key: 'tasks', base: 'app' },
    { href: 'calendar.html', icon: 'bi-calendar3', label: 'Calendar', key: 'calendar', base: 'app' },
    { href: 'grades.html', icon: 'bi-mortarboard-fill', label: 'Grades', key: 'grades', base: 'app' },
    { href: 'attendance.html', icon: 'bi-person-check-fill', label: 'Attendance', key: 'attendance', base: 'app' },
    { href: 'notes.html', icon: 'bi-journal-text', label: 'Notes', key: 'notes', base: 'app' },
    /* UNIVERSITY */
    { href: 'curriculum.html', icon: 'bi-book-half', label: 'Curriculum', key: 'curriculum', base: 'app' },
    /* AI TOOLS */
    { href: 'ai-quiz-maker.html', icon: 'bi-patch-question-fill', label: 'AI Quiz Maker', key: 'ai-quiz-maker', base: 'app' },
    { href: 'ai-flashcard-maker.html', icon: 'bi-layers-fill', label: 'AI Flashcard Maker', key: 'ai-flashcard-maker', base: 'app' },
    { href: 'ai-study-assistant.html', icon: 'bi-stars', label: 'AI Study Assistant', key: 'ai-study-assistant', base: 'app' },
    { href: 'ai-summarizer.html', icon: 'bi-file-earmark-text-fill', label: 'AI Summarizer', key: 'ai-summarizer', base: 'app', soon: true },
    { href: 'ai-reviewer.html', icon: 'bi-clipboard2-check-fill', label: 'AI Reviewer', key: 'ai-reviewer', base: 'app', soon: true },
    /* PERSONALIZATION */
    { href: 'wallpaper.html', icon: 'bi-phone-fill', label: 'Wallpaper', key: 'wallpaper', base: 'app' },
    /* SAFETY & SUPPORT */
    { href: 'settings.html', icon: 'bi-gear-fill', label: 'Settings', key: 'settings', base: 'app' },
    { href: 'help.html', icon: 'bi-question-circle', label: 'Help Center', key: 'help', base: 'app' },
    { href: 'report.html', icon: 'bi-flag', label: 'Report a Problem', key: 'report', base: 'app' },
    { href: 'legal-policies.html', icon: 'bi-shield-check', label: 'Legal & Policies', key: 'legal-policies', base: 'app', soon: true },
    { href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Overview', key: 'admin-dashboard', base: 'admin' },
    { href: 'users.html', icon: 'bi-people-fill', label: 'All Users', key: 'admin-users', base: 'admin' },
    { href: 'verification.html', icon: 'bi-person-check', label: 'Pending Approvals', key: 'admin-verification', base: 'admin' },
    { href: 'rejected.html', icon: 'bi-person-x', label: 'Rejected Accounts', key: 'admin-rejected', base: 'admin' },
    { href: 'inbox.html', icon: 'bi-inbox', label: 'Inbox', key: 'admin-inbox', base: 'admin' },
    { href: 'tickets.html', icon: 'bi-life-preserver', label: 'Support Tickets', key: 'admin-tickets', base: 'admin' },
    { href: 'email.html', icon: 'bi-envelope', label: 'Email Center', key: 'admin-email', base: 'admin', soon: true },
    { href: 'announcements.html', icon: 'bi-megaphone', label: 'Announcements', key: 'admin-announcements', base: 'admin', soon: true },
    { href: 'reports.html', icon: 'bi-bar-chart-line', label: 'Reports & Analytics', key: 'admin-reports', base: 'admin', soon: true },
    { href: 'activity-log.html', icon: 'bi-clock-history', label: 'Audit Logs', key: 'admin-activity', base: 'admin' },
    { href: 'settings.html', icon: 'bi-gear-fill', label: 'Settings', key: 'admin-settings', base: 'admin', soon: true },
];
const THEME_OPTIONS = [
    { value: 'dark', label: 'Dark', icon: 'bi-moon-stars' },
    { value: 'light', label: 'Light', icon: 'bi-sun' },
    { value: 'amoled', label: 'AMOLED', icon: 'bi-circle-fill' }
];
/* ---------- Dynamic page titles (shown in the mobile/desktop header) ---------- */
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n.label]));

const PAGE_SECTIONS = {
    inbox: 'Communication',
    notifications: 'Communication',
    announcements: 'Communication',
    dashboard: 'Overview',
    schedule: 'Academics',
    tasks: 'Academics',
    calendar: 'Academics',
    grades: 'Academics',
    attendance: 'Academics',
    notes: 'Academics',
    curriculum: 'Academics',
    'ai-quiz-maker': 'AI Tools',
    'ai-flashcard-maker': 'AI Tools',
    'ai-study-assistant': 'AI Tools',
    'ai-summarizer': 'AI Tools',
    'ai-reviewer': 'AI Tools',
    wallpaper: 'Personalization',
    settings: 'Safety & Support',
    help: 'Safety & Support',
    report: 'Safety & Support',
    'legal-policies': 'Safety & Support',
    'admin-dashboard': 'Overview',
    'admin-users': 'User Management',
    'admin-verification': 'User Management',
    'admin-rejected': 'User Management',
    'admin-inbox': 'Communications',
    'admin-tickets': 'Communications',
    'admin-email': 'Communications',
    'admin-announcements': 'Communications',
    'admin-reports': 'System',
    'admin-activity': 'System',
    'admin-settings': 'System',
};
/* ---------- Sign out ---------- */
/* Dynamic import specifiers in this classic script resolve relative to layout.js itself. */
async function signOutAndRedirect(button) {
    if (button) button.disabled = true;
    try {
        const { AuthService } = await import('../services/auth-service.js');
        await AuthService.signOut();
    } catch (error) {
        /* Even if sign-out fails client-side, still send the user back to the login page. */
    }
    location.href = '../auth/login.html';
}
window.signOutAndRedirect = signOutAndRedirect;

/* ---------- Current-semester card (header avatar popup) ----------
   Reuses the same active-semester data source and "Active" concept as Settings'
   semester manager (DB.getActiveSemester / DB.getActiveSemesterId) — this is a
   manually-configured flag, not a dynamically verified status, same as on Settings. */
function formatSemesterCardDate(ymd) {
    if (!ymd) return '';
    const d = new Date(ymd + 'T00:00:00');
    if (isNaN(d)) return ymd;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function renderShellSemesterCardHtml() {
    const sem = (typeof DB !== 'undefined') ? DB.getActiveSemester() : null;
    if (!sem) return '';
    const range = `${formatSemesterCardDate(sem.startDate)} &ndash; ${formatSemesterCardDate(sem.endDate)}`;
    return `
        <div class="shell-semester-card" id="shellSemesterCard">
            <div class="shell-semester-info">
                <div class="shell-semester-name">${escHtml(sem.name)}</div>
                <div class="shell-semester-dates">${range}</div>
            </div>
            <span class="shell-semester-status"><i class="bi bi-check-lg" aria-hidden="true"></i>Active</span>
        </div>`;
}

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
            icon.className = isOpen ? 'bi bi-layout-sidebar-reverse' : 'bi bi-layout-sidebar';
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
const NOTIFICATION_READ_KEY = 'sp_notification_read';

function getTaskNotifications() {
    if (typeof DB === 'undefined') return [];
    const settings = DB.getSettings();
    if (settings.notifications && settings.notifications.assignmentDue === false) return [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const horizon = new Date(todayStart.getTime() + 1000 * 60 * 60 * 24 * 3);
    return DB.getActiveTasks()
        .filter(t => t && t.status !== 'completed' && t.dueDate)
        .map(t => ({ task: t, due: new Date(t.dueDate + 'T' + (t.dueTime || '23:59')) }))
        .filter(x => !isNaN(x.due) && x.due <= horizon)
        .sort((a, b) => a.due - b.due)
        .map(x => ({
            id: `task-${x.task.id}-${x.task.dueDate}-${x.task.dueTime || ''}`,
            taskId: x.task.id,
            title: x.task.title || 'Untitled task',
            overdue: x.due < new Date(),
            due: x.due,
            category: 'Task reminder',
            description: x.task.description || '',
        }));
}

function getNotificationReadMap() {
    const raw = localStorage.getItem(NOTIFICATION_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('Saved notification read states are invalid.');
    return parsed;
}

function getUnreadNotificationCount() {
    const readMap = getNotificationReadMap();
    return getTaskNotifications().filter(item => !readMap[item.id]).length;
}

function setNotificationRead(id, isRead = true) {
    const readMap = getNotificationReadMap();
    if (isRead) readMap[id] = true;
    else delete readMap[id];
    localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(readMap));
    updateNotificationBadge();
    window.dispatchEvent(new CustomEvent('planner:notifications-changed'));
}

function markAllNotificationsRead() {
    const readMap = getNotificationReadMap();
    getTaskNotifications().forEach(item => { readMap[item.id] = true; });
    localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(readMap));
    updateNotificationBadge();
    window.dispatchEvent(new CustomEvent('planner:notifications-changed'));
}

function updateNotificationBadge() {
    const trigger = document.getElementById('notifTrigger');
    const badge = document.getElementById('notificationUnreadCount');
    if (!trigger || !badge) return;
    try {
        const count = getUnreadNotificationCount();
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
        trigger.setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');
    } catch (error) {
        console.error('Unable to load notification read states.', error);
        badge.hidden = true;
        trigger.setAttribute('aria-label', 'Notifications, status unavailable');
    }
}

function renderNotifPanelBody() {
    let items;
    let readMap;
    try {
        items = getTaskNotifications();
        readMap = getNotificationReadMap();
    } catch (error) {
        console.error('Unable to load notifications.', error);
        return `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Notifications could not be loaded.</div>`;
    }
    if (!items.length)
        return `<div class="header-panel-empty"><i class="bi bi-check2-circle" aria-hidden="true"></i>Nothing due soon</div><a class="header-panel-footer" href="../app/notifications.html">View all notifications</a>`;
    return items.slice(0, 5).map(n => `
        <a class="header-panel-item ${readMap[n.id] ? 'is-read' : 'is-unread'}" href="../app/notifications.html?item=${encodeURIComponent(n.id)}">
            <span class="header-panel-dot ${n.overdue ? 'is-overdue' : ''}" aria-hidden="true"></span>
            <span class="header-panel-item-text">
                <span class="header-panel-item-title">${escHtml(n.title)}</span>
                <span class="header-panel-item-sub">${n.overdue ? 'Overdue' : 'Due ' + n.due.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </span>
        </a>`).join('') + `<a class="header-panel-footer" href="../app/notifications.html">View all notifications</a>`;
}

function renderInboxPanelLoading() {
    return `<div class="header-panel-empty"><i class="bi bi-hourglass-split" aria-hidden="true"></i>Loading…</div>`;
}

/* Mirrors the admin/student inbox page's own message-row layout (pill
   category, subject, ellipsized preview) so the preview in this dropdown
   and the full inbox page always look like the same component. */
function renderInboxPanelItems(rows, icons, categoryBadge) {
    if (!rows.length)
        return `<div class="header-panel-empty"><i class="bi bi-inbox" aria-hidden="true"></i>Nothing here yet<span>Messages from your administrators will appear here.</span></div><a class="header-panel-footer" href="../app/inbox.html">View all messages</a>`;
    return `<div class="msg-list msg-list-compact">` + rows.slice(0, 5).map(r => {
        const m = r.message;
        const icon = icons[m.category] || 'bi-chat-square-text-fill';
        return `
        <a class="msg-row ${r.read_at ? '' : 'is-unread'}" href="../app/inbox.html">
            <span class="msg-row-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
            <span class="msg-row-body">
                <span class="msg-pill">${categoryBadge(escHtml, m.category)}</span>
                <span class="msg-subject">${escHtml(m.subject)}</span>
                <span class="msg-preview">${escHtml(m.body || '')}</span>
            </span>
        </a>`;
    }).join('') + `</div><a class="header-panel-footer" href="../app/inbox.html">View all messages</a>`;
}

/* Fetches the signed-in student's real inbox preview + unread count from Supabase
   (via a dynamic import, since this file is a classic script, not a module) and
   fills in the header popover + badge. Never fabricates a count: if there is no
   session or the request fails, the badge just stays hidden. */
async function refreshInboxPreview() {
    const badge = document.getElementById('inboxUnreadCount');
    const body = document.querySelector('#inboxPanel .header-panel-body');
    if (!badge || !body) return;

    try {
        const { StudentService } = await import('../services/student-service.js');
        const { MESSAGE_CATEGORY_ICONS, messageCategoryBadge } = await import('../modules/comms-shared.js');
        const [countResult, listResult] = await Promise.all([
            StudentService.getUnreadCount(),
            StudentService.listInboxMessages({ pageSize: 5 }),
        ]);

        if (!countResult.ok) {
            console.error('Inbox unread count failed:', countResult.message);
            badge.hidden = true;
            document.querySelectorAll('[data-inbox-dot]').forEach(d => { d.hidden = true; });
            body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml(countResult.message || '')}</span></div>`;
            return;
        }

        const count = countResult.data;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count === 0;
        document.querySelectorAll('[data-inbox-dot]').forEach(d => { d.hidden = count === 0; });
        document.getElementById('inboxTrigger').setAttribute('aria-label', count ? `Inbox, ${count} unread` : 'Inbox');

        if (listResult.ok) {
            body.innerHTML = renderInboxPanelItems(listResult.data.rows, MESSAGE_CATEGORY_ICONS, messageCategoryBadge);
        } else {
            console.error('Inbox preview list failed:', listResult.message);
            body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml(listResult.message || '')}</span></div>`;
        }
    } catch (error) {
        console.error('Could not load inbox preview.', error);
        badge.hidden = true;
        if (body.innerHTML.includes('bi-hourglass-split')) {
            body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml((error && error.message) || '')}</span></div>`;
        }
    }
}

/* Admin header bar: sidebar toggle + dynamic page title on the left; theme toggle,
   avatar and a role pill (never hardcoded — filled in from the real `profiles.role`
   value by admin-shared.js's mountAdminTopbar, once the authenticated admin's own
   row has been verified) on the right. No notifications/inbox popovers here — the
   admin Inbox is its own sidebar page, not a header shortcut. */
function renderAdminShellBar(activeKey, admin) {
    const main = document.querySelector('.main-content');
    if (!main || document.getElementById('shellBar'))
        return;
    const pageTitle = PAGE_TITLES[activeKey] || 'Admin';
    const roleLabel = admin && admin.role ? admin.role.replace(/_/g, ' ').toUpperCase() : '';
    const name = (admin && admin.full_name) || 'Administrator';
    const initial = escHtml(name.charAt(0).toUpperCase() || 'A');
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
            <span class="role-pill js-admin-role" id="shellRolePill"${roleLabel ? '' : ' hidden'}>${escHtml(roleLabel)}</span>
            <div class="profile-menu" id="profileMenu">
                <button type="button" class="profile-trigger profile-trigger-circle" id="profileTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="profilePanel" aria-label="Account menu">
                    <span class="profile-avatar js-admin-avatar" aria-hidden="true" id="shellAdminAvatar">${initial}</span>
                </button>
                <div class="profile-panel" id="profilePanel" role="menu" aria-label="Account menu" hidden>
                    <div class="profile-panel-head">
                        <span class="profile-avatar profile-avatar-lg js-admin-avatar" aria-hidden="true">${initial}</span>
                        <div class="profile-panel-id">
                            <div class="profile-panel-name js-admin-fullname" title="${escHtml(name)}">${escHtml(name)}</div>
                            <div class="profile-panel-sub js-admin-email" id="shellAdminEmail">&nbsp;</div>
                        </div>
                    </div>
                    <div class="profile-panel-section">
                        <div class="profile-panel-label">Theme</div>
                        <div class="theme-options" role="radiogroup" aria-label="Theme" data-theme-options></div>
                    </div>
                    <div class="profile-panel-section">
                        <a class="profile-item" role="menuitem" href="settings.html"><i class="bi bi-sliders" aria-hidden="true"></i>Settings</a>
                        <button type="button" class="profile-item profile-item-btn js-admin-logout" role="menuitem"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
                    </div>
                </div>
            </div>
        </div>`;
    main.insertBefore(bar, main.firstChild);
    initHeaderPanel(bar, 'profileTrigger', 'profilePanel', 'profileMenu');
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
                    <span class="notification-count" id="notificationUnreadCount" aria-hidden="true" hidden></span>
                </button>
                <div class="header-panel" id="notifPanel" role="region" aria-label="Notifications" hidden>
                    <div class="header-panel-title">Notifications</div>
                    <div class="header-panel-body">${renderNotifPanelBody()}</div>
                </div>
            </div>
            <div class="header-panel-wrap" id="inboxMenu">
                <button type="button" class="shell-icon-btn" id="inboxTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="inboxPanel" aria-label="Inbox">
                    <i class="bi bi-inbox" aria-hidden="true"></i>
                    <span class="notification-count" id="inboxUnreadCount" aria-hidden="true" hidden></span>
                </button>
                <div class="header-panel" id="inboxPanel" role="region" aria-label="Inbox" hidden>
                    <div class="header-panel-title">Inbox</div>
                    <div class="header-panel-body">${renderInboxPanelLoading()}</div>
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
                        <div class="profile-panel-id">
                            <div class="profile-panel-name" id="topbarProfileName" title="${escHtml(name)}">${escHtml(name)}</div>
                            <div class="profile-panel-sub" id="topbarUserEmail">Signed in on this device</div>
                        </div>
                    </div>
                    <div class="profile-panel-section-semester" id="shellSemesterCardWrap">${renderShellSemesterCardHtml()}</div>
                    <div class="profile-panel-section">
                        <div class="profile-panel-label">Theme</div>
                        <div class="theme-options" role="radiogroup" aria-label="Theme" data-theme-options></div>
                    </div>
                    <div class="profile-panel-section">
                        <a class="profile-item" role="menuitem" href="../app/settings.html"><i class="bi bi-sliders" aria-hidden="true"></i>Settings</a>
                        <a class="profile-item" role="menuitem" href="../app/help.html"><i class="bi bi-question-circle" aria-hidden="true"></i>Help</a>
                        <a class="profile-item" role="menuitem" href="../app/report.html"><i class="bi bi-flag" aria-hidden="true"></i>Report</a>
                    </div>
                    <div class="profile-panel-section">
                        <button type="button" class="profile-item profile-item-btn profile-item-danger" role="menuitem" id="topbarProfileLogoutBtn" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
                    </div>
                </div>
            </div>
        </div>`;
    main.insertBefore(bar, main.firstChild);
    initHeaderPanel(bar, 'profileTrigger', 'profilePanel', 'profileMenu');
    initHeaderPanel(bar, 'notifTrigger', 'notifPanel', 'notifMenu');
    initHeaderPanel(bar, 'inboxTrigger', 'inboxPanel', 'inboxMenu');
    updateNotificationBadge();
    refreshInboxPreview();
    window.addEventListener('storage', event => {
        if (event.key === NOTIFICATION_READ_KEY) refreshNotificationPreview();
    });
    window.addEventListener('planner:notifications-changed', refreshNotificationPreview);
    window.addEventListener('planner:tasks-changed', refreshNotificationPreview);
    // The shell bar (and this semester card inside the avatar popup) is built
    // synchronously on page load, straight from whatever is in localStorage at
    // that instant -- but right after login that cache is still empty/stale,
    // because cloud-sync.js's hydrate() (which pulls the real semester list from
    // Supabase) finishes afterwards, asynchronously. Without this listener the
    // card just silently stayed blank/outdated until the student manually
    // refreshed the page, even though the correct data had already arrived.
    window.addEventListener('planner:cloud-synced', refreshShellSemesterCard);
}

function refreshShellSemesterCard() {
    const wrap = document.getElementById('shellSemesterCardWrap');
    if (wrap) wrap.innerHTML = renderShellSemesterCardHtml();
}

function refreshNotificationPreview() {
    updateNotificationBadge();
    const body = document.querySelector('#notifPanel .header-panel-body');
    if (body) body.innerHTML = renderNotifPanelBody();
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
    function positionPanel() {
        const triggerRect = trigger.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const panelWidth = panel.getBoundingClientRect().width;
        const gutter = Math.min(16, window.innerWidth / 2);
        const maxLeft = Math.max(gutter, window.innerWidth - panelWidth - gutter);
        const left = Math.min(Math.max(triggerRect.left, gutter), maxLeft);
        panel.style.left = `${left - wrapperRect.left}px`;
        panel.style.right = 'auto';
    }
    function setOpen(isOpen) {
        if (isOpen) closeOthers();
        panel.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) positionPanel();
    }
    trigger.addEventListener('click', () => setOpen(panel.hidden));
    window.addEventListener('resize', () => {
        if (!panel.hidden) positionPanel();
    });
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

/* Bootstrap already manages modal focus trapping, Escape/backdrop dismissal, body scroll,
   and focus restoration. Normalize the visible close control for all existing and lazy
   modals without replacing their established submit/cancel behavior. */
function wireModalDefaults() {
    if (window.__qcuModalDefaultsWired) return;
    window.__qcuModalDefaultsWired = true;
    const formBaselines = new WeakMap();
    const focusTargets = new WeakMap();
    const snapshotFormControls = modal => JSON.stringify(
        [...modal.querySelectorAll('input, textarea, select')].map(control => ({
            name: control.name,
            type: control.type,
            value: control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value,
        }))
    );
    const hasUnsavedChanges = modal => {
        const baseline = formBaselines.get(modal);
        return baseline !== undefined && baseline !== snapshotFormControls(modal);
    };
    const askToDiscard = modal => window.confirm('Discard unsaved changes and close this dialog?');
    const dismissIfDirty = (modal, event) => {
        if (!modal || !hasUnsavedChanges(modal)) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (askToDiscard(modal)) {
            const instance = bootstrap.Modal.getInstance(modal);
            if (instance) instance.hide();
        }
        return true;
    };

    document.addEventListener('show.bs.modal', event => {
        const modal = event.target;
        if (!(modal instanceof HTMLElement) || !modal.classList.contains('modal')) return;
        const content = modal.querySelector('.modal-content');
        if (!content) return;
        formBaselines.set(modal, snapshotFormControls(modal));
        if (!modal.contains(document.activeElement))
            focusTargets.set(modal, document.activeElement);
        modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (modal.dataset.hideCloseButton === 'true') {
            content.querySelectorAll('button.btn-close, :scope > .modal-close-floating').forEach(button => button.remove());
        } else {
            const header = content.querySelector(':scope > .modal-header');
            const closeSelector = 'button.btn-close, button[data-bs-dismiss="modal"]';
            /* Look for an existing close button anywhere inside the modal content —
               not just as a direct child of a .modal-header or of .modal-content —
               since several of our modals (e.g. the admin "view" detail modal) put
               their own button.btn-close inside a plain header-style wrapper div
               instead of a real .modal-header. Scoping the search too narrowly made
               this miss that button and inject a second, floating one on top of it. */
            let closeButton = content.querySelector(closeSelector) || content.querySelector('.modal-close-floating');
            if (!closeButton) {
                closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'btn-close';
                closeButton.setAttribute('data-bs-dismiss', 'modal');
                if (header) header.appendChild(closeButton);
                else {
                    closeButton.classList.add('modal-close-floating');
                    content.appendChild(closeButton);
                }
            }
            content.querySelectorAll(`${closeSelector}, .modal-close-floating`).forEach(button => {
                if (button !== closeButton)
                    button.remove();
            });
            closeButton.type = 'button';
            if (!closeButton.classList.contains('btn-close') && !closeButton.textContent.trim())
                closeButton.classList.add('btn-close');
            closeButton.setAttribute('aria-label', 'Close modal');
        }

        if (!modal.hasAttribute('aria-labelledby') && !modal.hasAttribute('aria-label')) {
            const title = content.querySelector('.modal-title, h1, h2, h3, h4, h5, h6');
            if (title) {
                if (!title.id) title.id = `${modal.id || 'app'}-dialog-title`;
                modal.setAttribute('aria-labelledby', title.id);
            } else {
                modal.setAttribute('aria-label', 'Dialog');
            }
        }
    });
    window.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const closeControl = event.target.closest('button[data-bs-dismiss="modal"], .modal-header .btn-close');
        if (closeControl) {
            dismissIfDirty(closeControl.closest('.modal'), event);
            return;
        }
        if (event.target.classList.contains('modal') && event.target.dataset.bsBackdrop !== 'static')
            dismissIfDirty(event.target, event);
    }, true);
    window.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const modal = document.querySelector('.modal.show');
        if (modal && modal.dataset.bsKeyboard !== 'false')
            dismissIfDirty(modal, event);
    }, true);
    document.addEventListener('hidden.bs.modal', event => {
        if (!(event.target instanceof HTMLElement)) return;
        formBaselines.delete(event.target);
        const opener = focusTargets.get(event.target);
        focusTargets.delete(event.target);
        if (opener instanceof HTMLElement && opener.isConnected)
            opener.focus();
    });
}

function renderShell(activeKey, admin) {
    const isAdminArea = String(activeKey).startsWith('admin-');
    if (isAdminArea) renderAdminShellBar(activeKey, admin);
    else renderShellBar(activeKey);
    // sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        const sidebarGroups = isAdminArea
            ? [
                { label: 'Overview', keys: ['admin-dashboard'] },
                { label: 'User Management', keys: ['admin-users', 'admin-verification', 'admin-rejected'] },
                { label: 'Communications', keys: ['admin-inbox', 'admin-tickets', 'admin-email', 'admin-announcements'] },
                { label: 'System', keys: ['admin-reports', 'admin-activity', 'admin-settings'] },
            ]
            : [
                { label: 'Communication', keys: ['inbox', 'notifications', 'announcements'] },
                { label: 'Overview', keys: ['dashboard'] },
                { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'notes', 'curriculum'] },
                { label: 'AI Tools', keys: ['ai-quiz-maker', 'ai-flashcard-maker', 'ai-study-assistant', 'ai-summarizer', 'ai-reviewer'] },
                { label: 'Personalization', keys: ['wallpaper'] },
                { label: 'Safety & Support', keys: ['settings', 'help', 'report', 'legal-policies'] },
            ];
        const itemMap = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n]));
        const sidebarSettings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
        const name = (sidebarSettings.name || '').trim() || 'Student';
        const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
        const brandLabel = isAdminArea ? 'Planner Admin' : 'QCU Planner';
        const brandIcon = isAdminArea ? 'bi-shield-lock-fill' : 'bi-mortarboard';
        let sidebarHtml = `<div class="brand" role="banner"><span class="dot"><i class="bi ${brandIcon}" aria-hidden="true"></i></span> ${brandLabel}</div>`;
        sidebarHtml += `<nav class="sidebar-nav" aria-label="Main navigation">`;
        sidebarGroups.forEach(g => {
            if (g.label)
                sidebarHtml += `<div class="nav-group-label" role="heading" aria-level="2">${g.label}</div>`;
            g.keys.forEach(k => {
                const n = itemMap[k];
                if (!n)
                    return;
                const isActive = n.key === activeKey;
                const badgeHtml = n.soon ? `<span class="nav-pill-soon">Soon</span>`
                    : isAdminArea ? `<span class="nav-badge" data-admin-badge="${n.key}" hidden></span>`
                    : n.key === 'inbox' ? `<span class="nav-dot" data-inbox-dot hidden></span>` : '';
                sidebarHtml += `<a class="nav-link${isActive ? ' active' : ''}${n.soon ? ' nav-link-soon' : ''}" href="../${n.base}/${n.href}" ${isActive ? 'aria-current="page"' : ''}><i class="bi ${n.icon}" aria-hidden="true"></i><span class="nav-link-label">${n.label}</span>${badgeHtml}</a>`;
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
            sidebarHtml += `<div class="sidebar-profile" id="sidebarProfile">
      <span class="profile-avatar" aria-hidden="true" id="sidebarProfileAvatar">${initial}</span>
      <div class="sidebar-profile-text">
        <div class="sidebar-profile-name" id="sidebarProfileName">${escHtml(name)}</div>
        <div class="sidebar-profile-sub" id="sidebarUserName">Signed in on this device</div>
      </div>
      <button type="button" class="sidebar-profile-more" id="sidebarProfileMoreBtn"
        aria-haspopup="true" aria-expanded="false" aria-controls="sidebarProfilePanel" aria-label="Profile options">
        <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
      </button>
    </div>`;
        }
        sidebarHtml += `</div>`;
        sidebar.innerHTML = sidebarHtml;
    }
    ensureNavDrawer(activeKey);
    if (!isAdminArea) {
        ensureSidebarProfileMenu();
        ensureDrawerProfileMenu();
    }
    initThemeSwitches();
    initThemeOptions();
    wireSidebarToggles();
    wireModalDefaults();
    hydrateProfileIdentity();
    if (isAdminArea) refreshAdminNavBadges();
}

/* ---------- Footer profile overflow menu (Logout only) — desktop sidebar + mobile drawer ----------
   Builds one such menu per (triggerId, panelId) pair, rendered into document.body (not
   inside .sidebar/.nav-drawer) and positioned with fixed coordinates, so it is never
   clipped by the sidebar's/drawer's own overflow:hidden. Flips open upward or downward
   based on available space, closes on outside click/Escape, and participates in the same
   closeOthers() set (.header-panel, .profile-panel) as the header popups in initHeaderPanel(). */
function ensureFooterProfileMenu(triggerId, panelId) {
    const trigger = document.getElementById(triggerId);
    if (!trigger) {
        const stalePanel = document.getElementById(panelId);
        if (stalePanel) stalePanel.hidden = true;
        return;
    }
    let panel = document.getElementById(panelId);
    if (!panel) {
        panel = document.createElement('div');
        panel.id = panelId;
        panel.className = 'profile-panel sidebar-profile-panel';
        panel.setAttribute('role', 'menu');
        panel.setAttribute('aria-label', 'Profile options');
        panel.hidden = true;
        document.body.appendChild(panel);
    }
    panel.innerHTML = `<button type="button" class="profile-item profile-item-btn profile-item-danger" role="menuitem" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>`;

    function closeOthers() {
        document.querySelectorAll('.header-panel, .profile-panel').forEach(p => {
            if (p.id !== panelId && !p.hidden) {
                p.hidden = true;
                const t = document.querySelector('[aria-controls="' + p.id + '"]');
                if (t) t.setAttribute('aria-expanded', 'false');
            }
        });
    }
    function positionPanel() {
        const rect = trigger.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const gutter = 8;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        /* The footer trigger usually has little or no room below it, so prefer
           opening upward; fall back to downward only when there is genuinely
           more room that way (e.g. a very short viewport). */
        const openUp = spaceAbove >= (panelRect.height + gutter) || spaceAbove >= spaceBelow;
        const top = openUp
            ? Math.max(gutter, rect.top - panelRect.height - 8)
            : Math.min(window.innerHeight - panelRect.height - gutter, rect.bottom + 8);
        let left = rect.right - panelRect.width;
        left = Math.min(Math.max(left, gutter), window.innerWidth - panelRect.width - gutter);
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
    }
    function setOpen(isOpen) {
        if (isOpen) closeOthers();
        panel.hidden = !isOpen;
        trigger.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) positionPanel();
    }
    trigger.addEventListener('click', event => {
        event.stopPropagation();
        setOpen(panel.hidden);
    });
    window.addEventListener('resize', () => { if (!panel.hidden) positionPanel(); });
    document.addEventListener('click', event => {
        if (!panel.hidden && !trigger.contains(event.target) && !panel.contains(event.target))
            setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            setOpen(false);
            trigger.focus();
        }
    });
}
function ensureSidebarProfileMenu() {
    ensureFooterProfileMenu('sidebarProfileMoreBtn', 'sidebarProfilePanel');
}
function ensureDrawerProfileMenu() {
    ensureFooterProfileMenu('drawerProfileMoreBtn', 'drawerProfilePanel');
}

/* Real open-ticket count on the "Support Tickets" sidebar entry (desktop sidebar
   and the mobile nav drawer share the same data-admin-badge attribute, so one
   querySelectorAll updates both). Never shows a fabricated number: if the request
   fails for any reason the badge just stays hidden, same as every other badge here. */
async function refreshAdminNavBadges() {
    const badges = document.querySelectorAll('[data-admin-badge="admin-tickets"]');
    if (!badges.length) return;
    try {
        const { AdminService } = await import('../services/admin-service.js');
        const result = await AdminService.getCommsStats();
        if (!result.ok) return;
        const count = result.data.ticketsOpen;
        badges.forEach(b => {
            b.textContent = count > 99 ? '99+' : String(count);
            b.hidden = count === 0;
        });
    } catch (error) {
        console.error('Could not load admin nav badge counts.', error);
    }
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
            import('../services/auth-service.js'),
            import('./supabase-client.js'),
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

        document.querySelectorAll('#sidebarUserName, #drawerUserEmail, #topbarUserEmail, #shellAdminEmail').forEach(el => {
            el.textContent = email;
            el.title = email;
        });
        if (fullName) {
            const initial = escHtml(fullName.charAt(0).toUpperCase() || 'S');
            document.querySelectorAll('#sidebarProfileName, #drawerProfileName, #topbarProfileName').forEach(el => { el.textContent = fullName; el.title = fullName; });
            document.querySelectorAll('#sidebarProfileAvatar, #drawerProfileAvatar, #topbarProfileAvatar').forEach(el => { el.textContent = initial; });
            document.querySelectorAll('.js-admin-fullname').forEach(el => { el.textContent = fullName; el.title = fullName; });
            document.querySelectorAll('.js-admin-avatar').forEach(el => { el.textContent = initial; });
        }
    } catch (error) {
        /* No live Supabase session available (offline, static preview, etc.) — keep the
           device-local fallback already rendered. */
    }
}
/* ---------- MOBILE NAVIGATION DRAWER ---------- */
/* Keep the student navigation hierarchy identical in the desktop sidebar and mobile drawer. */
const DRAWER_GROUPS = [
    { label: 'Communication', keys: ['inbox', 'notifications', 'announcements'] },
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'notes', 'curriculum'] },
    { label: 'AI Tools', keys: ['ai-quiz-maker', 'ai-flashcard-maker', 'ai-study-assistant', 'ai-summarizer', 'ai-reviewer'] },
    { label: 'Personalization', keys: ['wallpaper'] },
    { label: 'Safety & Support', keys: ['settings', 'help', 'report', 'legal-policies'] }
];
const ADMIN_DRAWER_GROUPS = [
    { label: 'Overview', keys: ['admin-dashboard'] },
    { label: 'User Management', keys: ['admin-users', 'admin-verification', 'admin-rejected'] },
    { label: 'Communications', keys: ['admin-inbox', 'admin-tickets', 'admin-email', 'admin-announcements'] },
    { label: 'System', keys: ['admin-reports', 'admin-activity', 'admin-settings'] },
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
        const badgeHtml = item.soon ? `<span class="nav-pill-soon">Soon</span>`
            : isAdminArea ? `<span class="nav-badge" data-admin-badge="${item.key}" hidden></span>`
            : item.key === 'inbox' ? `<span class="nav-dot" data-inbox-dot hidden></span>` : '';
        return `<a class="drawer-link${isActive ? ' active' : ''}${item.soon ? ' drawer-link-soon' : ''}" href="../${item.base}/${item.href}"${isActive ? ' aria-current="page"' : ''}>
                    <i class="bi ${item.icon}" aria-hidden="true"></i>
                    <span>${item.label}</span>${badgeHtml}
                </a>`;
    }).join('')}
        </div>`).join('');
    const sidebarSettingsForDrawer = (!isAdminArea && typeof DB !== 'undefined') ? DB.getSettings() : {};
    const drawerName = (sidebarSettingsForDrawer.name || '').trim() || 'Student';
    const drawerInitial = escHtml(drawerName.charAt(0).toUpperCase() || 'S');
    const bottomHtml = isAdminArea ? `
            <div class="drawer-group drawer-bottom">
                <button type="button" class="drawer-link drawer-link-danger js-admin-logout" id="admDrawerLogoutBtn"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>
            </div>` : `
            <div class="drawer-profile" id="drawerProfile">
                <span class="profile-avatar" aria-hidden="true" id="drawerProfileAvatar">${drawerInitial}</span>
                <div class="drawer-profile-text">
                    <div class="drawer-profile-name" id="drawerProfileName">${escHtml(drawerName)}</div>
                    <div class="drawer-profile-sub" id="drawerUserEmail">Signed in on this device</div>
                </div>
                <button type="button" class="drawer-profile-more" id="drawerProfileMoreBtn"
                    aria-haspopup="true" aria-expanded="false" aria-controls="drawerProfilePanel" aria-label="Profile options">
                    <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
                </button>
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
                    <i class="bi bi-layout-sidebar-reverse" aria-hidden="true"></i>
                </button>
            </div>
            <nav class="nav-drawer-body" aria-label="All pages">${groupsHtml}</nav>
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

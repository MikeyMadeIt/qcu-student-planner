// NAV
const NAV_ITEMS = [
    { href: 'inbox.html', icon: 'bi-inbox', label: 'Inbox', key: 'inbox', base: 'app' },
    { href: 'notifications.html', icon: 'bi-bell', label: 'Notifications', key: 'notifications', base: 'app' },
    { href: 'dashboard.html', icon: 'bi-grid-1x2', label: 'Dashboard', key: 'dashboard', base: 'app' },
    { href: 'news.html', icon: 'bi-megaphone', label: 'News & Announcements', key: 'news', base: 'app' },
    { href: 'schedule.html', icon: 'bi-calendar2-week', label: 'Schedule', key: 'schedule', base: 'app' },
    { href: 'tasks.html', icon: 'bi-check2-square', label: 'Tasks', key: 'tasks', base: 'app' },
    { href: 'calendar.html', icon: 'bi-calendar3', label: 'Calendar', key: 'calendar', base: 'app' },
    { href: 'grades.html', icon: 'bi-mortarboard', label: 'Grades', key: 'grades', base: 'app' },
    { href: 'attendance.html', icon: 'bi-person-check', label: 'Attendance', key: 'attendance', base: 'app' },
    { href: 'notes.html', icon: 'bi-journal-text', label: 'Notes', key: 'notes', base: 'app' },
    { href: 'curriculum.html', icon: 'bi-book-half', label: 'Curriculum', key: 'curriculum', base: 'app' },
    { href: 'ai-quiz-maker.html', icon: 'bi-patch-question', label: 'AI Quiz Maker', key: 'ai-quiz-maker', base: 'app' },
    { href: 'ai-flashcard-maker.html', icon: 'bi-layers', label: 'AI Flashcard Maker', key: 'ai-flashcard-maker', base: 'app' },
    { href: 'ai-study-assistant.html', icon: 'bi-stars', label: 'AI Study Assistant', key: 'ai-study-assistant', base: 'app' },
    { href: 'wallpaper.html', icon: 'bi-phone', label: 'Wallpaper', key: 'wallpaper', base: 'app' },
    { href: 'settings.html', icon: 'bi-gear', label: 'Settings', key: 'settings', base: 'app' },
    { href: 'help.html', icon: 'bi-question-circle', label: 'Help Center', key: 'help', base: 'app' },
    { href: 'report.html', icon: 'bi-flag', label: 'Report a Problem', key: 'report', base: 'app' },
    { href: 'legal-policies.html', icon: 'bi-shield-check', label: 'Legal & Policies', key: 'legal-policies', base: 'app' },
    { href: 'dashboard.html', icon: 'bi-speedometer2', label: 'Overview', key: 'admin-dashboard', base: 'admin' },
    { href: 'university-events.html', icon: 'bi-bank2', label: 'University Events', key: 'admin-university-events', base: 'admin' },
    { href: 'users.html', icon: 'bi-people', label: 'All Users', key: 'admin-users', base: 'admin' },
    { href: 'verification.html', icon: 'bi-person-check', label: 'Pending Approvals', key: 'admin-verification', base: 'admin' },
    { href: 'rejected.html', icon: 'bi-person-x', label: 'Rejected Accounts', key: 'admin-rejected', base: 'admin' },
    { href: 'inbox.html', icon: 'bi-inbox', label: 'Inbox', key: 'admin-inbox', base: 'admin' },
    { href: 'tickets.html', icon: 'bi-life-preserver', label: 'Support Tickets', key: 'admin-tickets', base: 'admin' },
    { href: 'activity-log.html', icon: 'bi-clock-history', label: 'Audit Logs', key: 'admin-activity', base: 'admin' },
];
const THEME_OPTIONS = [
    { value: 'dark', label: 'Dark', icon: 'bi-moon-stars' },
    { value: 'light', label: 'Light', icon: 'bi-sun' },
    { value: 'amoled', label: 'AMOLED', icon: 'bi-circle' }
];
const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n.label]));

const PAGE_SECTIONS = {
    inbox: 'Communication',
    notifications: 'Communication',
    dashboard: 'Overview',
    news: 'University',
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
    wallpaper: 'Personalization',
    settings: 'Safety & Support',
    help: 'Safety & Support',
    report: 'Safety & Support',
    'legal-policies': 'Safety & Support',
    'admin-dashboard': 'Overview',
    'admin-university-events': 'Events',
    'admin-users': 'User Management',
    'admin-verification': 'User Management',
    'admin-rejected': 'User Management',
    'admin-inbox': 'Communications',
    'admin-tickets': 'Communications',
    'admin-activity': 'System',
};
const STUDENT_NAV_GROUPS = [
    { label: 'Communication', keys: ['inbox', 'notifications'] },
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'Academics', keys: ['schedule', 'tasks', 'calendar', 'grades', 'attendance', 'notes', 'curriculum'] },
    { label: 'AI Tools', keys: ['ai-quiz-maker', 'ai-flashcard-maker', 'ai-study-assistant'] },
    { label: 'University', keys: ['news'] },
    { label: 'Personalization', keys: ['wallpaper'] },
    { label: 'Safety & Support', keys: ['settings', 'help', 'report', 'legal-policies'] },
];
const ADMIN_NAV_GROUPS = [
    { label: 'Overview', keys: ['admin-dashboard'] },
    { label: 'Events', keys: ['admin-university-events'] },
    { label: 'User Management', keys: ['admin-users', 'admin-verification', 'admin-rejected'] },
    { label: 'Communications', keys: ['admin-inbox', 'admin-tickets'] },
    { label: 'System', keys: ['admin-activity'] },
];
const NAV_GROUP_ICONS = {
    Communication: 'bi-chat-dots', Communications: 'bi-chat-dots', Overview: 'bi-grid-1x2',
    Academics: 'bi-mortarboard', 'AI Tools': 'bi-stars', University: 'bi-bank',
    Personalization: 'bi-palette', 'Safety & Support': 'bi-shield-check',
    Events: 'bi-calendar-event', 'User Management': 'bi-people', System: 'bi-cpu'
};
// Sign out
async function signOutAndRedirect(button) {
    if (button) button.disabled = true;
    try {
        const { AuthService } = await import('../services/auth-service.js');
        await AuthService.signOut();
    } catch (error) {
    }
    location.href = '../auth/login.html';
}
window.signOutAndRedirect = signOutAndRedirect;

// Current-semester card (header avatar popup)
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

// Theme switcher (topbar)
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
        btn.addEventListener('click', (event) => {
            setTheme(btn.dataset.themeValue, event);
            syncThemeSwitches();
            syncThemeOptions();
        });
    });
}
// Belt-and-suspenders: when the view-transition path is used, setTheme's
// write actually lands a frame or two after this click handler returns, so
// the calls above can sync against the OLD data-theme and leave the active
// outline stuck on the previous choice. Re-sync once the write is confirmed.
if (!window.__themeSwitchSyncWired) {
    window.__themeSwitchSyncWired = true;
    document.addEventListener('sp:themechange', () => {
        syncThemeSwitches();
        syncThemeOptions();
    });
}

// Theme switcher (labeled, 3-across — used in the student profile panel)
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
    const option = THEME_OPTIONS.find(item => item.value === currentTheme) || THEME_OPTIONS[0];
    document.querySelectorAll('[data-mobile-theme-icon]').forEach(icon => {
        icon.className = `bi ${option.icon}`;
    });
}
function initThemeOptions() {
    document.querySelectorAll('[data-theme-options]').forEach(el => {
        if (!el.childElementCount) el.innerHTML = renderThemeOptionsHtml();
    });
    document.querySelectorAll('[data-theme-options] .theme-option').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', (event) => {
            setTheme(btn.dataset.themeValue, event);
            syncThemeOptions();
            syncThemeSwitches();
        });
    });
}

function initMobileThemeMenu() {
    const wrapper = document.getElementById('mobileThemeMenu');
    const trigger = document.getElementById('mobileThemeTrigger');
    const panel = document.getElementById('mobileThemePanel');
    if (!wrapper || !trigger || !panel || trigger.dataset.wired) return;
    trigger.dataset.wired = '1';
    const setOpen = open => {
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
    };
    trigger.addEventListener('click', event => {
        event.stopPropagation();
        setOpen(panel.hidden);
    });
    document.addEventListener('click', event => {
        if (!panel.hidden && !wrapper.contains(event.target)) setOpen(false);
    });
    document.addEventListener('sp:themechange', syncThemeOptions);
}

// Sidebar toggle (header)
function toggleSidebar() {
    const menu = document.getElementById('mobileAppNavMenu');
    if (menu && menu.classList.contains('is-open')) closeMobileAppNavMenu();
    else openMobileAppNavMenu();
}
function syncSidebarToggleIcon(isOpen) {
    document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        const icon = btn.querySelector('i');
        if (icon) {
            const isMobileApp = document.body.classList.contains('mobile-nav-app');
            icon.className = isMobileApp
                ? (isOpen ? 'bi bi-x-lg' : 'bi bi-list')
                : (isOpen ? 'bi bi-layout-sidebar-reverse' : 'bi bi-layout-sidebar');
        }
    });
}
function wireSidebarToggles() {
    document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        if (btn.dataset.wired) return;
        btn.dataset.wired = '1';
        btn.addEventListener('click', toggleSidebar);
    });
    syncSidebarToggleIcon(false);
}

const NOTIFICATION_READ_KEY = 'sp_notification_read';

function getTaskNotifications() {
    if (typeof DB === 'undefined') return [];
    const settings = DB.getSettings();
    if (settings.notifications && settings.notifications.taskReminders === false) return [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const horizon = new Date(todayStart.getTime() + 1000 * 60 * 60 * 24 * 3);
    return DB.getActiveTasks()
        .filter(t => t && t.dueDate && (typeof computeStatus === 'function' ? computeStatus(t) !== 'completed' : t.status !== 'completed'))
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
    try {
        const count = getUnreadNotificationCount();
        const label = count > 99 ? '99+' : String(count);
        document.querySelectorAll('[data-notification-badge]').forEach(item => {
            item.textContent = String(count);
            item.setAttribute('aria-label', `${count} unread notifications`);
            item.hidden = count === 0;
        });
        if (badge) {
            badge.textContent = label;
            badge.hidden = count === 0;
        }
        if (trigger) trigger.setAttribute('aria-label', count ? `Notifications, ${count} unread` : 'Notifications');
    } catch (error) {
        console.error('Unable to load notification read states.', error);
        document.querySelectorAll('[data-notification-badge]').forEach(item => { item.hidden = true; });
        if (badge) badge.hidden = true;
        if (trigger) trigger.setAttribute('aria-label', 'Notifications, status unavailable');
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

// Mirrors the admin/student inbox page's own message-row layout (pill
function renderInboxPanelItems(rows, icons, categoryBadge) {
    if (!rows.length)
        return `<div class="header-panel-empty"><i class="bi bi-inbox" aria-hidden="true"></i>Nothing here yet<span>Messages from your administrators will appear here.</span></div><a class="header-panel-footer" href="../app/inbox.html">View all messages</a>`;
    return `<div class="msg-list msg-list-compact">` + rows.slice(0, 5).map(r => {
        const m = r.message;
        const icon = icons[m.category] || 'bi-chat-square-text';
        return `
        <a class="msg-row ${r.read_at ? '' : 'is-unread'}" href="../app/inbox.html">
            <span class="msg-row-icon" aria-hidden="true"><i class="bi ${icon}" aria-hidden="true"></i></span>
            <span class="msg-row-body">
                <span class="msg-pill">${categoryBadge(escHtml, m.category)}</span>
                <span class="msg-subject">${escHtml(m.subject)}</span>
                <span class="msg-preview">${escHtml(m.body || '')}</span>
            </span>
        </a>`;
    }).join('') + `</div><a class="header-panel-footer" href="../app/inbox.html">View all messages</a>`;
}

// Fetches the signed-in student's real inbox preview + unread count from Supabase
let lastInboxBadgeRefresh = 0;
async function refreshInboxPreview({ refreshList = true, throttle = false } = {}) {
    const now = Date.now();
    if (throttle && now - lastInboxBadgeRefresh < 4000) return;
    lastInboxBadgeRefresh = now;
    const badge = document.getElementById('inboxUnreadCount');
    const body = document.querySelector('#inboxPanel .header-panel-body');

    try {
        const { StudentService } = await import('../services/student-service.js');
        const { MESSAGE_CATEGORY_ICONS, messageCategoryBadge } = await import('../modules/comms-shared.js');
        const requests = [StudentService.getUnreadCount()];
        if (body && refreshList) requests.push(StudentService.listInboxMessages({ pageSize: 5 }));
        const [countResult, listResult] = await Promise.all(requests);

        if (!countResult.ok) {
            console.error('Inbox unread count failed:', countResult.message);
            if (badge) badge.hidden = true;
            document.querySelectorAll('[data-inbox-badge]').forEach(item => { item.hidden = true; });
            document.querySelectorAll('[data-inbox-dot]').forEach(d => { d.hidden = true; });
            if (body) body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml(countResult.message || '')}</span></div>`;
            return;
        }

        const count = countResult.data;
        const label = count > 99 ? '99+' : String(count);
        if (badge) {
            badge.textContent = label;
            badge.hidden = count === 0;
        }
        document.querySelectorAll('[data-inbox-badge]').forEach(item => {
            item.textContent = String(count);
            item.setAttribute('aria-label', `${count} unread messages`);
            item.hidden = count === 0;
        });
        document.querySelectorAll('[data-inbox-dot]').forEach(d => { d.hidden = count === 0; });
        const trigger = document.getElementById('inboxTrigger');
        if (trigger) trigger.setAttribute('aria-label', count ? `Inbox, ${count} unread` : 'Inbox');

        if (body && listResult && listResult.ok) {
            body.innerHTML = renderInboxPanelItems(listResult.data.rows, MESSAGE_CATEGORY_ICONS, messageCategoryBadge);
        } else if (body && listResult) {
            console.error('Inbox preview list failed:', listResult.message);
            body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml(listResult.message || '')}</span></div>`;
        }
    } catch (error) {
        console.error('Could not load inbox preview.', error);
        if (badge) badge.hidden = true;
        document.querySelectorAll('[data-inbox-badge]').forEach(item => { item.hidden = true; });
        if (body && body.innerHTML.includes('bi-hourglass-split')) {
            body.innerHTML = `<div class="header-panel-empty" role="status"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Could not load your inbox.<span>${escHtml((error && error.message) || '')}</span></div>`;
        }
    }
}

let inboxBadgeChannelStarted = false;
async function setupInboxBadgeRealtime() {
    if (inboxBadgeChannelStarted) return;
    inboxBadgeChannelStarted = true;
    try {
        const { getSupabase } = await import('./supabase-client.js');
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        const userId = data && data.session && data.session.user && data.session.user.id;
        if (!userId) return;
        supabase.channel(`student-inbox-nav-${userId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'admin_message_recipients',
                filter: `student_id=eq.${userId}`,
            }, () => refreshInboxPreview({ refreshList: false }))
            .subscribe();
    } catch (error) {
        // The focus/visibility refresh remains available when realtime is unavailable.
    }
}

// Admin header bar: sidebar toggle + dynamic page title on the left; theme toggle,
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
        <a class="mobile-shell-brand" href="../admin/dashboard.html" aria-label="QCU Planner Admin home">
            <span class="dot"><i class="bi bi-shield-lock" aria-hidden="true"></i></span>
            <span>Planner Admin</span>
        </a>
        <div class="shell-bar-left">
            <button type="button" class="shell-menu-btn" data-sidebar-toggle aria-haspopup="true"
                aria-expanded="false" aria-controls="mobileAppNavMenu" aria-label="Open navigation">
                <i class="bi bi-layout-sidebar" aria-hidden="true"></i>
            </button>
            <h1 class="shell-page-title" id="shellPageTitle" title="${escHtml(pageTitle)}">${escHtml(pageTitle)}</h1>
        </div>
        <div class="mobile-shell-actions">
            <div class="mobile-theme-menu" id="mobileThemeMenu">
                <button type="button" class="mobile-shell-icon-btn" id="mobileThemeTrigger" aria-haspopup="true"
                    aria-expanded="false" aria-controls="mobileThemePanel" aria-label="Choose theme">
                    <i class="bi bi-moon-stars" data-mobile-theme-icon aria-hidden="true"></i>
                </button>
                <div class="mobile-theme-panel" id="mobileThemePanel" role="radiogroup" aria-label="Theme" data-theme-options hidden></div>
            </div>
            <button type="button" class="shell-menu-btn mobile-nav-trigger" data-sidebar-toggle aria-haspopup="true"
                aria-expanded="false" aria-controls="mobileAppNavMenu" aria-label="Open navigation">
                <i class="bi bi-list" aria-hidden="true"></i>
            </button>
        </div>
        <div class="shell-bar-right">
            <span class="role-pill js-admin-role" id="shellRolePill"${roleLabel ? '' : ' hidden'}>${escHtml(roleLabel)}</span>
            <div class="profile-menu" id="profileMenu">
                <button type="button" class="profile-trigger profile-trigger-circle" id="profileTrigger"
                    aria-haspopup="true" aria-expanded="false" aria-controls="profilePanel" aria-label="Account menu">
                    <span class="profile-avatar js-admin-avatar js-profile-avatar" aria-hidden="true" id="shellAdminAvatar">${initial}</span>
                </button>
                <div class="profile-panel" id="profilePanel" role="menu" aria-label="Account menu" hidden>
                    <div class="profile-panel-head">
                        <span class="profile-avatar profile-avatar-lg js-admin-avatar js-profile-avatar" aria-hidden="true">${initial}</span>
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
                        <button type="button" class="profile-item profile-item-btn js-admin-logout" role="menuitem"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</button>
                    </div>
                </div>
            </div>
        </div>`;
    main.insertBefore(bar, main.firstChild);
    initHeaderPanel(bar, 'profileTrigger', 'profilePanel', 'profileMenu');
    initMobileThemeMenu();
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
        <a class="mobile-shell-brand" href="../app/dashboard.html" aria-label="QCU Student Planner home">
            <span class="dot"><i class="bi bi-mortarboard" aria-hidden="true"></i></span>
            <span>QCU Student Planner</span>
        </a>
        <div class="shell-bar-left">
            <button type="button" class="shell-menu-btn" data-sidebar-toggle aria-haspopup="true"
                aria-expanded="false" aria-controls="mobileAppNavMenu" aria-label="Open navigation">
                <i class="bi bi-layout-sidebar" aria-hidden="true"></i>
            </button>
            <h1 class="shell-page-title" id="shellPageTitle" title="${escHtml(pageTitle)}">${escHtml(pageTitle)}</h1>
        </div>
        <div class="mobile-shell-actions">
            <div class="mobile-theme-menu" id="mobileThemeMenu">
                <button type="button" class="mobile-shell-icon-btn" id="mobileThemeTrigger" aria-haspopup="true"
                    aria-expanded="false" aria-controls="mobileThemePanel" aria-label="Choose theme">
                    <i class="bi bi-moon-stars" data-mobile-theme-icon aria-hidden="true"></i>
                </button>
                <div class="mobile-theme-panel" id="mobileThemePanel" role="radiogroup" aria-label="Theme" data-theme-options hidden></div>
            </div>
            <button type="button" class="shell-menu-btn mobile-nav-trigger" data-sidebar-toggle aria-haspopup="true"
                aria-expanded="false" aria-controls="mobileAppNavMenu" aria-label="Open navigation">
                <i class="bi bi-list" aria-hidden="true"></i>
            </button>
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
                    <span class="profile-avatar js-profile-avatar" aria-hidden="true" id="topbarProfileAvatarTrigger">${initial}</span>
                </button>
                <div class="profile-panel" id="profilePanel" role="menu" aria-label="Account menu" hidden>
                    <div class="profile-panel-head">
                        <span class="profile-avatar profile-avatar-lg js-profile-avatar" aria-hidden="true" id="topbarProfileAvatar">${initial}</span>
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
    window.addEventListener('planner:inbox-changed', () => refreshInboxPreview({ refreshList: false }));
    window.addEventListener('focus', () => refreshInboxPreview({ refreshList: false, throttle: true }));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshInboxPreview({ refreshList: false, throttle: true });
    });
    window.addEventListener('planner:cloud-synced', refreshShellSemesterCard);
    setupInboxBadgeRealtime();
    initMobileThemeMenu();
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
// Generic open/close wiring shared by the profile, notifications and inbox popovers:
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

// Bootstrap already manages modal focus trapping, Escape/backdrop dismissal, body scroll,
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
    const askToDiscard = (modal, onDiscard) => {
        confirmAction({
            title: 'Discard unsaved changes?',
            message: 'Discard unsaved changes and close this dialog?',
            confirmLabel: 'Discard',
            danger: true,
            icon: 'bi-exclamation-triangle',
            onConfirm: onDiscard,
        });
    };
    const dismissIfDirty = (modal, event) => {
        if (!modal || !hasUnsavedChanges(modal)) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        askToDiscard(modal, () => {
            const instance = bootstrap.Modal.getInstance(modal);
            if (instance) instance.hide();
        });
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
    const softNavigation = window.__spSoftNavigating === true || window.__spSoftRouteActive === true;
    const isAdminArea = String(activeKey).startsWith('admin-');
    document.body.classList.add('mobile-nav-app');
    document.body.classList.toggle('student-app', !isAdminArea);
    document.body.classList.toggle('admin-app', isAdminArea);
    if (isAdminArea) renderAdminShellBar(activeKey, admin);
    else renderShellBar(activeKey);
    const sidebar = softNavigation ? null : document.getElementById('sidebar');
    if (sidebar) {
        const sidebarGroups = isAdminArea ? ADMIN_NAV_GROUPS : STUDENT_NAV_GROUPS;
        const itemMap = Object.fromEntries(NAV_ITEMS.map(n => [n.key, n]));
        const sidebarSettings = (typeof DB !== 'undefined') ? DB.getSettings() : {};
        const name = (sidebarSettings.name || '').trim() || 'Student';
        const initial = escHtml(name.charAt(0).toUpperCase() || 'S');
        const brandLabel = isAdminArea ? 'Planner Admin' : 'QCU Planner';
        const brandIcon = isAdminArea ? 'bi-shield-lock' : 'bi-mortarboard';
        let hasMenuHeading = false;
        let sidebarHtml = `<div class="brand" role="banner"><span class="dot"><i class="bi ${brandIcon}" aria-hidden="true"></i></span> ${brandLabel}</div>`;
        sidebarHtml += `<nav class="sidebar-nav" aria-label="Main navigation">`;
        sidebarGroups.forEach((g, index) => {
            const groupId = `sidebarGroup${index}`;
            const directGroup = ['Communication', 'Communications', 'Overview'].includes(g.label);
            const expanded = g.keys.includes(activeKey);
            if (!directGroup && !hasMenuHeading) {
                sidebarHtml += `<div class="sidebar-section-label">Menu</div>`;
                hasMenuHeading = true;
            }
            sidebarHtml += `<section class="sidebar-nav-group">
                ${directGroup
                    ? `<div class="sidebar-group-heading"><span>${escHtml(g.label || 'Navigation')}</span></div>`
                    : `<button type="button" class="nav-group-toggle" aria-expanded="${expanded}" aria-controls="${groupId}">
                        <i class="bi ${NAV_GROUP_ICONS[g.label] || 'bi-folder'} sidebar-group-icon" aria-hidden="true"></i><span>${escHtml(g.label || 'Navigation')}</span><i class="bi bi-chevron-down sidebar-group-chevron" aria-hidden="true"></i>
                    </button>`}
                <div class="sidebar-group-items${directGroup ? '' : ' sidebar-tree'}" id="${groupId}"${directGroup || expanded ? '' : ' hidden'}>`;
            g.keys.forEach(k => {
                const n = itemMap[k];
                if (!n)
                    return;
                const isActive = n.key === activeKey;
                const badgeHtml = isAdminArea ? `<span class="nav-badge" data-admin-badge="${n.key}" hidden></span>`
                    : n.key === 'inbox' ? `<span class="nav-dot" data-inbox-dot hidden></span>` : '';
                sidebarHtml += `<a class="nav-link${isActive ? ' active' : ''}${directGroup ? '' : ' sidebar-tree-link'}" href="../${n.base}/${n.href}" ${isActive ? 'aria-current="page"' : ''}>${directGroup ? `<i class="bi ${n.icon}" aria-hidden="true"></i>` : ''}<span class="nav-link-label">${n.label}</span>${badgeHtml}</a>`;
            });
            sidebarHtml += `</div></section>`;
            if (directGroup) sidebarHtml += `<div class="sidebar-group-divider" aria-hidden="true"></div>`;
        });
        sidebarHtml += `</nav><div class="sidebar-bottom">`;

        if (isAdminArea) {
            const adminName = (admin && admin.full_name) || 'Administrator';
            const adminInitial = escHtml(adminName.charAt(0).toUpperCase() || 'A');
            sidebarHtml += `<div class="sidebar-theme-row"><span>Theme</span><div class="theme-switch" data-theme-switch role="radiogroup" aria-label="Theme"></div></div>
    <div class="sidebar-profile sidebar-admin-profile">
      <span class="profile-avatar js-admin-avatar js-profile-avatar" aria-hidden="true">${adminInitial}</span>
      <div class="sidebar-profile-text">
        <div class="sidebar-profile-name js-admin-name" id="admSidebarName">${escHtml(adminName)}</div>
        <div class="sidebar-profile-sub">${escHtml((admin && admin.role ? admin.role.replace(/_/g, ' ') : 'Administrator'))}</div>
      </div>
    </div>
    <div class="sidebar-utility">
      <button type="button" class="nav-link sidebar-logout-btn js-admin-logout" id="admSidebarLogoutBtn"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>
    </div>`;
        } else {
            sidebarHtml += `<div class="sidebar-theme-row"><span>Theme</span><div class="theme-switch" data-theme-switch role="radiogroup" aria-label="Theme"></div></div>
    <div class="sidebar-profile" id="sidebarProfile">
      <span class="profile-avatar js-profile-avatar" aria-hidden="true" id="sidebarProfileAvatar">${initial}</span>
      <div class="sidebar-profile-text">
        <div class="sidebar-profile-name" id="sidebarProfileName">${escHtml(name)}</div>
        <div class="sidebar-profile-sub" id="sidebarUserName">Signed in on this device</div>
      </div>
    </div>`;
            sidebarHtml += `<div class="sidebar-utility">
      <button type="button" class="nav-link sidebar-logout-btn" onclick="signOutAndRedirect(this);return false;"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>
    </div>`;
        }
        sidebarHtml += `</div>`;
        sidebar.innerHTML = sidebarHtml;
    }
    if (!softNavigation) ensureMobileAppNavMenu(activeKey, admin);
    if (!isAdminArea && !softNavigation) {
        updateNotificationBadge();
    }
    if (!softNavigation) wireDesktopSidebarGroups(sidebar);
    initThemeSwitches();
    initThemeOptions();
    syncThemeOptions();
    if (!softNavigation) wireSidebarToggles();
    wireModalDefaults();
    if (!softNavigation) hydrateProfileIdentity();
    if (isAdminArea && !softNavigation) refreshAdminNavBadges();
    // Upcoming Classes / Task Reminders / Low Attendance Warning (Settings >
    // Notifications): started once per page load from here, since every
    // signed-in app page calls renderShell(). See notification-engine.js
    // for why this runs on a foreground timer instead of real push.
    if (!softNavigation && !isAdminArea && typeof DB !== 'undefined' && window.ReminderEngine) {
        if (typeof DB.whenCloudReady === 'function') DB.whenCloudReady(function () { window.ReminderEngine.start(); });
        else window.ReminderEngine.start();
    }
    initDesktopMainScrollFade(document.querySelector('.main-content'));
    // Keep the existing document routes directly usable while enabling
    // shell-preserving navigation for signed-in app pages.
    import('./soft-navigation.js').then(({ initSoftNavigation }) => initSoftNavigation()).catch(error => {
        console.error('Could not initialize app navigation.', error);
    });
}

function initDesktopMainScrollFade(main) {
    if (!main || main.dataset.desktopScrollFadeWired) return;
    main.dataset.desktopScrollFadeWired = 'true';
    let frame = 0;
    const schedule = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            const desktop = window.matchMedia('(min-width: 992px)').matches;
            document.body.classList.toggle('desktop-main-overflow', desktop && main.scrollHeight > main.clientHeight + 1);
        });
    };
    let resizeObserver;
    const observeContent = () => {
        if (resizeObserver) {
            resizeObserver.disconnect();
            [...main.children].forEach(child => resizeObserver.observe(child));
        }
        schedule();
    };
    if (window.ResizeObserver) resizeObserver = new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(observeContent);
    mutationObserver.observe(main, { childList: true, subtree: true, characterData: true, attributes: true });
    observeContent();
    window.addEventListener('resize', schedule, { passive: true });
    main.addEventListener('load', schedule, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
}

function wireDesktopSidebarGroups(sidebar) {
    if (!sidebar) return;
    const activeLink = sidebar.querySelector('.nav-link.active');
    const activeGroup = activeLink && activeLink.closest('.sidebar-nav-group');
    if (activeGroup) {
        sidebar.querySelectorAll('.sidebar-nav-group').forEach(group => {
            const toggle = group.querySelector('.nav-group-toggle');
            const items = group.querySelector('.sidebar-group-items');
            if (!toggle || !items) return;
            const expanded = group === activeGroup;
            toggle.setAttribute('aria-expanded', String(expanded));
            items.hidden = !expanded;
        });
    }
    if (sidebar.dataset.groupsWired) return;
    sidebar.dataset.groupsWired = 'true';
    sidebar.addEventListener('click', event => {
        const toggle = event.target.closest('.nav-group-toggle');
        if (!toggle) return;
        const group = toggle.closest('.sidebar-nav-group');
        const items = group && group.querySelector('.sidebar-group-items');
        if (!items) return;
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        if (!expanded) {
            sidebar.querySelectorAll('.sidebar-nav-group').forEach(otherGroup => {
                const otherToggle = otherGroup.querySelector('.nav-group-toggle');
                const otherItems = otherGroup.querySelector('.sidebar-group-items');
                if (otherGroup !== group && otherToggle && otherItems) {
                    otherToggle.setAttribute('aria-expanded', 'false');
                    otherItems.hidden = true;
                }
            });
        }
        toggle.setAttribute('aria-expanded', String(!expanded));
        items.hidden = expanded;
    });
}
// Real open-ticket count on the "Support Tickets" sidebar entry (desktop sidebar
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

// Real authenticated identity (profile sections, bottom of both sidebars)
function setAvatarPhoto(el, photoUrl, initial) {
    if (!el) return;
    if (!photoUrl) {
        el.textContent = initial;
        return;
    }
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
        el.textContent = initial;
    };
    el.replaceChildren(img);
}

async function hydrateProfileIdentity() {
    try {
        const [{ AuthService }, { getSupabase }] = await Promise.all([
            import('../services/auth-service.js'),
            import('./supabase-client.js'),
        ]);
        const supabase = getSupabase();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData && sessionData.session && sessionData.session.user
            ? sessionData.session.user
            : null;
        const email = user ? user.email : '';
        if (!email) return;

        const metadata = user.user_metadata || {};
        const photoUrl = metadata.avatar_url || metadata.picture || '';

        let fullName = '';
        const profileResult = await AuthService.getCurrentProfile();
        if (profileResult.ok && profileResult.data && profileResult.data.full_name)
            fullName = profileResult.data.full_name;
        fullName = String(fullName || metadata.full_name || metadata.name || [metadata.first_name || metadata.given_name, metadata.last_name || metadata.family_name].filter(Boolean).join(' ') || '').trim();
        const greetEl = document.getElementById('greetText');
        if (greetEl && fullName)
            greetEl.dataset.userName = fullName;

        document.querySelectorAll('#sidebarUserName, #mobileProfileEmail, #topbarUserEmail, #shellAdminEmail').forEach(el => {
            el.textContent = email;
            el.title = email;
        });

        const initial = escHtml(((fullName || email).charAt(0) || 'S').toUpperCase());
        if (fullName) {
            document.querySelectorAll('#sidebarProfileName, #mobileProfileName, #topbarProfileName').forEach(el => { el.textContent = fullName; el.title = fullName; });
            document.querySelectorAll('.js-admin-fullname').forEach(el => { el.textContent = fullName; el.title = fullName; });
        }
        document.querySelectorAll('.js-profile-avatar').forEach(el => setAvatarPhoto(el, photoUrl, initial));
    } catch (error) {
    }
}
function ensureMobileAppNavMenu(activeKey, admin) {
    const existing = document.getElementById('mobileAppNavMenu');
    if (existing) existing.remove();
    const isAdminArea = String(activeKey).startsWith('admin-');
    const groups = isAdminArea ? ADMIN_NAV_GROUPS : STUDENT_NAV_GROUPS;
    const itemMap = Object.fromEntries(NAV_ITEMS.filter(item => item.base === (isAdminArea ? 'admin' : 'app')).map(item => [item.key, item]));
    const groupsHtml = groups.map(group => `
        <section class="mobile-nav-group" aria-labelledby="mobile-nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
            <h2 class="mobile-nav-heading" id="mobile-nav-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escHtml(group.label)}</h2>
            <div class="mobile-nav-grid">
                ${group.keys.map(key => {
            const item = itemMap[key];
            if (!item) return '';
            const isActive = key === activeKey;
            const badge = isAdminArea
                ? key === 'admin-tickets' ? '<span class="nav-badge" data-admin-badge="admin-tickets" hidden></span>' : ''
                : key === 'inbox' ? '<span class="mobile-nav-badge" data-inbox-badge hidden></span>'
                    : key === 'notifications' ? '<span class="mobile-nav-badge" data-notification-badge hidden></span>' : '';
            return `<a class="mobile-nav-card${isActive ? ' active' : ''}" href="../${item.base}/${item.href}"${isActive ? ' aria-current="page"' : ''}>
                <i class="bi ${item.icon}" aria-hidden="true"></i><span class="mobile-nav-card-label">${escHtml(item.label)}</span>${badge}
            </a>`;
        }).join('')}
            </div>
        </section>`).join('');
    const settings = (!isAdminArea && typeof DB !== 'undefined') ? DB.getSettings() : {};
    const name = isAdminArea ? ((admin && admin.full_name) || 'Administrator') : ((settings.name || '').trim() || 'Student');
    const initial = escHtml(name.charAt(0).toUpperCase() || (isAdminArea ? 'A' : 'S'));
    const accountLine = isAdminArea
        ? `<span>${escHtml(admin && admin.role ? admin.role.replace(/_/g, ' ') : 'Administrator')}</span>`
        : '<span id="mobileProfileEmail">Signed in on this device</span>';
    const logoutButton = isAdminArea
        ? '<button type="button" class="mobile-nav-logout js-admin-logout" id="admMobileMenuLogoutBtn" aria-label="Log out"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>'
        : '<button type="button" class="mobile-nav-logout" onclick="signOutAndRedirect(this);return false;" aria-label="Log out"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Log out</span></button>';
    const menu = document.createElement('div');
    menu.id = 'mobileAppNavMenu';
    menu.className = 'mobile-app-nav-menu';
    menu.hidden = true;
    menu.innerHTML = `
        <nav class="mobile-app-nav-scroll" aria-label="${isAdminArea ? 'Admin' : 'Student'} navigation">
            <div class="mobile-app-nav-groups">${groupsHtml}</div>
            <div class="mobile-nav-account">
                <span class="profile-avatar${isAdminArea ? ' js-admin-avatar js-profile-avatar' : ' js-profile-avatar'}" aria-hidden="true">${initial}</span>
                <span class="mobile-nav-account-copy">
                    <strong${isAdminArea ? ' class="js-admin-fullname"' : ' id="mobileProfileName"'}>${escHtml(name)}</strong>
                    ${accountLine}
                </span>
                ${logoutButton}
            </div>
        </nav>`;
    document.body.appendChild(menu);
}
let mobileAppMenuReturnFocus = null;
function openMobileAppNavMenu() {
    const menu = document.getElementById('mobileAppNavMenu');
    if (!menu) return;
    mobileAppMenuReturnFocus = document.activeElement;
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    document.body.classList.add('mobile-nav-open');
    syncSidebarToggleIcon(true);
    const firstLink = menu.querySelector('.mobile-nav-card.active, .mobile-nav-card');
    if (firstLink) firstLink.focus({ preventScroll: true });
}
function closeMobileAppNavMenu(restoreFocus = true) {
    const menu = document.getElementById('mobileAppNavMenu');
    if (!menu || menu.hidden) return;
    menu.classList.remove('is-open');
    menu.hidden = true;
    document.body.classList.remove('mobile-nav-open');
    syncSidebarToggleIcon(false);
    if (restoreFocus && mobileAppMenuReturnFocus && mobileAppMenuReturnFocus.isConnected)
        mobileAppMenuReturnFocus.focus({ preventScroll: true });
}
function closeMobileAppNavMenuForNavigation() {
    const menu = document.getElementById('mobileAppNavMenu');
    if (!menu || menu.hidden || !menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    document.body.classList.remove('mobile-nav-open');
    syncSidebarToggleIcon(false);
    window.setTimeout(() => {
        if (menu.classList.contains('is-open')) return;
        menu.hidden = true;
        const trigger = document.querySelector('.mobile-nav-trigger');
        if (trigger) trigger.focus({ preventScroll: true });
    }, 230);
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMobileAppNavMenu();
});
window.matchMedia('(min-width: 992px)').addEventListener('change', event => {
    if (event.matches) closeMobileAppNavMenu(false);
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
            const name = String(s.name || greetEl.dataset.userName || '').trim().split(/\s+/)[0].replace(/[.,;:!?]+$/, '');
            greetEl.textContent = name ? `${greetingText()}, ${name}!` : greetingText();
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

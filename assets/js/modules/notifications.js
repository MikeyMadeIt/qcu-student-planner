const NOTIFICATION_PAGE_SIZE = 20;
let notificationFilter = 'all';
let notificationSelection = null;
let notificationVisibleCount = NOTIFICATION_PAGE_SIZE;

function initNotifications() {
    document.querySelectorAll('.notification-filter').forEach(button => {
        button.addEventListener('click', () => {
            notificationFilter = button.dataset.filter;
            notificationVisibleCount = NOTIFICATION_PAGE_SIZE;
            document.querySelectorAll('.notification-filter').forEach(item => {
                const active = item === button;
                item.classList.toggle('is-active', active);
                item.setAttribute('aria-pressed', String(active));
            });
            renderNotifications();
        });
    });

    document.getElementById('notificationList').addEventListener('click', event => {
        const button = event.target.closest('[data-notification-id]');
        if (!button) return;
        notificationSelection = button.dataset.notificationId;
        try {
            setNotificationRead(notificationSelection);
            renderNotifications();
        } catch (error) {
            showNotificationError(error);
        }
    });

    document.getElementById('markAllReadBtn').addEventListener('click', () => {
        try {
            markAllNotificationsRead();
            renderNotifications();
        } catch (error) {
            showNotificationError(error);
        }
    });

    document.getElementById('notificationLoadMore').addEventListener('click', () => {
        notificationVisibleCount += NOTIFICATION_PAGE_SIZE;
        renderNotifications();
    });

    const requestedId = new URLSearchParams(location.search).get('item');
    if (requestedId) {
        notificationSelection = requestedId;
        try {
            if (getTaskNotifications().some(item => item.id === requestedId))
                setNotificationRead(requestedId);
        } catch (error) {
            showNotificationError(error);
            return;
        }
    }

    window.addEventListener('planner:tasks-changed', renderNotifications);
    window.addEventListener('planner:notifications-changed', renderNotifications);
    window.addEventListener('storage', event => {
        if (event.key === 'sp_notification_read' || event.key === 'sp_tasks')
            renderNotifications();
    });
    renderNotifications();
}

function renderNotifications() {
    const status = document.getElementById('notificationStatus');
    const layout = document.getElementById('notificationLayout');
    try {
        const notifications = getTaskNotifications();
        const readMap = getNotificationReadMap();
        const filtered = notifications.filter(item => {
            const read = Boolean(readMap[item.id]);
            return notificationFilter === 'all' ||
                (notificationFilter === 'read' && read) ||
                (notificationFilter === 'unread' && !read);
        });
        const shown = filtered.slice(0, notificationVisibleCount);
        status.hidden = true;
        layout.hidden = false;
        document.getElementById('notificationList').innerHTML = shown.map(item => {
            const read = Boolean(readMap[item.id]);
            const label = item.overdue ? 'Overdue' : 'Due soon';
            return `<button type="button" class="notification-row ${read ? 'is-read' : 'is-unread'} ${item.id === notificationSelection ? 'is-selected' : ''}"
                    data-notification-id="${escHtml(item.id)}" aria-pressed="${item.id === notificationSelection}" role="listitem">
                <span class="notification-row-icon ${item.overdue ? 'is-overdue' : ''}" aria-hidden="true"><i class="bi bi-journal-check"></i></span>
                <span class="notification-row-copy">
                    <span class="notification-row-top"><strong>${escHtml(item.title)}</strong><span class="notification-unread-dot" aria-hidden="true"></span></span>
                    <span class="notification-row-meta">${escHtml(item.category)} · ${label} · ${escHtml(item.due.toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span>
                </span>
            </button>`;
        }).join('');

        const empty = document.getElementById('notificationListEmpty');
        empty.hidden = filtered.length !== 0;
        document.getElementById('notificationEmptyText').textContent = notifications.length === 0
            ? 'Task reminders appear here when an active task is due within the next three days.'
            : 'No notifications match this filter.';
        const loadMore = document.getElementById('notificationLoadMore');
        loadMore.hidden = filtered.length <= shown.length;
        document.getElementById('markAllReadBtn').disabled = notifications.every(item => readMap[item.id]);
        renderNotificationDetail(notifications.find(item => item.id === notificationSelection), readMap);
    } catch (error) {
        showNotificationError(error);
    }
}

function renderNotificationDetail(item, readMap) {
    const detail = document.getElementById('notificationDetail');
    if (!item) {
        detail.innerHTML = `<div class="notification-detail-empty">
            <i class="bi bi-bell" aria-hidden="true"></i>
            <strong>Select a notification</strong>
            <span>Details for the selected reminder will appear here.</span>
        </div>`;
        return;
    }
    const read = Boolean(readMap[item.id]);
    detail.innerHTML = `<div class="notification-detail-content">
        <span class="notification-category"><i class="bi bi-journal-check" aria-hidden="true"></i>${escHtml(item.category)}</span>
        <h2>${escHtml(item.title)}</h2>
        <p class="notification-detail-date"><i class="bi bi-calendar-event" aria-hidden="true"></i>
            ${item.overdue ? 'Overdue' : 'Due'} ${escHtml(item.due.toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</p>
        ${item.description ? `<p class="notification-description">${escHtml(item.description)}</p>` : ''}
        <div class="notification-detail-actions">
            ${read ? '<span class="notification-read-label"><i class="bi bi-check2-circle" aria-hidden="true"></i> Read</span>' :
                '<button type="button" class="btn btn-ghost" id="markSelectedReadBtn"><i class="bi bi-check2" aria-hidden="true"></i> Mark as read</button>'}
            <a class="btn btn-accent" href="../app/tasks.html"><i class="bi bi-arrow-up-right" aria-hidden="true"></i> View tasks</a>
        </div>
    </div>`;
    const markRead = document.getElementById('markSelectedReadBtn');
    if (markRead) markRead.addEventListener('click', () => {
        try {
            setNotificationRead(item.id);
            renderNotifications();
        } catch (error) {
            showNotificationError(error);
        }
    });
}

function showNotificationError(error) {
    console.error('Unable to render notifications.', error);
    const status = document.getElementById('notificationStatus');
    status.hidden = false;
    status.innerHTML = `Notifications could not be loaded. <button type="button" class="notification-retry" onclick="renderNotifications()">Try again</button>`;
    document.getElementById('notificationLayout').hidden = true;
}

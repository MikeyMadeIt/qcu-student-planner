import { StudentService } from '../services/student-service.js';
import { MESSAGE_CATEGORY_LABELS, MESSAGE_CATEGORY_ICONS, messageCategoryBadge } from './comms-shared.js';

const PAGE_SIZE = 10; // 2 columns × 5 rows on desktop

let allRows = [];
let activeFilter = 'all';
let currentPage = 1;

function escHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDateTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}

function formatTime(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
        return '—';
    }
}

function renderSignInPrompt() {
    const list = document.getElementById('inboxList');
    const state = document.getElementById('inboxListState');
    list.hidden = true;
    state.hidden = false;
    state.innerHTML = `<i class="bi bi-box-arrow-in-right" aria-hidden="true"></i><strong>Sign in to view your inbox</strong><span>You need to be signed in to see messages from your administrators.</span><a class="btn btn-accent btn-sm mt-2" href="../auth/login.html">Sign in</a>`;
}

function applyFilterAndSearch() {
    const term = document.getElementById('inboxSearch').value.trim().toLowerCase();
    let rows = allRows;
    if (activeFilter === 'unread') rows = rows.filter(r => !r.read_at);
    if (term) {
        rows = rows.filter(r =>
            r.message.subject.toLowerCase().includes(term) || r.message.body.toLowerCase().includes(term));
    }
    return rows;
}

function renderList() {
    const list = document.getElementById('inboxList');
    const state = document.getElementById('inboxListState');
    const pagination = document.getElementById('inboxPagination');
    const rows = applyFilterAndSearch();

    if (!rows.length) {
        list.hidden = true;
        pagination.hidden = true;
        state.hidden = false;
        const hasSearch = Boolean(document.getElementById('inboxSearch').value.trim());
        state.innerHTML = `<i class="bi bi-chat-square-text" aria-hidden="true"></i><strong>${hasSearch ? 'No matching messages' : (activeFilter === 'unread' ? 'No unread messages' : 'No messages')}</strong><span>${hasSearch ? 'There are no messages to match this search.' : 'When an administrator sends you a message, it will appear here.'}</span>`;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    state.hidden = true;
    list.hidden = false;
    list.innerHTML = pageRows.map(r => {
        const m = r.message;
        const isUnread = !r.read_at;
        const icon = MESSAGE_CATEGORY_ICONS[m.category] || 'bi-chat-square-text-fill';
        return `
        <button type="button" class="msg-row ${isUnread ? 'is-unread' : ''}" data-id="${m.id}">
            <span class="msg-row-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
            <span class="msg-row-body">
                <span class="msg-pill">${messageCategoryBadge(escHtml, m.category)}</span>
                <span class="msg-subject">${escHtml(m.subject)}</span>
                <span class="msg-preview">${escHtml(m.body || '')}</span>
            </span>
            <span class="msg-row-side">
                <span class="msg-time">${formatTime(m.sent_at)}</span>
            </span>
        </button>`;
    }).join('');

    list.querySelectorAll('.msg-row').forEach(btn => {
        btn.addEventListener('click', () => openMessage(btn.dataset.id));
    });

    pagination.hidden = totalPages <= 1;
    pagination.innerHTML = `
        <button class="btn btn-ghost btn-sm" id="inboxPagePrev" ${currentPage <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i> Prev</button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-ghost btn-sm" id="inboxPageNext" ${currentPage >= totalPages ? 'disabled' : ''}>Next <i class="bi bi-chevron-right"></i></button>`;

    const prevBtn = document.getElementById('inboxPagePrev');
    const nextBtn = document.getElementById('inboxPageNext');
    if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; renderList(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; renderList(); });
}

async function openMessage(messageId) {
    const row = allRows.find(r => r.message.id === messageId);
    if (!row) return;

    const m = row.message;
    const wasUnread = !row.read_at;

    document.getElementById('msgDetailTitle').textContent = m.subject;
    const bodyEl = document.getElementById('msgDetailBody');
    bodyEl.innerHTML = `
        <div class="msg-detail-meta">
            ${messageCategoryBadge(escHtml, m.category)}
            <span>From ${escHtml(m.sender && m.sender.full_name ? m.sender.full_name : 'Administrator')}</span>
            <span>&middot; ${formatDateTime(m.sent_at)}</span>
        </div>
        <div class="msg-detail-body">${escHtml(m.body)}</div>
        <div class="msg-detail-footer">
            <button type="button" class="btn btn-ghost btn-sm" id="toggleReadBtn">
                <i class="bi ${wasUnread ? 'bi-envelope-open' : 'bi-envelope'}"></i> Mark as ${wasUnread ? 'read' : 'unread'}
            </button>
            <p class="text-faint" style="font-size:.76rem;margin:0">This is a one-way message. You cannot reply from this inbox.</p>
        </div>`;

    const modal = new bootstrap.Modal(document.getElementById('messageDetailModal'));
    modal.show();

    document.getElementById('toggleReadBtn').addEventListener('click', () => toggleRead(messageId));

    if (wasUnread) {
        const result = await StudentService.setMessageRead(messageId, true);
        if (result.ok) {
            row.read_at = new Date().toISOString();
            renderList();
            const btn = document.getElementById('toggleReadBtn');
            if (btn) btn.innerHTML = `<i class="bi bi-envelope"></i> Mark as unread`;
        }
    }
}

async function toggleRead(messageId) {
    const row = allRows.find(r => r.message.id === messageId);
    if (!row) return;
    const makeUnread = Boolean(row.read_at);
    const result = await StudentService.setMessageRead(messageId, !makeUnread);
    if (!result.ok) {
        Toast.show(result.message, 'danger', 'bi-exclamation-triangle-fill');
        return;
    }
    row.read_at = makeUnread ? null : new Date().toISOString();
    renderList();
    const btn = document.getElementById('toggleReadBtn');
    if (btn) btn.innerHTML = `<i class="bi ${row.read_at ? 'bi-envelope-open' : 'bi-envelope'}"></i> Mark as ${row.read_at ? 'unread' : 'read'}`;
    Toast.show(row.read_at ? 'Marked as read.' : 'Marked as unread.', 'accent', 'bi-check-circle-fill');
}

async function loadInbox() {
    const loading = document.getElementById('inboxLoading');
    const list = document.getElementById('inboxList');
    const state = document.getElementById('inboxListState');

    loading.hidden = false;
    list.hidden = true;
    state.hidden = true;

    const result = await StudentService.listInboxMessages({ pageSize: 100 });

    loading.hidden = true;

    if (!result.ok) {
        if (result.message === 'Not signed in.') {
            renderSignInPrompt();
            return;
        }
        state.hidden = false;
        state.innerHTML = `<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><strong>Could not load your inbox</strong><span>${escHtml(result.message)}</span>`;
        return;
    }

    allRows = result.data.rows;
    renderList();
}

function wireFilters() {
    let timer = null;
    document.getElementById('inboxSearch').addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { currentPage = 1; renderList(); }, 200);
    });
    document.getElementById('inboxFilterAll').addEventListener('click', () => setFilter('all'));
    document.getElementById('inboxFilterUnread').addEventListener('click', () => setFilter('unread'));
}

function setFilter(filter) {
    activeFilter = filter;
    currentPage = 1;
    document.getElementById('inboxFilterAll').classList.toggle('active', filter === 'all');
    document.getElementById('inboxFilterUnread').classList.toggle('active', filter === 'unread');
    renderList();
}

wireFilters();
loadInbox();

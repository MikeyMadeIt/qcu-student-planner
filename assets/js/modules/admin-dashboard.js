import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDateTime, statusBadge, mountAdminTopbar, renderErrorWithRetry, ACTION_LABELS } from './admin-shared.js';
import { MESSAGE_CATEGORY_LABELS, ticketStatusBadge } from './comms-shared.js';

const ACTIVITY_PREVIEW_SIZE = 6;
let isLoading = false;

let distChartInstance = null;
let trendChartInstance = null;
let programChartInstance = null;
let campusChartInstance = null;

const CAMPUS_COLORS = ['#38bdf8', '#a78bfa', '#fb923c', '#f472b6', '#2dd4bf'];

function readCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function renderCharts(counts, all) {
    const textSoft = readCssVar('--text-soft', '#94a3b8');
    const gridColor = readCssVar('--border', 'rgba(148,163,184,.2)');
    const statusColors = { pending: '#b45309', approved: '#34d399', rejected: '#fb7185', suspended: '#94a3b8' };
    const segments = ['pending', 'approved', 'rejected', 'suspended'];

    const distLegend = document.getElementById('distLegend');
    const distCanvas = document.getElementById('distChart');

    if (distChartInstance) distChartInstance.destroy();

    if (counts.total === 0) {
        distLegend.innerHTML = '<span class="text-faint">No accounts yet.</span>';
    } else {
        distLegend.innerHTML = segments.map(s => {
            const pct = Math.round((counts[s] / counts.total) * 100);
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            return `<span><span class="dot ${s}"></span><span class="label">${label}</span><span class="pct">${pct}%</span><span class="count">(${counts[s]})</span></span>`;
        }).join('');

        distChartInstance = new Chart(distCanvas, {
            type: 'doughnut',
            data: {
                labels: segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
                datasets: [{
                    data: segments.map(s => counts[s]),
                    backgroundColor: segments.map(s => statusColors[s]),
                    borderWidth: 0,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                cutout: '65%',
                maintainAspectRatio: false,
            },
        });
    }

    /* Registrations per day, last 14 days — derived from each account's created_at. */
    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        days.push(d);
    }
    const dayKey = d => d.toISOString().slice(0, 10);
    const buckets = Object.fromEntries(days.map(d => [dayKey(d), 0]));
    all.forEach(row => {
        if (!row.created_at) return;
        const key = new Date(row.created_at).toISOString().slice(0, 10);
        if (key in buckets) buckets[key] += 1;
    });

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(document.getElementById('trendChart'), {
        type: 'bar',
        data: {
            labels: days.map(d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Registrations',
                data: days.map(d => buckets[dayKey(d)]),
                backgroundColor: 'rgb(var(--accent))',
                borderRadius: 4,
                maxBarThickness: 22,
            }],
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textSoft, font: { size: 10 } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: textSoft, precision: 0 }, grid: { color: gridColor } },
            },
        },
    });
}

/* Counts accounts per program/campus, excluding admin rows and blank values, and renders
   a horizontal bar (program) + doughnut (campus). Both read straight from the already-fetched
   `all` rows — no extra round trip to the database. */
function renderBreakdownCharts(all) {
    const students = all.filter(row => row.role !== 'admin');

    const tally = (rows, field) => {
        const counts = new Map();
        rows.forEach(row => {
            const key = (row[field] || '').trim() || 'Not specified';
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return counts;
    };

    /* ---- Program breakdown (top 8, horizontal bar) ---- */
    const programCounts = tally(students, 'course');
    const programEntries = [...programCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const programWrap = document.getElementById('programChartWrap');
    const programEmpty = document.getElementById('programChartEmpty');

    if (programChartInstance) programChartInstance.destroy();

    if (!students.length) {
        programWrap.hidden = true;
        programEmpty.hidden = false;
    } else {
        programWrap.hidden = false;
        programEmpty.hidden = true;

        const textSoft = readCssVar('--text-soft', '#94a3b8');
        const gridColor = readCssVar('--border', 'rgba(148,163,184,.2)');

        programChartInstance = new Chart(document.getElementById('programChart'), {
            type: 'bar',
            data: {
                labels: programEntries.map(([label]) => label),
                datasets: [{
                    data: programEntries.map(([, count]) => count),
                    backgroundColor: 'rgb(var(--accent))',
                    borderRadius: 4,
                    maxBarThickness: 18,
                }],
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: { color: textSoft, precision: 0 }, grid: { color: gridColor } },
                    y: { ticks: { color: textSoft, font: { size: 10 } }, grid: { display: false } },
                },
            },
        });
    }

    /* ---- Campus breakdown (doughnut) ---- */
    const campusCounts = tally(students, 'school');
    const campusEntries = [...campusCounts.entries()].sort((a, b) => b[1] - a[1]);
    const campusLegend = document.getElementById('campusLegend');

    if (campusChartInstance) campusChartInstance.destroy();

    if (!campusEntries.length) {
        campusLegend.innerHTML = '<span class="text-faint">No campus data yet.</span>';
    } else {
        campusLegend.innerHTML = campusEntries.map(([label, count], i) =>
            `<span><span class="dot" style="background:${CAMPUS_COLORS[i % CAMPUS_COLORS.length]}"></span>${escHtml(label)} &middot; ${count}</span>`
        ).join('');

        campusChartInstance = new Chart(document.getElementById('campusChart'), {
            type: 'doughnut',
            data: {
                labels: campusEntries.map(([label]) => label),
                datasets: [{
                    data: campusEntries.map(([, count]) => count),
                    backgroundColor: campusEntries.map((_, i) => CAMPUS_COLORS[i % CAMPUS_COLORS.length]),
                    borderWidth: 0,
                }],
            },
            options: {
                plugins: { legend: { display: false } },
                cutout: '65%',
                maintainAspectRatio: false,
            },
        });
    }
}

/* Renders the Recent Admin Activity widget from a listAuditLog() result. Kept separate
   from the main stats load so a failure here (e.g. a permissions issue on that one table)
   doesn't take down the rest of an otherwise-working dashboard. */
async function loadRecentActivity() {
    const loading = document.getElementById('activityLoading');
    const list = document.getElementById('activityList');
    const empty = document.getElementById('activityEmpty');
    const errorBox = document.getElementById('activityError');
    const table = list.closest('.adm-table-wrap');

    loading.hidden = false;
    errorBox.hidden = true;
    table.hidden = true;
    empty.hidden = true;

    const result = await AdminService.listAuditLog({ page: 1, pageSize: ACTIVITY_PREVIEW_SIZE });

    loading.hidden = true;

    if (!result.ok) {
        errorBox.hidden = false;
        renderErrorWithRetry(errorBox, result.message, loadRecentActivity);
        return;
    }

    const { rows } = result.data;

    if (!rows.length) {
        empty.hidden = false;
        return;
    }

    table.hidden = false;
    list.innerHTML = rows.map(r => `
        <tr>
            <td data-label="When">${formatDateTime(r.created_at)}</td>
            <td data-label="Admin">${escHtml(r.actor && r.actor.full_name ? r.actor.full_name : 'Administrator')}</td>
            <td data-label="Action">${escHtml(ACTION_LABELS[r.action] || r.action)}</td>
            <td data-label="Account">${escHtml(r.target && r.target.full_name ? r.target.full_name : '—')}</td>
        </tr>`).join('');
}

/* Messaging + support ticket stats (Phase 5). Kept separate from the main
   getDashboardStats() load, same reasoning as loadRecentActivity() above: a
   problem here (e.g. the Phase 5 migration not yet applied) degrades only
   these two cards/widgets instead of the whole dashboard. Message-count and
   recipient-count are always shown as distinct numbers -- one message sent to
   50 students is one row in "Recent administrative messages", never 50. */
async function loadCommsStats() {
    const unreadEl = document.getElementById('statUnreadMsgs');
    const openEl = document.getElementById('statOpenTickets');
    const msgsTotalLine = document.getElementById('msgsTotalLine');
    const ticketsTotalLine = document.getElementById('ticketsTotalLine');
    const msgsList = document.getElementById('recentMsgsList');
    const msgsEmpty = document.getElementById('recentMsgsEmpty');
    const ticketsList = document.getElementById('recentTicketsList');
    const ticketsEmpty = document.getElementById('recentTicketsEmpty');

    const result = await AdminService.getCommsStats();

    if (!result.ok) {
        unreadEl.textContent = '—';
        openEl.textContent = '—';
        msgsTotalLine.textContent = result.message;
        ticketsTotalLine.textContent = result.message;
        msgsList.closest('.adm-table-wrap').hidden = true;
        ticketsList.closest('.adm-table-wrap').hidden = true;
        msgsEmpty.hidden = false;
        msgsEmpty.textContent = 'Messaging statistics could not be loaded.';
        ticketsEmpty.hidden = false;
        ticketsEmpty.textContent = 'Ticket statistics could not be loaded.';
        return;
    }

    const { messagesTotal, unreadTotal, ticketsTotal, ticketsOpen, recentMessages, recentTickets } = result.data;

    unreadEl.textContent = unreadTotal;
    openEl.textContent = ticketsOpen;
    msgsTotalLine.textContent = `${messagesTotal} message${messagesTotal === 1 ? '' : 's'} sent in total`;
    ticketsTotalLine.textContent = `${ticketsTotal} report${ticketsTotal === 1 ? '' : 's'} submitted in total`;

    const msgsTable = msgsList.closest('.adm-table-wrap');
    if (!recentMessages.length) {
        msgsTable.hidden = true;
        msgsEmpty.hidden = false;
        msgsEmpty.textContent = 'No messages have been sent yet.';
    } else {
        msgsTable.hidden = false;
        msgsEmpty.hidden = true;
        msgsList.innerHTML = recentMessages.map(m => `
            <tr>
                <td data-label="Subject">${escHtml(m.subject)}</td>
                <td data-label="Category">${escHtml(MESSAGE_CATEGORY_LABELS[m.category] || m.category)}</td>
                <td data-label="Recipients">${m.recipient_count}</td>
                <td data-label="Sent">${formatDateTime(m.sent_at)}</td>
            </tr>`).join('');
    }

    const ticketsTable = ticketsList.closest('.adm-table-wrap');
    if (!recentTickets.length) {
        ticketsTable.hidden = true;
        ticketsEmpty.hidden = false;
        ticketsEmpty.textContent = 'No reports have been submitted yet.';
    } else {
        ticketsTable.hidden = false;
        ticketsEmpty.hidden = true;
        ticketsList.innerHTML = recentTickets.map(t => `
            <tr>
                <td data-label="Ticket"><span class="text-faint" style="font-family:var(--font-mono);font-size:.76rem">${escHtml(t.ticket_ref)}</span></td>
                <td data-label="Student">${escHtml(t.student && t.student.full_name ? t.student.full_name : 'Unnamed account')}</td>
                <td data-label="Subject">${escHtml(t.subject)}</td>
                <td data-label="Status">${ticketStatusBadge(escHtml, t.status)}</td>
            </tr>`).join('');
    }
}

async function loadDashboard() {
    if (isLoading) return;
    isLoading = true;

    const refreshBtn = document.getElementById('admRefreshBtn');
    const refreshIcon = document.getElementById('admRefreshIcon');
    const loading = document.getElementById('admDashLoading');
    const content = document.getElementById('admDashContent');
    const errorBox = document.getElementById('admDashError');

    refreshBtn.disabled = true;
    refreshIcon.classList.add('adm-spin');
    errorBox.hidden = true;
    if (content.hidden) loading.hidden = false;

    const result = await AdminService.getDashboardStats();

    loading.hidden = true;
    refreshBtn.disabled = false;
    refreshIcon.classList.remove('adm-spin');
    isLoading = false;

    if (!result.ok) {
        content.hidden = true;
        errorBox.hidden = false;
        renderErrorWithRetry(errorBox, result.message, loadDashboard);
        return;
    }

    content.hidden = false;
    const { counts, recent, all } = result.data;

    document.getElementById('statTotal').textContent = counts.total;
    document.getElementById('statPending').textContent = counts.pending;
    document.getElementById('statApproved').textContent = counts.approved;
    document.getElementById('statRejected').textContent = counts.rejected;
    document.getElementById('statSuspended').textContent = counts.suspended;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newThisWeek = all.filter(r => r.created_at && new Date(r.created_at).getTime() >= sevenDaysAgo).length;
    document.getElementById('statNew7').textContent = newThisWeek;

    renderCharts(counts, all);
    renderBreakdownCharts(all);

    const recentList = document.getElementById('recentList');
    const recentEmpty = document.getElementById('recentEmpty');
    const recentTable = recentList.closest('.adm-table-wrap');

    if (!recent.length) {
        recentTable.hidden = true;
        recentEmpty.hidden = false;
    } else {
        recentTable.hidden = false;
        recentEmpty.hidden = true;
        recentList.innerHTML = recent.map(r => {
            const reviewHref = r.account_status === 'pending'
                ? `verification.html?status=pending&q=${encodeURIComponent(r.full_name || '')}`
                : `users.html?q=${encodeURIComponent(r.full_name || '')}`;
            return `
            <tr>
                <td data-label="Student">${escHtml(r.full_name || 'Unnamed account')}</td>
                <td data-label="Program">${escHtml(r.course || '—')}${r.year_level ? ' · ' + escHtml(r.year_level) : ''}</td>
                <td data-label="Campus">${escHtml(r.school || '—')}</td>
                <td data-label="Submitted">${formatDateTime(r.created_at)}</td>
                <td data-label="Status">${statusBadge(r.account_status)}</td>
                <td class="text-end adm-actions"><a class="btn btn-ghost btn-sm" href="${reviewHref}"><i class="bi bi-arrow-right"></i> ${r.account_status === 'pending' ? 'Review' : 'View'}</a></td>
            </tr>`;
        }).join('');
    }

    loadRecentActivity();
    loadCommsStats();
}

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-dashboard', admin);
    mountAdminTopbar(admin);

    document.getElementById('admRefreshBtn').addEventListener('click', loadDashboard);

    loadDashboard();
}

init();

import { requireAdmin } from './admin-guard.js';
import { AdminService } from '../services/admin-service.js';
import { escHtml, formatDateTime, statusBadge, mountAdminTopbar, renderError } from './admin-shared.js';

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
    const statusColors = { pending: '#fbbf24', approved: '#34d399', rejected: '#fb7185', suspended: '#94a3b8' };
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

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    renderShell('admin-dashboard');
    mountAdminTopbar(admin);

    const loading = document.getElementById('admDashLoading');
    const content = document.getElementById('admDashContent');
    const errorBox = document.getElementById('admDashError');

    const result = await AdminService.getDashboardStats();

    loading.hidden = true;

    if (!result.ok) {
        errorBox.hidden = false;
        renderError(errorBox, result.message);
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
}

init();

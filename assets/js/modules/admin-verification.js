/* Admin verification page. Uses SAMPLE rows for layout preview only; real records will come from a repository. */
const SAMPLE_REGISTRATIONS = [
    { id: 's1', name: 'Sample Student One', email: 'sample.one@example.invalid', studentNo: '00-0001', program: 'Sample Program A', year: '1st', submitted: '2026-10-20', status: 'pending' },
    { id: 's2', name: 'Sample Student Two', email: 'sample.two@example.invalid', studentNo: '00-0002', program: 'Sample Program B', year: '2nd', submitted: '2026-10-21', status: 'pending' },
    { id: 's3', name: 'Sample Student Three', email: 'sample.three@example.invalid', studentNo: '00-0003', program: 'Sample Program A', year: '3rd', submitted: '2026-10-22', status: 'approved' },
    { id: 's4', name: 'Sample Student Four', email: 'sample.four@example.invalid', studentNo: '00-0004', program: 'Sample Program C', year: '1st', submitted: '2026-10-23', status: 'rejected' },
];
let admRows = SAMPLE_REGISTRATIONS.map(r => ({ ...r }));

function initVerification() {
    const programs = [...new Set(admRows.map(r => r.program))];
    document.getElementById('admProgram').insertAdjacentHTML('beforeend', programs.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join(''));
    ['admSearch', 'admStatus', 'admProgram'].forEach(id => document.getElementById(id).addEventListener('input', renderVerification));
    document.getElementById('admBody').addEventListener('click', onVerificationAction);
    renderVerification();
}

function renderVerification() {
    const q = document.getElementById('admSearch').value.trim().toLowerCase();
    const st = document.getElementById('admStatus').value;
    const pr = document.getElementById('admProgram').value;
    const rows = admRows.filter(r => (st === 'all' || r.status === st) && (pr === 'all' || r.program === pr) &&
        (!q || [r.name, r.email, r.studentNo].some(v => v.toLowerCase().includes(q))));
    document.getElementById('admBody').innerHTML = rows.map(r => `
    <tr>
      <td data-label="Student"><div class="adm-name">${escHtml(r.name)} <span class="sample-tag">Sample</span></div><div class="adm-sub">${escHtml(r.email)}</div></td>
      <td data-label="Student no." class="mono">${escHtml(r.studentNo)}</td>
      <td data-label="Program">${escHtml(r.program)} · ${escHtml(r.year)} year</td>
      <td data-label="Submitted">${escHtml(r.submitted)}</td>
      <td data-label="Status"><span class="status-badge ${r.status}">${r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span></td>
      <td class="text-end adm-actions">${r.status === 'pending' ? `
        <button class="btn btn-ghost btn-sm" data-act="reject" data-id="${r.id}"><i class="bi bi-x-lg"></i> Reject</button>
        <button class="btn btn-accent btn-sm" data-act="approve" data-id="${r.id}"><i class="bi bi-check-lg"></i> Approve</button>` : '<span class="text-faint">—</span>'}</td>
    </tr>`).join('');
    document.getElementById('admEmpty').hidden = rows.length > 0;
    document.getElementById('admCount').textContent = `${rows.length} of ${admRows.length}`;
}

function onVerificationAction(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn)
        return;
    const row = admRows.find(r => r.id === btn.dataset.id);
    const approve = btn.dataset.act === 'approve';
    confirmAction({
        title: approve ? 'Approve this account?' : 'Reject this account?',
        message: `${row.name} (sample record). This only updates the preview on this page; nothing is sent to a server.`,
        confirmLabel: approve ? 'Approve' : 'Reject',
        danger: !approve,
        icon: approve ? 'bi-check-circle-fill' : 'bi-x-circle-fill',
        onConfirm() {
            row.status = approve ? 'approved' : 'rejected';
            renderVerification();
            Toast.show(`Marked ${approve ? 'approved' : 'rejected'} in this preview only`);
        },
    });
}

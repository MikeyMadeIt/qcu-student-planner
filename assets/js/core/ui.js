/* ---------- TOASTS ---------- */
const Toast = {
    container() {
        let c = document.getElementById('toastStack');
        if (!c) {
            c = document.createElement('div');
            c.id = 'toastStack';
            c.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            c.setAttribute('aria-live', 'polite');
            c.setAttribute('aria-atomic', 'false');
            document.body.appendChild(c);
        }
        return c;
    },
    show(msg, type = 'accent', icon = 'bi-check-circle-fill') {
        const c = this.container();
        const el = document.createElement('div');
        const kind = { high: 'danger', error: 'danger', danger: 'danger', medium: 'warning', warning: 'warning', info: 'info' }[type] || 'success';
        el.className = `app-toast app-toast-${kind} fade-in`;
        el.setAttribute('role', kind === 'danger' ? 'alert' : 'status');
        el.innerHTML = `<i class="bi ${icon} toast-item-icon" aria-hidden="true"></i><span class="toast-item-msg">${escHtml(msg)}</span>`;
        c.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 300); }, 2600);
    },
    confirmExport() { window.exportData ? window.exportData() : this.show('Open Settings to export data', 'accent', 'bi-download'); }
};

/* ---------- CONFETTI ---------- */

function fireConfetti() {
    const colors = ['#7C6CF6', '#4F8CFF', '#34D399', '#FB7185', '#B45309'];
    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'confetti-piece';
        p.setAttribute('aria-hidden', 'true');
        p.style.left = Math.random() * 100 + 'vw';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(p);
        const duration = 1800 + Math.random() * 1200;
        p.animate([
            { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
            { transform: `translateY(${window.innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0.9 }
        ], { duration, easing: 'cubic-bezier(.22,.8,.4,1)' });
        setTimeout(() => p.remove(), duration);
    }
}

/* ---------- CONFIRM ACTION MODAL ---------- */

function ensureConfirmModal() {
    if (document.getElementById('confirmActionModal'))
        return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="modal fade" id="confirmActionModal" tabindex="-1" aria-modal="true" role="alertdialog" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad text-center">
        <div class="confirm-icon-wrap" id="confirmIconWrap">
          <i id="confirmIcon" class="confirm-icon" aria-hidden="true"></i>
        </div>
        <h5 id="confirmTitle" class="mb-1">Are you sure?</h5>
        <p class="text-soft mb-0 confirm-message" id="confirmMessage"></p>
        <div class="confirm-reason-wrap text-start mt-3" id="confirmReasonWrap" hidden>
          <label class="adm-label" id="confirmReasonLabel" for="confirmReasonInput">Reason</label>
          <textarea class="form-control" id="confirmReasonInput" rows="2" maxlength="300"></textarea>
          <p class="auth-error" id="confirmReasonError" hidden></p>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-ghost flex-grow-1" data-bs-dismiss="modal">Cancel</button>
          <button class="btn flex-grow-1 confirm-action-btn" id="confirmActionBtn">Confirm</button>
        </div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(wrap.firstElementChild);
    // Close on Escape
    document.getElementById('confirmActionModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const inst = bootstrap.Modal.getInstance(document.getElementById('confirmActionModal'));
            if (inst)
                inst.hide();
        }
    });
}

/* opts.reasonField, when present ({ label, placeholder, required }), shows a textarea inline
   in the popup instead of falling back to a native window.prompt() after the fact. onConfirm
   is then called with the trimmed reason string (or '' if left blank and not required). */
function confirmAction(opts) {
    const { title = 'Are you sure?', message = 'This action cannot be undone.', confirmLabel = 'Delete', danger = true, icon, reasonField = null, hideCloseButton = false, onConfirm } = opts;
    ensureConfirmModal();
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const iconWrap = document.getElementById('confirmIconWrap');
    const iconEl = document.getElementById('confirmIcon');
    iconWrap.style.background = danger ? 'rgba(251,113,133,.15)' : 'rgba(var(--accent),.15)';
    iconEl.style.color = danger ? '#fb7185' : 'rgb(var(--accent))';
    iconEl.className = 'bi ' + (icon || (danger ? 'bi-exclamation-triangle-fill' : 'bi-question-circle-fill'));

    const reasonWrap = document.getElementById('confirmReasonWrap');
    const reasonLabel = document.getElementById('confirmReasonLabel');
    const reasonInput = document.getElementById('confirmReasonInput');
    const reasonError = document.getElementById('confirmReasonError');
    reasonWrap.hidden = !reasonField;
    reasonError.hidden = true;
    reasonInput.value = '';
    if (reasonField) {
        reasonLabel.textContent = reasonField.label || 'Reason';
        reasonInput.placeholder = reasonField.placeholder || '';
        reasonInput.setAttribute('aria-describedby', 'confirmReasonError');
    }

    const btn = document.getElementById('confirmActionBtn');
    btn.textContent = confirmLabel;
    btn.style.background = danger ? '#fb7185' : 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))';
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);
    freshBtn.addEventListener('click', () => {
        const reasonValue = reasonInput.value.trim();
        if (reasonField && reasonField.required && !reasonValue) {
            reasonError.textContent = reasonField.requiredMessage || 'A reason is required.';
            reasonError.hidden = false;
            reasonInput.focus();
            return;
        }
        bootstrap.Modal.getInstance(document.getElementById('confirmActionModal')).hide();
        if (onConfirm)
            onConfirm(reasonValue);
    });
    const modalElement = document.getElementById('confirmActionModal');
    modalElement.dataset.hideCloseButton = hideCloseButton ? 'true' : 'false';
    const modal = new bootstrap.Modal(modalElement);
    modalElement.addEventListener('shown.bs.modal', () => {
        if (reasonField) reasonInput.focus();
    }, { once: true });
    modal.show();
}

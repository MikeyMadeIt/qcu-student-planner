// TOASTS
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
        const isUrgent = kind === 'danger' || kind === 'warning';
        el.addEventListener('click', () => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 300); });
        if (isUrgent) el.style.cursor = 'pointer';
        setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; setTimeout(() => el.remove(), 300); }, isUrgent ? 12000 : 2600);
    },
    confirmExport() { window.exportData ? window.exportData() : this.show('Open Settings to export data', 'accent', 'bi-download'); }
};

// CONFETTI

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

// CONFIRM ACTION MODAL

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
    document.getElementById('confirmActionModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const inst = bootstrap.Modal.getInstance(document.getElementById('confirmActionModal'));
            if (inst)
                inst.hide();
        }
    });
}

// opts.reasonField, when present ({ label, placeholder, required }), shows a textarea inline
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
    let confirmed = false;
    freshBtn.addEventListener('click', () => {
        const reasonValue = reasonInput.value.trim();
        if (reasonField && reasonField.required && !reasonValue) {
            reasonError.textContent = reasonField.requiredMessage || 'A reason is required.';
            reasonError.hidden = false;
            reasonInput.focus();
            return;
        }
        // Guard against a rapid double-click firing this listener twice
        // before the modal's hide animation actually removes the button
        // from view — without this, onConfirm (often an async DB/network
        // call) could run twice for a single intended action.
        if (confirmed) return;
        confirmed = true;
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

// PROMPT (TEXT INPUT) MODAL — replaces window.prompt()

function ensurePromptModal() {
    if (document.getElementById('promptActionModal'))
        return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="modal fade" id="promptActionModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="promptActionTitle">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad">
        <h5 id="promptActionTitle" class="mb-1">Enter value</h5>
        <p class="text-soft mb-2 confirm-message" id="promptActionMessage" hidden></p>
        <div class="text-start mt-2">
          <label class="form-label" id="promptActionLabel" for="promptActionInput" hidden></label>
          <input type="text" class="form-control" id="promptActionInput" maxlength="500" autocomplete="off">
          <p class="auth-error" id="promptActionError" hidden></p>
        </div>
        <div class="d-flex gap-2 mt-3">
          <button type="button" class="btn btn-ghost flex-grow-1" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn flex-grow-1 confirm-action-btn" id="promptActionBtn">OK</button>
        </div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('promptActionModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const inst = bootstrap.Modal.getInstance(document.getElementById('promptActionModal'));
            if (inst)
                inst.hide();
        }
    });
}

// opts: { title, message, label, placeholder, value, confirmLabel, cancelLabel, validate(value) -> errorString|null, onConfirm(value), onCancel }
function promptAction(opts) {
    const { title = 'Enter value', message = '', label = '', placeholder = '', value = '', confirmLabel = 'OK', validate, onConfirm, onCancel } = opts;
    ensurePromptModal();
    document.getElementById('promptActionTitle').textContent = title;
    const msgEl = document.getElementById('promptActionMessage');
    msgEl.textContent = message;
    msgEl.hidden = !message;
    const labelEl = document.getElementById('promptActionLabel');
    labelEl.textContent = label;
    labelEl.hidden = !label;

    const errorEl = document.getElementById('promptActionError');
    errorEl.hidden = true;
    errorEl.textContent = '';

    // Clone input/button to drop any listeners from a previous invocation.
    const staleInput = document.getElementById('promptActionInput');
    const input = staleInput.cloneNode(true);
    staleInput.parentNode.replaceChild(input, staleInput);
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.setAttribute('aria-describedby', 'promptActionError');

    const staleBtn = document.getElementById('promptActionBtn');
    const btn = staleBtn.cloneNode(true);
    staleBtn.parentNode.replaceChild(btn, staleBtn);
    btn.textContent = confirmLabel;
    btn.style.background = 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))';

    const modalElement = document.getElementById('promptActionModal');
    let confirmed = false;

    const submit = () => {
        const val = input.value.trim();
        if (validate) {
            const err = validate(val);
            if (err) {
                errorEl.textContent = err;
                errorEl.hidden = false;
                input.focus();
                return;
            }
        }
        confirmed = true;
        bootstrap.Modal.getInstance(modalElement).hide();
        if (onConfirm)
            onConfirm(val);
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit();
        }
    });
    input.addEventListener('input', () => {
        if (!errorEl.hidden) {
            errorEl.hidden = true;
            errorEl.textContent = '';
        }
    });

    const modal = new bootstrap.Modal(modalElement);
    modalElement.addEventListener('shown.bs.modal', () => {
        input.focus();
        input.select();
    }, { once: true });
    modalElement.addEventListener('hidden.bs.modal', () => {
        if (!confirmed && onCancel)
            onCancel();
    }, { once: true });
    modal.show();
}

// TWO-CHOICE MODAL — replaces window.confirm() used for a choice between two
// meaningful actions (as opposed to a destructive confirm/cancel decision).

function ensureChoiceModal() {
    if (document.getElementById('choiceActionModal'))
        return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="modal fade" id="choiceActionModal" tabindex="-1" aria-modal="true" role="dialog" aria-labelledby="choiceActionTitle" aria-describedby="choiceActionMessage">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content card-pad text-center">
        <div class="confirm-icon-wrap" id="choiceActionIconWrap">
          <i id="choiceActionIcon" class="confirm-icon bi bi-question-circle-fill" aria-hidden="true"></i>
        </div>
        <h5 id="choiceActionTitle" class="mb-1">Choose an option</h5>
        <p class="text-soft mb-0 confirm-message" id="choiceActionMessage"></p>
        <div class="d-flex flex-column gap-2 mt-3" id="choiceActionButtons"></div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('choiceActionModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const inst = bootstrap.Modal.getInstance(document.getElementById('choiceActionModal'));
            if (inst)
                inst.hide();
        }
    });
}

// opts: { title, message, icon, options: [{ label, value, primary }], onChoose(value) }
function chooseAction(opts) {
    const { title = 'Choose an option', message = '', icon = 'bi-question-circle-fill', options = [], onChoose } = opts;
    ensureChoiceModal();
    document.getElementById('choiceActionTitle').textContent = title;
    document.getElementById('choiceActionMessage').textContent = message;
    document.getElementById('choiceActionIcon').className = 'confirm-icon bi ' + icon;

    const buttonsWrap = document.getElementById('choiceActionButtons');
    buttonsWrap.innerHTML = '';
    const modalElement = document.getElementById('choiceActionModal');
    options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (opt.primary ? 'confirm-action-btn' : 'btn-ghost');
        if (opt.primary)
            btn.style.background = 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))';
        btn.textContent = opt.label;
        btn.addEventListener('click', () => {
            bootstrap.Modal.getInstance(modalElement).hide();
            if (onChoose)
                onChoose(opt.value);
        });
        buttonsWrap.appendChild(btn);
    });

    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

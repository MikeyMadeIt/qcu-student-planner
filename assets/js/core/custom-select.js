// CUSTOM SELECT

// The original <select> stays in the DOM (hidden, aria-hidden, tabindex -1)

function enhanceSelects(root) {
    root = root || document;
    const selects = root.querySelectorAll ? root.querySelectorAll('select.form-select:not([data-cs-done])') : [];
    selects.forEach(convertSelect);
}

function convertSelect(select) {
    if (select.multiple || select.hasAttribute('data-native'))
        return;
    select.setAttribute('data-cs-done', '1');

    const wrap = document.createElement('div');
    wrap.className = 'custom-select dropdown';

    const isWorkspaceSemester = select.classList.contains('settings-workspace-select');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'form-select cs-trigger' + (isWorkspaceSemester ? '' : ' dropdown-toggle') + (select.disabled ? ' disabled' : '');
    trigger.setAttribute('data-bs-toggle', 'dropdown');
    trigger.setAttribute('data-bs-auto-close', 'true');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (select.disabled)
        trigger.disabled = true;
    if (select.hasAttribute('aria-label'))
        trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    if (select.id)
        trigger.setAttribute('aria-labelledby', 'label-for-' + select.id);
    const triggerLabel = isWorkspaceSemester ? document.createElement('span') : null;
    const triggerStatus = isWorkspaceSemester ? document.createElement('span') : null;
    const triggerChevron = isWorkspaceSemester ? document.createElement('span') : null;
    if (triggerLabel) {
        triggerLabel.className = 'cs-trigger-label';
        trigger.appendChild(triggerLabel);
        triggerStatus.className = 'cs-trigger-status';
        trigger.appendChild(triggerStatus);
        triggerChevron.className = 'cs-trigger-chevron';
        triggerChevron.setAttribute('aria-hidden', 'true');
        triggerChevron.innerHTML = '<i class="icon-lucide-chevron-down"></i>';
        trigger.appendChild(triggerChevron);
    }

    const menu = document.createElement('ul');
    menu.className = 'dropdown-menu cs-menu';
    menu.setAttribute('role', 'listbox');

    function renderOptions() {
        menu.innerHTML = '';
        [...select.options].forEach(opt => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dropdown-item cs-option' + (opt.selected ? ' active' : '');
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
            btn.textContent = opt.textContent;
            btn.dataset.value = opt.value;
            if (opt.disabled) {
                btn.disabled = true;
                btn.classList.add('disabled');
            }
            btn.addEventListener('click', () => {
                select.value = opt.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                syncTrigger();
            });
            li.appendChild(btn);
            menu.appendChild(li);
        });
    }

    function syncTrigger() {
        const sel = select.options[select.selectedIndex];
        const label = sel ? sel.textContent : '';
        if (triggerLabel) {
            const statusMatch = /^(.*) • (Active|Upcoming|Previous(?: · Archived)?)$/.exec(label);
            triggerLabel.textContent = statusMatch ? statusMatch[1] : label;
            triggerStatus.textContent = statusMatch ? statusMatch[2] : '';
            triggerStatus.hidden = !statusMatch;
            triggerStatus.classList.toggle('is-active', !!statusMatch && statusMatch[2] === 'Active');
        } else trigger.textContent = label;
        menu.querySelectorAll('.cs-option').forEach(o => {
            const isSel = o.dataset.value === select.value;
            o.classList.toggle('active', isSel);
            o.setAttribute('aria-selected', isSel ? 'true' : 'false');
        });
    }

    function syncDisabledState() {
        trigger.disabled = select.disabled;
        trigger.classList.toggle('disabled', select.disabled);
    }

    renderOptions();
    syncTrigger();

    function syncMenuWidth() {
        const triggerWidth = trigger.getBoundingClientRect().width;
        const viewportWidth = document.documentElement.clientWidth;
        menu.style.width = `${Math.min(triggerWidth, Math.max(0, viewportWidth - 16))}px`;
    }

    wrap.addEventListener('show.bs.dropdown', syncMenuWidth);
    if (isWorkspaceSemester) {
        wrap.addEventListener('shown.bs.dropdown', () => {
            const icon = triggerChevron.querySelector('.lucide-icon');
            if (icon && window.setLucideIcon) window.setLucideIcon(icon, 'chevron-up');
        });
        wrap.addEventListener('hidden.bs.dropdown', () => {
            const icon = triggerChevron.querySelector('.lucide-icon');
            if (icon && window.setLucideIcon) window.setLucideIcon(icon, 'chevron-down');
        });
    }
    window.addEventListener('resize', () => {
        if (!menu.classList.contains('show'))
            return;
        syncMenuWidth();
        const dropdown = window.bootstrap && bootstrap.Dropdown.getInstance(trigger);
        if (dropdown)
            dropdown.update();
    });

    select.classList.add('cs-native-hidden');
    select.setAttribute('aria-hidden', 'true');
    select.setAttribute('tabindex', '-1');

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    if (select.id) {
        const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
        if (label)
            label.addEventListener('click', (e) => { e.preventDefault(); trigger.focus(); trigger.click(); });
    }

    const observer = new MutationObserver(() => { renderOptions(); syncTrigger(); syncDisabledState(); });
    observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });
    select.addEventListener('cs-refresh', () => { renderOptions(); syncTrigger(); });

    if (window.bootstrap && bootstrap.Dropdown) {
        const strategy = select.dataset.dropdownStrategy === 'absolute' ? 'absolute' : 'fixed';
        bootstrap.Dropdown.getOrCreateInstance(trigger, {
            popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy })
        });
    }
}

document.addEventListener('DOMContentLoaded', () => enhanceSelects(document));
document.addEventListener('show.bs.modal', (e) => enhanceSelects(e.target));
window.enhanceSelects = enhanceSelects;

/* ---------- CUSTOM SELECT ----------
   Progressively enhances native <select class="form-select"> elements into
   a flat, Bootstrap-dropdown-driven custom listbox so menus are never
   clipped by modal scroll containers and share one visual system with the
   rest of the app's dropdowns (.dropdown-menu / .dropdown-item).

   The original <select> stays in the DOM (hidden, aria-hidden, tabindex -1)
   so existing code that reads/writes `element.value` keeps working
   unchanged, and native form submission/validation is preserved. */

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

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'form-select cs-trigger dropdown-toggle' + (select.disabled ? ' disabled' : '');
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
        trigger.textContent = sel ? sel.textContent : '';
        menu.querySelectorAll('.cs-option').forEach(o => {
            const isSel = o.dataset.value === select.value;
            o.classList.toggle('active', isSel);
            o.setAttribute('aria-selected', isSel ? 'true' : 'false');
        });
    }

    renderOptions();
    syncTrigger();

    select.classList.add('cs-native-hidden');
    select.setAttribute('aria-hidden', 'true');
    select.setAttribute('tabindex', '-1');

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);

    // Keep an associated <label for="..."> clicking the trigger instead of
    // the now-hidden native select.
    if (select.id) {
        const label = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
        if (label)
            label.addEventListener('click', (e) => { e.preventDefault(); trigger.focus(); trigger.click(); });
    }

    // Keep in sync if code elsewhere sets select.value directly or rebuilds options.
    const observer = new MutationObserver(() => { renderOptions(); syncTrigger(); });
    observer.observe(select, { childList: true, attributes: true, attributeFilter: ['disabled'] });
    select.addEventListener('cs-refresh', () => { renderOptions(); syncTrigger(); });

    // Fixed-strategy Popper so the menu is never clipped by a scrollable
    // modal body, and always stays within the viewport.
    if (window.bootstrap && bootstrap.Dropdown) {
        bootstrap.Dropdown.getOrCreateInstance(trigger, {
            popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy: 'fixed' })
        });
    }
}

document.addEventListener('DOMContentLoaded', () => enhanceSelects(document));
document.addEventListener('show.bs.modal', (e) => enhanceSelects(e.target));
window.enhanceSelects = enhanceSelects;

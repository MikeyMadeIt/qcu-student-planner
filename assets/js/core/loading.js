// Shared loading-state helpers (classic script — exposes window.Loading).
//
// Provides small, reusable building blocks for skeletons, inline button
// spinners, unified loading/empty/error panels, a typing indicator, and
// upload/generation progress — so pages stop hand-rolling their own
// generic-spinner markup. See assets/css/components/skeleton.css for the
// matching styles (.skel-*, .ld-*).
//
// Usage is intentionally plain DOM / string-based since most modules in
// this app are classic (non-module) scripts loaded directly on the page.

(function () {

    function prefersReducedMotion() {
        try {
            if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
        } catch (e) { /* ignore */ }
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // ---- Skeleton rows -----------------------------------------------
    // Builds `count` placeholder rows. `widths` (optional) lets a caller
    // vary line widths per-row so the block doesn't look perfectly uniform.
    function skeletonRows(count, opts) {
        opts = opts || {};
        const withAvatar = !!opts.avatar;
        const lines = opts.lines || 2;
        const widths = opts.widths || ['60%', '40%', '30%'];
        let html = '';
        for (let i = 0; i < count; i++) {
            html += '<div class="skel-row" aria-hidden="true">';
            if (withAvatar) html += '<div class="skel skel-circle"></div>';
            html += '<div class="skel-row-body">';
            for (let l = 0; l < lines; l++) {
                const w = widths[l % widths.length];
                html += `<div class="skel skel-text" style="width:${w}"></div>`;
            }
            html += '</div></div>';
        }
        return html;
    }

    // Grid of skeleton cards (e.g. dashboard stat cards, subject cards).
    function skeletonCards(count, opts) {
        opts = opts || {};
        const lines = opts.lines || 3;
        let html = '';
        for (let i = 0; i < count; i++) {
            html += '<div class="skel-card skel-stack" aria-hidden="true">';
            html += '<div class="skel skel-title"></div>';
            for (let l = 0; l < lines; l++) {
                html += `<div class="skel skel-text" style="width:${80 - l * 15}%"></div>`;
            }
            html += '</div>';
        }
        return html;
    }

    // Render a skeleton block into a container and mark it busy for AT.
    function showSkeleton(container, html) {
        if (!container) return;
        container.setAttribute('aria-busy', 'true');
        container.innerHTML = html;
    }

    function clearBusy(container) {
        if (!container) return;
        container.removeAttribute('aria-busy');
    }

    // ---- Unified loading / empty / error state panel ------------------
    // status: 'loading' | 'empty' | 'error'
    function stateHTML(opts) {
        opts = opts || {};
        const status = opts.status || 'loading';
        const icon = opts.icon || (status === 'error' ? 'bi-exclamation-triangle-fill' : status === 'empty' ? 'bi-inbox' : 'bi-arrow-repeat');
        const title = opts.title || (status === 'error' ? 'Something went wrong' : status === 'empty' ? 'Nothing here yet' : 'Loading…');
        const message = opts.message || '';
        const spin = status === 'loading' && opts.spinIcon !== false;
        let actions = '';
        if (status === 'error' && opts.retryLabel !== false) {
            actions = `<div class="ld-state-actions"><button type="button" class="btn btn-ghost btn-sm" data-ld-retry>${opts.retryLabel || 'Retry'}</button></div>`;
        }
        return `<div class="ld-state ld-state-${status}" role="${status === 'error' ? 'alert' : 'status'}">
            <i class="bi ${icon} ld-state-icon${spin ? ' ld-spin-icon' : ''}" aria-hidden="true"></i>
            <div class="ld-state-title">${window.escHtml ? window.escHtml(title) : title}</div>
            ${message ? `<p class="ld-state-msg">${window.escHtml ? window.escHtml(message) : message}</p>` : ''}
            ${actions}
        </div>`;
    }

    // Renders the state panel into `container`, wiring the retry button (if
    // any) to `opts.onRetry`.
    function renderState(container, opts) {
        if (!container) return;
        container.innerHTML = stateHTML(opts);
        if (opts && opts.status === 'loading') container.setAttribute('aria-busy', 'true');
        else container.removeAttribute('aria-busy');
        if (opts && opts.onRetry) {
            const btn = container.querySelector('[data-ld-retry]');
            if (btn) btn.addEventListener('click', opts.onRetry);
        }
    }

    // ---- Button loading state ------------------------------------------
    // Wraps the button's existing content in a <span class="ld-btn-label">
    // (once) so it can be hidden while a centered .ld-spin shows in its
    // place. Safe to call repeatedly.
    function setButtonLoading(btn, isLoading) {
        if (!btn) return;
        let label = btn.querySelector(':scope > .ld-btn-label');
        if (!label) {
            label = document.createElement('span');
            label.className = 'ld-btn-label';
            while (btn.firstChild) label.appendChild(btn.firstChild);
            btn.appendChild(label);
        }
        let spinner = btn.querySelector(':scope > .ld-spin');
        if (isLoading) {
            if (!spinner) {
                spinner = document.createElement('span');
                spinner.className = 'ld-spin';
                spinner.setAttribute('aria-hidden', 'true');
                btn.appendChild(spinner);
            }
            btn.classList.add('ld-btn-loading');
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
        } else {
            btn.classList.remove('ld-btn-loading');
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            if (spinner) spinner.remove();
        }
    }

    // ---- Typing / "thinking" indicator ---------------------------------
    function typingIndicatorHTML(label) {
        const sr = label ? `<span class="visually-hidden">${window.escHtml ? window.escHtml(label) : label}</span>` : '<span class="visually-hidden">Generating response…</span>';
        return `<span class="ld-typing" role="status">${sr}<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></span>`;
    }

    // ---- Progress bar ----------------------------------------------------
    // percent: 0-100, or null/undefined for an indeterminate bar (used when
    // real progress isn't available — never fabricate a percentage).
    function progressHTML(percent) {
        const indeterminate = (percent === null || percent === undefined);
        const pct = indeterminate ? 0 : Math.max(0, Math.min(100, percent));
        return `<div class="ld-progress" role="progressbar" ${indeterminate ? 'aria-valuetext="Processing"' : `aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"`}>
            <div class="ld-progress-fill${indeterminate ? ' indeterminate' : ''}" style="${indeterminate ? '' : `width:${pct}%`}"></div>
        </div>`;
    }

    // ---- Save status (notes autosave, settings) ---------------------------
    // status: 'saving' | 'saved' | 'error'
    function saveStatusHTML(status, opts) {
        opts = opts || {};
        if (status === 'saving') {
            return `<span class="ld-save-status" role="status"><span class="ld-spin" style="width:.75rem;height:.75rem;border-width:1.5px"></span> ${opts.savingText || 'Saving…'}</span>`;
        }
        if (status === 'error') {
            return `<span class="ld-save-status is-error" role="alert"><i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i> ${opts.errorText || 'Not saved'}</span>`;
        }
        return `<span class="ld-save-status is-saved" role="status"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> ${opts.savedText || 'Saved'}</span>`;
    }

    window.Loading = {
        prefersReducedMotion,
        skeletonRows,
        skeletonCards,
        showSkeleton,
        clearBusy,
        stateHTML,
        renderState,
        setButtonLoading,
        typingIndicatorHTML,
        progressHTML,
        saveStatusHTML
    };

    // Small CSS-only spin animation for the ld-state-icon when used as the
    // loading glyph (kept lightweight; reuses the .ld-spin keyframes).
    const style = document.createElement('style');
    style.textContent = '.ld-state-icon.ld-spin-icon{animation:ld-spin-rotate 1s linear infinite;display:inline-block}' +
        '@media (prefers-reduced-motion: reduce){.ld-state-icon.ld-spin-icon{animation-duration:2s}}' +
        'html[data-motion="reduced"] .ld-state-icon.ld-spin-icon{animation-duration:2s}';
    document.head.appendChild(style);

})();

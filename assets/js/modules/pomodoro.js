const STORAGE_KEY = 'qcu-pomodoro-v1';
const DEFAULTS = { session: 'focus', running: false, endTimestamp: null, remainingMs: 25 * 60_000, cycle: 0, completed: 0, focusMinutes: 25, shortMinutes: 5, longMinutes: 15, longInterval: 4, isOpen: false, openedBefore: false, minimized: false, maximized: false, x: null, y: null, width: 320, height: 390 };
const MAX_WIDGET_SCALE = 1.3;
const MIN_WIDGET_SCALE = 0.8;
const MIN_WIDGET_WIDTH = 260;
const DURATIONS = { focus: 'focusMinutes', short: 'shortMinutes', long: 'longMinutes' };
const LABELS = { focus: 'Focus', short: 'Short break', long: 'Long break' };
let state = readState();
let ticker = null;
let widget;
let pageScrollStyle = null;

function readState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const merged = { ...DEFAULTS, ...saved };
        if (!DURATIONS[merged.session]) merged.session = 'focus';
        if (merged.minimized) merged.maximized = false;
        ['focusMinutes', 'shortMinutes', 'longMinutes'].forEach(key => merged[key] = clampInt(merged[key], 1, 180, DEFAULTS[key]));
        merged.longInterval = clampInt(merged.longInterval, 2, 12, 4);
        merged.cycle = Math.max(0, Number(merged.cycle) || 0);
        merged.completed = Math.max(0, Number(merged.completed) || 0);
        merged.remainingMs = Math.max(0, Number(merged.remainingMs) || 0);
        return merged;
    } catch { return { ...DEFAULTS }; }
}
function clampInt(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; }
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function remaining() { return state.running ? Math.max(0, state.endTimestamp - Date.now()) : state.remainingMs; }
function fmt(ms) { const seconds = Math.ceil(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

function mountPomodoro() {
    if (document.body.classList.contains('admin-app')) return;
    ensureWidget();
    ensureDesktopTrigger();
    document.querySelectorAll('[data-pomodoro-trigger]').forEach(trigger => {
        if (trigger.dataset.pomodoroWired) return;
        trigger.dataset.pomodoroWired = 'true';
        trigger.addEventListener('click', () => setOpen(!state.isOpen));
    });
    render();
}

function ensureDesktopTrigger() {
    let tools = document.getElementById('desktopFloatingTools');
    if (!tools) {
        tools = document.createElement('div');
        tools.id = 'desktopFloatingTools';
        tools.className = 'desktop-floating-tools';
        document.body.appendChild(tools);
    }
    let trigger = document.querySelector('[data-pomodoro-desktop]');
    if (!trigger) trigger = makeDesktopTrigger();
    const themeControl = tools.querySelector('#desktopFloatingTheme');
    if (trigger.parentElement !== tools || trigger.nextElementSibling !== themeControl) tools.insertBefore(trigger, themeControl || null);
}

function makeDesktopTrigger() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shell-icon-btn pomodoro-desktop-trigger';
    button.dataset.pomodoroTrigger = '';
    button.dataset.pomodoroDesktop = '';
    button.setAttribute('aria-label', 'Open Pomodoro timer');
    button.setAttribute('aria-expanded', 'false');
    button.title = 'Pomodoro timer';
    button.innerHTML = '<i class="icon-lucide-timer" aria-hidden="true"></i>';
    return button;
}

function ensureWidget() {
    if (widget?.isConnected) return;
    widget = document.createElement('section');
    widget.id = 'pomodoroWidget';
    widget.className = 'pomodoro-widget';
    widget.setAttribute('aria-label', 'Pomodoro timer');
    widget.innerHTML = `
      <header class="pomodoro-head" data-drag-handle>
        <div class="pomodoro-heading"><i class="icon-lucide-timer" aria-hidden="true"></i><span>Pomodoro</span></div>
        <div class="pomodoro-head-actions">
          <button type="button" data-action="minimize" aria-label="Minimize timer" title="Minimize"><i class="icon-lucide-minus" aria-hidden="true"></i></button>
          <button type="button" data-action="maximize" aria-label="Maximize timer" title="Maximize"><i class="icon-lucide-maximize" aria-hidden="true"></i></button>
          <button type="button" data-action="close" aria-label="Close timer" title="Close"><i class="icon-lucide-x" aria-hidden="true"></i></button>
        </div>
      </header>
      <div class="pomodoro-content">
        <div class="pomodoro-session-tabs" role="group" aria-label="Session type">
          <button type="button" data-session="focus">Focus</button><button type="button" data-session="short">Short break</button><button type="button" data-session="long">Long break</button>
        </div>
        <div class="pomodoro-timer-ring" id="pomodoroTimerRing">
          <svg class="pomodoro-ring-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="pomodoro-ring-track" cx="50" cy="50" r="43" pathLength="100"></circle>
            <circle class="pomodoro-ring-progress" id="pomodoroRingProgress" cx="50" cy="50" r="43" pathLength="100"></circle>
          </svg>
          <div class="pomodoro-timer-center">
            <div class="pomodoro-current" id="pomodoroSessionName"></div>
            <button type="button" class="pomodoro-clock" id="pomodoroClock" aria-label="Edit focus duration" title="Edit session duration">25:00</button>
          </div>
        </div>
        <p class="pomodoro-hint">Tap or click the time to change it</p>
        <div class="pomodoro-cycle" role="group" aria-label="Long break interval"><span>Long break every</span><button type="button" data-interval="2">2</button><button type="button" data-interval="4">4</button><button type="button" data-interval="custom">Custom</button></div>
        <div class="pomodoro-count" id="pomodoroCount" aria-live="polite"></div>
        <div class="pomodoro-controls">
          <button type="button" class="pomodoro-primary" data-action="toggle"><i class="icon-lucide-play" aria-hidden="true"></i><span>Start</span></button>
          <button type="button" data-action="reset" aria-label="Reset session" title="Reset"><i class="icon-lucide-rotate-ccw" aria-hidden="true"></i></button>
          <button type="button" data-action="skip" aria-label="Skip session" title="Skip"><i class="icon-lucide-skip-forward" aria-hidden="true"></i></button>
        </div>

      </div>
      <div class="pomodoro-editor-backdrop" data-editor hidden><form class="pomodoro-editor" data-editor-form role="dialog" aria-modal="true" aria-labelledby="pomodoroEditorTitle"><h2 id="pomodoroEditorTitle">Edit duration</h2><label data-editor-label>Minutes<input class="form-control" type="number" min="1" max="180" step="1" data-editor-input required></label><div class="pomodoro-editor-actions"><button type="button" data-editor-cancel>Cancel</button><button type="submit" class="pomodoro-primary">Save</button></div></form></div>
      <div class="pomodoro-minimized" tabindex="0" role="button" aria-label="Restore Pomodoro timer"><b data-mini-time>25:00</b><span data-mini-session>Focus</span></div>
      <div class="pomodoro-resize" aria-label="Resize timer" title="Resize timer"></div>`;
    document.body.appendChild(widget);
    widget.addEventListener('click', onWidgetClick);
    widget.addEventListener('submit', onEditorSubmit);
    widget.querySelector('.pomodoro-minimized').addEventListener('click', () => { state.minimized = false; persist(); render(); });
    widget.querySelector('[data-editor-cancel]').addEventListener('click', closeEditor);
    widget.querySelector('[data-editor]').addEventListener('click', event => { if (event.target === event.currentTarget) closeEditor(); });
    widget.addEventListener('keydown', event => { if (event.key === 'Escape' && !widget.querySelector('[data-editor]').hidden) closeEditor(); });
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true });
    wireDragAndResize();
    applyGeometry();
}

function setOpen(open) {
    if (open && !state.openedBefore) {
        const width = Math.min(Math.max(MIN_WIDGET_WIDTH, Number(state.width) || DEFAULTS.width), Math.max(MIN_WIDGET_WIDTH, window.innerWidth - 16));
        const height = measureNaturalHeight(1, width);
        state.width = width; state.height = height;
        state.x = Math.round((window.innerWidth - width) / 2);
        state.y = Math.round((window.innerHeight - height) / 2);
        state.openedBefore = true;
    }
    state.isOpen = open; updatePageScrollLock(); persist(); render();
}
function updatePageScrollLock() {
    if (state.isOpen && !pageScrollStyle) {
        pageScrollStyle = {
            htmlOverflow: document.documentElement.style.overflow,
            bodyOverflow: document.body.style.overflow,
            htmlOverscroll: document.documentElement.style.overscrollBehavior,
            bodyOverscroll: document.body.style.overscrollBehavior,
        };
        document.documentElement.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';
        document.documentElement.style.overscrollBehavior = 'none'; document.body.style.overscrollBehavior = 'none';
    } else if (!state.isOpen && pageScrollStyle) {
        document.documentElement.style.overflow = pageScrollStyle.htmlOverflow; document.body.style.overflow = pageScrollStyle.bodyOverflow;
        document.documentElement.style.overscrollBehavior = pageScrollStyle.htmlOverscroll; document.body.style.overscrollBehavior = pageScrollStyle.bodyOverscroll;
        pageScrollStyle = null;
    }
}
function preventBackgroundScroll(event) {
    if (state.isOpen && widget?.isConnected && !widget.contains(event.target)) event.preventDefault();
}
function sessionDuration(type = state.session) { return state[ DURATIONS[type] ] * 60_000; }
function begin() { if (state.running) return; if (!state.remainingMs) state.remainingMs = sessionDuration(); state.running = true; state.endTimestamp = Date.now() + state.remainingMs; persist(); startTicker(); render(); }
function pause() { state.remainingMs = remaining(); state.running = false; state.endTimestamp = null; persist(); stopTicker(); render(); }
function reset() { state.running = false; state.endTimestamp = null; state.remainingMs = sessionDuration(); persist(); stopTicker(); render(); }
function selectSession(type) { if (!DURATIONS[type]) return; state.session = type; state.running = false; state.endTimestamp = null; state.remainingMs = sessionDuration(type); persist(); stopTicker(); render(); }
function advance(completedNaturally = false) {
    if (state.session === 'focus') {
        if (completedNaturally) { state.completed += 1; state.cycle += 1; }
        state.session = state.cycle > 0 && state.cycle % state.longInterval === 0 ? 'long' : 'short';
    } else state.session = 'focus';
    state.running = false; state.endTimestamp = null; state.remainingMs = sessionDuration();
    persist();
    if (completedNaturally) {
        window.Toast?.show(`${LABELS[state.session]} started.`, 'info', 'icon-lucide-timer');
    }
    render();
}
function startTicker() { if (ticker) return; tick(); }
function stopTicker() { if (ticker) window.clearTimeout(ticker); ticker = null; }
function tick() {
    if (!state.running) { stopTicker(); return; }
    if (Date.now() >= state.endTimestamp) { ticker = null; state.remainingMs = 0; advance(true); return; }
    renderClock();
    ticker = window.setTimeout(tick, 250);
}

function onWidgetClick(event) {
    if (event.target.closest('#pomodoroClock')) { openEditor('duration'); return; }
    const interval = event.target.closest('[data-interval]');
    if (interval) {
        if (interval.dataset.interval === 'custom') openEditor('cycle');
        else { state.longInterval = Number(interval.dataset.interval); persist(); render(); }
        return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) {
        const session = event.target.closest('[data-session]');
        if (session) selectSession(session.dataset.session);
        return;
    }
    switch (button.dataset.action) {
        case 'close': setOpen(false); break;
        case 'minimize':
            widget.querySelector('[data-editor]').hidden = true;
            if (state.maximized && !state.minimized && state.restoreGeometry) {
                state.maximized = false;
                Object.assign(state, state.restoreGeometry);
            }
            state.minimized = !state.minimized; persist(); render(); break;
        case 'maximize': toggleMaximize(); break;
        case 'toggle': state.running ? pause() : begin(); break;
        case 'reset': reset(); break;
        case 'skip': advance(false); break;
    }
}
function openEditor(mode) {
    const backdrop = widget.querySelector('[data-editor]'), input = widget.querySelector('[data-editor-input]');
    backdrop.dataset.mode = mode;
    widget.querySelector('#pomodoroEditorTitle').textContent = mode === 'cycle' ? 'Long break interval' : `Set ${LABELS[state.session].toLowerCase()} duration`;
    widget.querySelector('[data-editor-label]').firstChild.textContent = mode === 'cycle' ? 'Focus sessions' : 'Minutes';
    input.min = mode === 'cycle' ? '2' : '1'; input.max = mode === 'cycle' ? '12' : '180';
    input.value = mode === 'cycle' ? state.longInterval : state[DURATIONS[state.session]];
    backdrop.hidden = false; input.focus(); input.select();
}
function closeEditor() { widget.querySelector('[data-editor]').hidden = true; widget.querySelector('#pomodoroClock').focus(); }
function onEditorSubmit(event) {
    if (!event.target.matches('[data-editor-form]')) return;
    event.preventDefault();
    const backdrop = widget.querySelector('[data-editor]'), input = widget.querySelector('[data-editor-input]');
    if (backdrop.dataset.mode === 'cycle') state.longInterval = clampInt(input.value, 2, 12, state.longInterval);
    else {
        const key = DURATIONS[state.session];
        state[key] = clampInt(input.value, 1, 180, state[key]);
        state.running = false; state.endTimestamp = null; state.remainingMs = sessionDuration(); stopTicker();
    }
    persist(); closeEditor(); render();
}
function toggleMaximize() {
    if (state.minimized) { state.minimized = false; render(); }
    if (!state.maximized) {
        const rect = widget.getBoundingClientRect();
        state.restoreGeometry = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
        state.maximized = true;
    } else {
        state.maximized = false;
        if (state.restoreGeometry) Object.assign(state, state.restoreGeometry);
    }
    persist(); applyGeometry(); render();
}

function renderClock() {
    if (!widget?.isConnected) return;
    const value = fmt(remaining());
    widget.querySelector('#pomodoroClock').textContent = value;
    widget.querySelector('[data-mini-time]').textContent = value;
    const progress = Math.max(0, Math.min(1, remaining() / sessionDuration()));
    widget.querySelector('#pomodoroRingProgress').style.strokeDashoffset = String(100 * (1 - progress));
    document.querySelectorAll('.pomodoro-header-time').forEach(node => { node.textContent = value; node.hidden = !state.running; });
    document.title = state.running ? `${value} · ${LABELS[state.session]} · QCU Student Planner` : document.title.replace(/^\d{2}:\d{2} · (Focus|Short break|Long break) · /, '');
}
function render() {
    if (!widget?.isConnected) return;
    updatePageScrollLock();
    widget.hidden = !state.isOpen;
    widget.classList.toggle('is-minimized', state.minimized);
    widget.classList.toggle('is-maximized', state.maximized);
    widget.dataset.session = state.session;
    widget.querySelector('#pomodoroSessionName').textContent = LABELS[state.session];
    widget.querySelector('#pomodoroClock').setAttribute('aria-label', `Edit ${LABELS[state.session].toLowerCase()} duration`);
    widget.querySelector('#pomodoroCount').textContent = `Completed focus sessions: ${state.completed} · Cycle ${state.cycle % state.longInterval}/${state.longInterval}`;
    widget.querySelectorAll('[data-session]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.session === state.session)));
    widget.querySelector('[data-action="toggle"]').innerHTML = state.running
        ? '<i class="icon-lucide-pause" aria-hidden="true"></i><span>Pause</span>'
        : '<i class="icon-lucide-play" aria-hidden="true"></i><span>Start</span>';
    window.setLucideIcon(widget.querySelector('[data-action="maximize"] .lucide-icon'), state.maximized ? 'minimize' : 'maximize');
    widget.querySelectorAll('[data-interval]').forEach(button => {
        const isCustom = button.dataset.interval === 'custom';
        button.setAttribute('aria-pressed', String(isCustom ? ![2, 4].includes(state.longInterval) : button.dataset.interval === String(state.longInterval)));
        if (isCustom) button.setAttribute('aria-label', `Custom interval, currently ${state.longInterval} focus sessions`);
    });
    document.querySelectorAll('[data-pomodoro-trigger]').forEach(trigger => trigger.setAttribute('aria-expanded', String(state.isOpen)));
    applyGeometry(); renderClock();
    if (state.running) startTicker(); else stopTicker();
}

function getWidgetScale(width, height) {
    const naturalHeight = measureNaturalHeight(1, width);
    return Math.min(MAX_WIDGET_SCALE, Math.max(MIN_WIDGET_SCALE, 1 + (width - 320) / 300, 1 + (height - naturalHeight) / 200));
}

function setWidgetScale(scale) {
    widget.style.setProperty('--pomodoro-scale', String(scale));
    const scaledSizes = {
        '--pomo-content-pad': '22px',
        '--pomo-tab-pad-y': `${6 * scale}px`, '--pomo-tab-pad-x': `${9 * scale}px`,
        '--pomo-tab-font': `${0.68 * scale}rem`, '--pomo-ring-size': `${168 * scale}px`,
        '--pomo-ring-margin': `${12 * scale}px`, '--pomo-ring-margin-bottom': `${8 * scale}px`,
        '--pomo-session-font': `${0.72 * scale}rem`, '--pomo-clock-font': `${2 * scale}rem`,
        '--pomo-count-font': '0.6rem', '--pomo-control-gap': `${8 * scale}px`,
        '--pomo-control-margin': `${7 * scale}px`, '--pomo-primary-width': `${82 * scale}px`,
        '--pomo-primary-height': `${32 * scale}px`, '--pomo-control-button-size': `${32 * scale}px`, '--pomo-primary-font': `${0.78 * scale}rem`,
        '--pomo-cycle-font': '0.6rem', '--pomo-cycle-gap': `${4 * scale}px`,
    };
    Object.entries(scaledSizes).forEach(([property, value]) => widget.style.setProperty(property, value));
}

function measureNaturalHeight(scale, width) {
    if (!widget?.isConnected) return DEFAULTS.height;
    const oldHidden = widget.hidden;
    const oldWidgetStyle = widget.getAttribute('style');
    const content = widget.querySelector('.pomodoro-content');
    const oldContentStyle = content.getAttribute('style');
    widget.hidden = false;
    widget.style.width = `${width}px`;
    widget.style.height = 'auto';
    widget.style.maxHeight = 'none';
    content.style.overflow = 'visible';
    setWidgetScale(scale);
    const height = Math.ceil(widget.getBoundingClientRect().height);
    if (oldWidgetStyle == null) widget.removeAttribute('style'); else widget.setAttribute('style', oldWidgetStyle);
    if (oldContentStyle == null) content.removeAttribute('style'); else content.setAttribute('style', oldContentStyle);
    widget.hidden = oldHidden;
    return Math.max(260, height);
}

function applyGeometry(maxHeightOverride = null) {
    if (!widget?.isConnected) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (state.maximized) {
        Object.assign(widget.style, { left: '8px', top: '8px', width: `${Math.max(MIN_WIDGET_WIDTH, vw - 16)}px`, height: `${Math.max(180, vh - 16)}px` });
        setWidgetScale(Math.min(1.3, Math.max(1.1, Math.min(vw, vh) / 600)));
        return;
    }
    const maxWidth = Math.max(MIN_WIDGET_WIDTH, Math.min(420, vw - 16));
    const width = Math.min(Math.max(MIN_WIDGET_WIDTH, Number(state.width) || DEFAULTS.width), maxWidth);
    const contentHeight = state.minimized ? 74 : maxHeightOverride ?? measureNaturalHeight(MAX_WIDGET_SCALE, width);
    const viewportLimit = Math.max(180, vh - 16);
    const minimumHeight = state.minimized ? 74 : Math.min(measureNaturalHeight(MIN_WIDGET_SCALE, width), viewportLimit);
    const maxHeight = Math.max(minimumHeight, Math.min(contentHeight, viewportLimit));
    let height = Math.min(Math.max(minimumHeight, Number(state.height) || DEFAULTS.height), maxHeight);
    if (!state.minimized) {
        const fittingPasses = maxHeightOverride == null ? 4 : 1;
        for (let i = 0; i < fittingPasses; i++) {
            const requiredHeight = measureNaturalHeight(getWidgetScale(width, height), width);
            if (requiredHeight <= height || height >= maxHeight) break;
            height = Math.min(maxHeight, requiredHeight);
        }
    }
    const x = Math.min(Math.max(8, state.x == null ? vw - width - 24 : Number(state.x)), Math.max(8, vw - width - 8));
    const y = Math.min(Math.max(8, state.y == null ? vh - height - 24 : Number(state.y)), Math.max(8, vh - height - 8));
    Object.assign(widget.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: state.minimized ? 'auto' : `${height}px` });
    state.x = x; state.y = y; state.width = width; if (!state.minimized) state.height = height;
    setWidgetScale(getWidgetScale(width, height));
}
function wireDragAndResize() {
    const handle = widget.querySelector('[data-drag-handle]');
    handle.addEventListener('pointerdown', event => {
        if (event.target.closest('button') || state.maximized || event.button !== 0) return;
        const rect = widget.getBoundingClientRect(), sx = event.clientX, sy = event.clientY;
        handle.setPointerCapture(event.pointerId);
        const move = e => { state.x = rect.left + e.clientX - sx; state.y = rect.top + e.clientY - sy; applyGeometry(); };
        const end = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); persist(); };
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end, { once: true });
    });
    const grip = widget.querySelector('.pomodoro-resize');
    grip.addEventListener('pointerdown', event => {
        if (state.maximized || state.minimized || event.button !== 0) return;
        event.preventDefault(); grip.setPointerCapture(event.pointerId); widget.classList.add('is-resizing');
        const rect = widget.getBoundingClientRect(), sx = event.clientX, sy = event.clientY;
        const contentHeightLimit = measureNaturalHeight(MAX_WIDGET_SCALE, rect.width);
        const minimumContentHeight = measureNaturalHeight(MIN_WIDGET_SCALE, MIN_WIDGET_WIDTH);
        let pendingEvent = null, resizeFrame = 0;
        const resizeTo = e => {
            if (!e) return;
            const maxWidth = Math.max(MIN_WIDGET_WIDTH, Math.min(420, window.innerWidth - rect.left - 8));
            const maxHeight = Math.min(contentHeightLimit, window.innerHeight - rect.top - 8);
            const minDelta = Math.max(MIN_WIDGET_WIDTH - rect.width, minimumContentHeight - rect.height);
            const maxDelta = Math.min(maxWidth - rect.width, maxHeight - rect.height);
            const dx = e.clientX - sx, dy = e.clientY - sy;
            const delta = Math.max(minDelta, Math.min(maxDelta, Math.abs(dx) >= Math.abs(dy) ? dx : dy));
            state.width = rect.width + delta;
            state.height = rect.height + delta;
            applyGeometry(contentHeightLimit);
        };
        const move = e => {
            pendingEvent = e;
            if (!resizeFrame) resizeFrame = window.requestAnimationFrame(() => { resizeFrame = 0; resizeTo(pendingEvent); });
        };
        const end = event => {
            if (resizeFrame) { window.cancelAnimationFrame(resizeFrame); resizeFrame = 0; resizeTo(pendingEvent); }
            if (event?.type === 'pointerup') resizeTo(event);
            grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', end); grip.removeEventListener('pointercancel', end);
            widget.classList.remove('is-resizing'); applyGeometry(); persist();
        };
        grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', end, { once: true });
        grip.addEventListener('pointercancel', end, { once: true });
    });
    window.addEventListener('resize', () => { applyGeometry(); persist(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

if (state.running) {
    if (state.endTimestamp <= Date.now()) { state.remainingMs = 0; advance(true); }
    else startTicker();
}

export { mountPomodoro };

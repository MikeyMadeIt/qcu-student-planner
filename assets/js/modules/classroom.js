import { getSupabase } from '../core/supabase-client.js';

const supabase = getSupabase();
const content = document.getElementById('classroomContent');
const message = document.getElementById('classroomMessage');
const actions = document.getElementById('classroomActions');

const callbackMessages = {
    connected: 'Google Classroom is connected.',
    denied: 'Google authorization was cancelled. You can connect whenever you are ready.',
    'not-approved': 'Your Planner account is not currently approved, so Classroom cannot be connected.',
    error: 'Google Classroom could not be connected. Please try again.',
};

function button(label, icon, handler, className = 'btn btn-accent') {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.innerHTML = `<i class="bi ${icon} me-1" aria-hidden="true"></i>${label}`;
    element.addEventListener('click', handler);
    return element;
}

function setBusy(busy, text) {
    content.setAttribute('aria-busy', String(busy));
    message.textContent = text;
    actions.replaceChildren();
    actions.hidden = true;
}

async function startConnection(trigger) {
    trigger.disabled = true;
    setBusy(true, 'Opening Google authorization…');
    try {
        const { data, error } = await supabase.functions.invoke('classroom-oauth-start', { body: {} });
        if (error || !data?.authorizationUrl) throw new Error('start failed');
        const target = new URL(data.authorizationUrl);
        if (target.origin !== 'https://accounts.google.com' || target.pathname !== '/o/oauth2/v2/auth') throw new Error('invalid target');
        window.location.assign(target.toString());
    } catch {
        trigger.disabled = false;
        renderDisconnected('Could not start Google authorization. Please check your connection and try again.');
    }
}

async function disconnect(connection) {
    if (!window.confirm('Disconnect this Google Classroom account? Your Planner account will stay signed in.')) return;
    const disconnectButton = [...actions.querySelectorAll('button')].find(item => item.textContent.includes('Disconnect'));
    if (disconnectButton) disconnectButton.disabled = true;
    setBusy(true, 'Disconnecting Google Classroom…');
    try {
        const { data, error } = await supabase.functions.invoke('classroom-connection', {
            body: { action: 'disconnect', connectionId: connection.id },
        });
        if (error || !data?.ok) throw new Error('disconnect failed');
        const note = data.revocation === 'confirmed'
            ? 'Google Classroom has been disconnected. Your Planner account remains signed in.'
            : 'Your Planner connection has been cleared. Google could not confirm remote token revocation; you may also remove access in your Google Account settings.';
        renderDisconnected(note);
    } catch {
        renderConnected(connection, 'Could not disconnect right now. Please try again.');
    }
}

function renderDisconnected(note = '') {
    content.setAttribute('aria-busy', 'false');
    content.querySelector('.classroom-meta')?.remove();
    message.textContent = note || 'Connect Google Classroom to view your courses and assignments in future integration updates.';
    const permission = document.createElement('p');
    permission.className = 'text-faint';
    permission.id = 'classroomPermission';
    permission.textContent = 'Google will ask you to choose an account and authorize read-only access to your courses and coursework. You may choose the same Google account as Planner or a different one.';
    const connect = button('Connect Google Classroom', 'bi-google', event => startConnection(event.currentTarget));
    actions.replaceChildren(connect);
    actions.hidden = false;
    const existingPermission = content.querySelector('#classroomPermission');
    if (existingPermission) existingPermission.replaceWith(permission);
    else content.insertBefore(permission, actions);
}

function formatDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not available';
}

function renderConnected(connection, note = '', authorizationCheck = 'ok') {
    content.setAttribute('aria-busy', 'false');
    content.querySelector('#classroomPermission')?.remove();
    message.textContent = note || (connection.status === 'reauthorization_required' || authorizationCheck === 'reauthorization_required'
        ? 'Google authorization needs to be renewed before this connection can be used.'
        : authorizationCheck === 'temporarily_unavailable'
            ? 'This account is connected, but Google authorization could not be checked right now. Try reloading shortly.'
            : 'This Google account is connected. Classroom data synchronization will be added in a later phase.');
    const previous = content.querySelector('.classroom-meta');
    if (previous) previous.remove();
    const meta = document.createElement('div');
    meta.className = 'classroom-meta';
    const rows = [
        ['Connected account', connection.google_email],
        ['Status', connection.status === 'connected' ? 'Connected' : 'Reconnection required'],
        ['Connected on', formatDate(connection.connected_at)],
        ['Last authorization check', formatDate(connection.updated_at)],
    ];
    rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'classroom-meta-row';
        const name = document.createElement('span'); name.className = 'classroom-meta-label'; name.textContent = label;
        const text = document.createElement('span'); text.className = 'classroom-meta-value'; text.textContent = value || 'Not available';
        row.append(name, text); meta.append(row);
    });
    content.insertBefore(meta, actions);
    actions.replaceChildren(
        button('Reconnect', 'bi-arrow-repeat', event => startConnection(event.currentTarget)),
        button('Disconnect', 'bi-link-45deg', () => disconnect(connection), 'btn btn-ghost'),
    );
    actions.hidden = false;
}

async function loadStatus() {
    const outcome = new URLSearchParams(location.search).get('classroom_oauth');
    if (outcome) {
        history.replaceState({}, document.title, location.pathname);
        if (callbackMessages[outcome]) message.textContent = callbackMessages[outcome];
    }
    try {
        const { data, error } = await supabase.functions.invoke('classroom-connection', { body: { action: 'status' } });
        if (error) throw new Error('status failed');
        const connection = data?.connection;
        if (connection) renderConnected(connection, callbackMessages[outcome] && outcome === 'connected' ? callbackMessages[outcome] : '', data.authorizationCheck);
        else renderDisconnected(callbackMessages[outcome] || 'Connect Google Classroom to view your courses and assignments in future integration updates.');
    } catch {
        content.setAttribute('aria-busy', 'false');
        message.textContent = 'Connection status could not be loaded. Check your internet connection and reload this page.';
    }
}

loadStatus();

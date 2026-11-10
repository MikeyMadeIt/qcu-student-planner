// AI STUDY ASSISTANT

let asaAttachment = null;
let asaMessages = [];   /* [{role:'user'|'assistant', content, fileName?}] */
let asaBusy = false;
let asaConvId = null;   /* saved conversation id, once the first turn is persisted */
let asaSaveChain = Promise.resolve(); /* serializes saves so one chat never creates two conversations */
let asaConversations = [];  /* cached list from the backend, for instant search filtering */
let asaSearchTerm = '';
let asaOpenMenuId = null;

const ASA_HISTORY_LIMIT = 12;
const ASA_SUGGESTIONS = [
    'Explain a difficult concept',
    'Summarize my study material',
    'Give me an example',
    'Help me prepare for an exam',
];

function asaEl(id) { return document.getElementById(id); }

// See aqmSafeBind in ai-quiz-maker.js for why this exists: a missing element
function asaSafeBind(id, event, handler) {
    try {
        const el = asaEl(id);
        if (!el) { console.error(`AI Study Assistant: missing element #${id}`); return; }
        el.addEventListener(event, handler);
    } catch (error) {
        console.error(`AI Study Assistant: could not bind ${event} on #${id}`, error);
    }
}

function initAiStudyAssistant() {
    asaSafeBind('asaForm', 'submit', event => {
        event.preventDefault();
        asaSend();
    });

    try {
        asaAttachment = initAiFileAttachment({
            inputEl: asaEl('asaFileInput'),
            triggerEl: asaEl('asaAttachBtn'),
            infoEl: asaEl('asaFileInfo'),
            removeEl: asaEl('asaFileRemove'),
            emptyEl: null,
            onError: msg => Toast.show(msg, 'danger', 'bi-exclamation-triangle-fill'),
            onChange: file => asaUpdateAttachBar(file),
        });
    } catch (error) {
        console.error('AI Study Assistant: file attachment setup failed', error);
    }
    if (!asaAttachment) asaAttachment = { getFile: () => null, clear: () => {} };

    asaSafeBind('asaInput', 'input', () => {
        const input = asaEl('asaInput');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });
    asaSafeBind('asaInput', 'keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            asaSend();
        }
    });

    asaSafeBind('asaClearBtn', 'click', () => { asaNewChat(); asaCloseDropdown(); });

    // Conversations dropdown (sits above the chat — the app already has its own sidebar)
    asaSafeBind('asaDropdownToggle', 'click', event => {
        event.stopPropagation();
        asaDropdownOpen() ? asaCloseDropdown() : asaOpenDropdown();
    });

    asaSafeBind('asaSearch', 'input', e => { asaSearchTerm = e.target.value.trim().toLowerCase(); asaRenderHistoryLists(); });

    document.addEventListener('click', event => {
        asaCloseOpenMenu();
        const dropdown = asaEl('asaDropdown');
        const panel = asaEl('asaDropdownPanel');
        const inside = (dropdown && dropdown.contains(event.target)) || (panel && panel.contains(event.target));
        if (asaDropdownOpen() && !inside) asaCloseDropdown();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') { asaCloseDropdown(); asaCloseOpenMenu(); }
    });

    // Move the panel to <body> once, so it's never a descendant of a
    // transformed/filtered ancestor that would hijack its position:fixed
    // containing block (see grid.css for the bug this used to hit).
    const panel = asaEl('asaDropdownPanel');
    if (panel && panel.parentElement !== document.body) document.body.appendChild(panel);

    asaRenderEmptyState();
    asaLoadHistory();
}

function asaDropdownOpen() {
    const dropdown = asaEl('asaDropdown');
    return !!(dropdown && dropdown.classList.contains('is-open'));
}

function asaOpenDropdown() {
    const dropdown = asaEl('asaDropdown');
    const panel = asaEl('asaDropdownPanel');
    if (!dropdown || !panel) return;
    dropdown.classList.add('is-open');
    panel.hidden = false;
    asaEl('asaDropdownToggle').setAttribute('aria-expanded', 'true');
    asaPositionDropdown();
    window.addEventListener('resize', asaPositionDropdown);
    window.addEventListener('scroll', asaPositionDropdown, true);
    const search = asaEl('asaSearch');
    if (search) search.focus();
}

function asaCloseDropdown() {
    const dropdown = asaEl('asaDropdown');
    const panel = asaEl('asaDropdownPanel');
    if (!dropdown || !panel || panel.hidden) return;
    dropdown.classList.remove('is-open');
    panel.hidden = true;
    asaEl('asaDropdownToggle').setAttribute('aria-expanded', 'false');
    window.removeEventListener('resize', asaPositionDropdown);
    window.removeEventListener('scroll', asaPositionDropdown, true);
}

// The panel is position:fixed, so it floats above the chat workspace
// regardless of any ancestor's overflow or stacking context — this just
// places it under the toggle button and keeps it inside the viewport.
function asaPositionDropdown() {
    const toggle = asaEl('asaDropdownToggle');
    const panel = asaEl('asaDropdownPanel');
    if (!toggle || !panel || panel.hidden) return;

    const margin = 12;
    const rect = toggle.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || Math.min(352, window.innerWidth - margin * 2);
    const panelHeight = panel.offsetHeight || 0;

    let left = rect.right - panelWidth; /* align panel's right edge with the button's */
    left = Math.min(Math.max(left, margin), window.innerWidth - panelWidth - margin);

    let top = rect.bottom + 8;
    if (top + panelHeight > window.innerHeight - margin) {
        top = Math.max(rect.top - panelHeight - 8, margin); /* flip above if no room below */
    }

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
}

function asaUpdateAttachBar(file) {
    const bar = asaEl('asaAttachBar');
    const trigger = asaEl('asaAttachBtn');
    if (bar) { bar.hidden = !file; bar.classList.toggle('is-visible', !!file); }
    if (trigger) trigger.classList.toggle('has-file', !!file);
}

function asaSetBusy(busy) {
    asaBusy = busy;
    asaEl('asaSendBtn').disabled = busy;
    asaEl('asaInput').disabled = busy;
}

function asaFillInput(text) {
    const input = asaEl('asaInput');
    if (!input) return;
    input.value = text;
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}

async function asaSend() {
    if (asaBusy) return; /* prevent duplicate submissions while a request is processing */

    const input = asaEl('asaInput');
    const message = input.value.trim();
    const file = asaAttachment.getFile();

    if (!message && !file) return;

    let fileData = null;
    if (file) {
        try {
            fileData = await aiUploadToBase64(file);
        } catch (error) {
            Toast.show(error.message || 'That file could not be read.', 'danger', 'bi-exclamation-triangle-fill');
            return;
        }
    }

    const userTurn = { role: 'user', content: message || '(Attached a file for review)', fileName: file ? file.name : null };
    asaMessages.push(userTurn);
    asaRenderMessages();

    input.value = '';
    input.style.height = 'auto';
    asaAttachment.clear();
    asaHideError();
    asaSetBusy(true);
    asaShowTyping(true);

    try {
        const { AiService } = await import('../services/ai-service.js');

        const history = asaMessages
            .slice(-1 - ASA_HISTORY_LIMIT, -1) /* prior turns, excluding the one just added */
            .map(m => ({ role: m.role, content: m.content }));

        const result = await AiService.sendStudyAssistantMessage({
            message: userTurn.content,
            history,
            file: fileData,
        });

        asaShowTyping(false);

        if (!result.ok) {
            asaShowError(result.message);
            return;
        }

        const replyText = asaExtractReplyText(result.data);
        if (!replyText) {
            asaShowError('The AI returned an empty or unexpected response. Please try again.');
            return;
        }

        asaMessages.push({ role: 'assistant', content: replyText });
        asaRenderMessages();
        asaPersistTurn(userTurn, replyText);
    } catch (error) {
        asaShowTyping(false);
        asaShowError('Could not reach the AI service. Please try again.');
    } finally {
        asaSetBusy(false);
    }
}

// Persistence (Supabase)

async function asaStore() { return (await import('../services/ai-chat-store.js')).AiChatStore; }

// Saves the finished turn. Runs on a chain so rapid turns are saved in order
function asaPersistTurn(userTurn, replyText) {
    const title = (asaMessages.find(m => m.role === 'user')?.content || 'New chat').slice(0, 60);
    asaSaveChain = asaSaveChain.then(async () => {
        try {
            const store = await asaStore();
            asaConvId = await store.saveTurn(asaConvId, {
                title,
                userContent: userTurn.content,
                userFileName: userTurn.fileName,
                assistantContent: replyText,
            });
            asaLoadHistory();
        } catch (error) {
            console.warn('AI Study Assistant: could not save conversation', error);
            Toast.show("Reply received, but the conversation couldn't be saved: " + error.message, 'danger', 'bi-cloud-slash');
        }
    });
}

async function asaLoadHistory() {
    try {
        asaConversations = await (await asaStore()).listConversations();
        asaRenderHistoryLists();
    } catch (error) {
        console.warn('AI Study Assistant: could not load history', error);
        const msg = '<div class="text-faint" style="font-size:.85rem;padding:.5rem .25rem">Couldn\'t load your conversations. ' + escHtml(error.message || '') + '</div>';
        const h = asaEl('asaHistory');
        if (h) h.innerHTML = msg;
    }
}

// Groups the (optionally search-filtered) list into Today / Yesterday /
// Previous 7 Days / Older buckets, then renders it into the dropdown.
function asaRenderHistoryLists() {
    let list = asaConversations;
    if (asaSearchTerm) list = list.filter(c => (c.title || '').toLowerCase().includes(asaSearchTerm));

    const groups = [
        { label: 'Today', items: [] },
        { label: 'Yesterday', items: [] },
        { label: 'Previous 7 days', items: [] },
        { label: 'Older', items: [] },
    ];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const sevenDaysAgo = new Date(startOfToday); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    list.forEach(c => {
        const d = new Date(c.updated_at);
        if (d >= startOfToday) groups[0].items.push(c);
        else if (d >= startOfYesterday) groups[1].items.push(c);
        else if (d >= sevenDaysAgo) groups[2].items.push(c);
        else groups[3].items.push(c);
    });

    const html = list.length
        ? groups.filter(g => g.items.length).map(g => `
            <div class="asa-history-group-label">${g.label}</div>
            ${g.items.map(c => asaHistoryItemHtml(c)).join('')}
          `).join('')
        : `<div class="text-faint" style="font-size:.85rem;padding:.5rem .25rem">${asaSearchTerm ? 'No conversations match your search.' : 'No saved conversations yet.'}</div>`;

    const host = asaEl('asaHistory');
    if (host) host.innerHTML = html;

    asaBindHistoryItems();
}

function asaHistoryItemHtml(c) {
    return `
      <div class="asa-history-item ${c.id === asaConvId ? 'is-active' : ''}" data-id="${escHtml(c.id)}">
        <button type="button" class="asa-history-item-btn" data-action="open" title="${escHtml(c.title)}">
          <span class="asa-history-item-title">${escHtml(c.title)}</span>
          <span class="asa-history-item-date">${escHtml(new Date(c.updated_at).toLocaleDateString())}</span>
        </button>
        <button type="button" class="asa-history-menu-btn" data-action="menu" aria-label="Conversation options" aria-haspopup="true">
          <i class="bi bi-three-dots" aria-hidden="true"></i>
        </button>
        <div class="asa-history-menu" hidden>
          <button type="button" data-action="rename"><i class="bi bi-pencil" aria-hidden="true"></i>Rename</button>
          <button type="button" class="text-danger" data-action="delete"><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button>
        </div>
      </div>`;
}

function asaBindHistoryItems() {
    document.querySelectorAll('.asa-history-item').forEach(item => {
        const id = item.dataset.id;
        const openBtn = item.querySelector('[data-action="open"]');
        const menuBtn = item.querySelector('[data-action="menu"]');
        const menu = item.querySelector('.asa-history-menu');
        const renameBtn = item.querySelector('[data-action="rename"]');
        const deleteBtn = item.querySelector('[data-action="delete"]');

        if (openBtn) openBtn.addEventListener('click', () => { asaOpenSaved(id); asaCloseDropdown(); });
        if (menuBtn) menuBtn.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = !menu.hidden;
            asaCloseOpenMenu();
            if (!isOpen) {
                menu.hidden = false;
                item.classList.add('is-menu-open');
                asaOpenMenuId = id;
            }
        });
        if (renameBtn) renameBtn.addEventListener('click', event => { event.stopPropagation(); asaCloseOpenMenu(); asaRenameSaved(id); });
        if (deleteBtn) deleteBtn.addEventListener('click', event => { event.stopPropagation(); asaCloseOpenMenu(); asaDeleteSaved(id); });
    });
}

function asaCloseOpenMenu() {
    if (!asaOpenMenuId) return;
    document.querySelectorAll('.asa-history-menu').forEach(m => m.hidden = true);
    document.querySelectorAll('.asa-history-item.is-menu-open').forEach(i => i.classList.remove('is-menu-open'));
    asaOpenMenuId = null;
}

async function asaOpenSaved(id) {
    if (asaBusy) return;
    try {
        await asaSaveChain; /* let any in-flight save finish first */
        const conv = await (await asaStore()).getConversation(id);
        asaMessages = conv.messages;
        asaConvId = conv.id;
        asaHideError();
        asaRenderMessages();
        asaRenderHistoryLists();
    } catch (error) {
        Toast.show("Couldn't open that conversation: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
    }
}

function asaRenameSaved(id) {
    const conv = asaConversations.find(c => c.id === id);
    const next = window.prompt('Rename conversation', conv ? conv.title : '');
    if (next === null) return;
    const title = next.trim();
    if (!title) return;
    (async () => {
        try {
            await asaSaveChain;
            await (await asaStore()).renameConversation(id, title);
            if (conv) conv.title = title;
            asaRenderHistoryLists();
        } catch (error) {
            Toast.show("Couldn't rename: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
        }
    })();
}

function asaDeleteSaved(id) {
    confirmAction({
        title: 'Delete conversation?', message: 'This conversation will be permanently removed.',
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill',
        async onConfirm() {
            try {
                await asaSaveChain;
                await (await asaStore()).deleteConversation(id);
                Toast.show('Conversation deleted');
                if (id === asaConvId) asaNewChat();
                asaLoadHistory();
            } catch (error) {
                Toast.show("Couldn't delete: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
            }
        }
    });
}

// Starts a fresh chat. Saved conversations stay in the list.
function asaNewChat() {
    if (asaBusy) return;
    asaMessages = [];
    asaConvId = null;
    asaHideError();
    asaRenderEmptyState();
    asaRenderHistoryLists();
}

// The "ai-study" backend returns the assistant's reply as a plain string in
function asaExtractReplyText(data) {
    if (typeof data === 'string') return data.trim();
    if (data && typeof data.reply === 'string') return data.reply.trim();
    if (data && typeof data.message === 'string') return data.message.trim();
    if (data && typeof data.text === 'string') return data.text.trim();
    return '';
}

function asaShowTyping(show) {
    asaEl('asaTypingRow').hidden = !show;
    if (show) asaScrollToBottom();
}

function asaShowError(message) {
    asaEl('asaErrorBanner').hidden = false;
    asaEl('asaErrorMessage').textContent = message;
}

function asaHideError() {
    asaEl('asaErrorBanner').hidden = true;
}

function asaRenderEmptyState() {
    const log = asaEl('asaChatLog');
    log.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'asa-welcome';
    empty.id = 'asaEmptyState';
    empty.innerHTML = `<i class="bi bi-stars" aria-hidden="true"></i>
        <h2>AI Study Assistant</h2>
        <p>Ask questions, understand difficult topics, or study your materials.</p>
        <div class="asa-suggestions">
          ${ASA_SUGGESTIONS.map(s => `<button type="button" class="asa-suggestion-chip">${escHtml(s)}</button>`).join('')}
        </div>`;
    log.appendChild(empty);
    empty.querySelectorAll('.asa-suggestion-chip').forEach(btn => {
        btn.addEventListener('click', () => asaFillInput(btn.textContent));
    });
}

function asaScrollToBottom() {
    const log = asaEl('asaChatLog');
    log.scrollTop = log.scrollHeight;
}

// Rebuilds the whole log from asaMessages. Simple and safe for a chat of this
function asaRenderMessages() {
    const log = asaEl('asaChatLog');
    log.innerHTML = '';

    if (!asaMessages.length) {
        asaRenderEmptyState();
        return;
    }

    asaMessages.forEach(m => {
        const row = document.createElement('div');
        row.className = `ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`;

        if (m.fileName) {
            const attach = document.createElement('div');
            attach.className = 'ai-msg-attachment';
            const icon = document.createElement('i');
            icon.className = 'bi bi-paperclip';
            icon.setAttribute('aria-hidden', 'true');
            attach.appendChild(icon);
            attach.appendChild(document.createTextNode(m.fileName));
            row.appendChild(attach);
        }

        row.appendChild(asaRenderFormattedContent(m.content));
        log.appendChild(row);
    });

    asaScrollToBottom();
}

// Safe markdown-lite renderer
function asaRenderFormattedContent(text) {
    const wrapper = document.createElement('div');
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

    let i = 0;
    let listEl = null;
    let paraLines = [];

    function flushParagraph() {
        if (paraLines.length) {
            const p = document.createElement('p');
            p.textContent = paraLines.join(' ');
            wrapper.appendChild(p);
            paraLines = [];
        }
    }
    function closeList() { listEl = null; }

    while (i < lines.length) {
        const line = lines[i];

        if (/^```/.test(line.trim())) {
            flushParagraph();
            closeList();
            const codeLines = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i].trim())) {
                codeLines.push(lines[i]);
                i++;
            }
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = codeLines.join('\n');
            pre.appendChild(code);
            wrapper.appendChild(pre);
            i++; /* skip closing fence */
            continue;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            closeList();
            const h = document.createElement(`h${Math.min(headingMatch[1].length, 3)}`);
            h.textContent = headingMatch[2].trim();
            wrapper.appendChild(h);
            i++;
            continue;
        }

        const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
        const orderedMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (bulletMatch || orderedMatch) {
            flushParagraph();
            const tag = orderedMatch ? 'ol' : 'ul';
            if (!listEl || listEl.tagName.toLowerCase() !== tag) {
                listEl = document.createElement(tag);
                wrapper.appendChild(listEl);
            }
            const li = document.createElement('li');
            li.textContent = (bulletMatch ? bulletMatch[1] : orderedMatch[1]).trim();
            listEl.appendChild(li);
            i++;
            continue;
        }

        if (!line.trim()) {
            flushParagraph();
            closeList();
            i++;
            continue;
        }

        closeList();
        paraLines.push(line.trim());
        i++;
    }
    flushParagraph();

    if (!wrapper.childNodes.length) {
        const p = document.createElement('p');
        p.textContent = String(text || '');
        wrapper.appendChild(p);
    }

    return wrapper;
}

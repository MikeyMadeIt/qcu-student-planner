// AI STUDY ASSISTANT

let asaAttachment = null;
let asaMessages = [];   /* [{role:'user'|'assistant', content, fileName?}] */
let asaBusy = false;
let asaConvId = null;   /* saved conversation id, once the first turn is persisted */
let asaSaveChain = Promise.resolve(); /* serializes saves so one chat never creates two conversations */

const ASA_HISTORY_LIMIT = 12;

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
            emptyEl: asaEl('asaFileEmpty'),
            onError: msg => Toast.show(msg, 'danger', 'bi-exclamation-triangle-fill'),
        });
    } catch (error) {
        console.error('AI Study Assistant: file attachment setup failed', error);
    }
    if (!asaAttachment) asaAttachment = { getFile: () => null, clear: () => {} };

    asaSafeBind('asaInput', 'input', () => {
        const input = asaEl('asaInput');
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 128) + 'px';
    });
    asaSafeBind('asaInput', 'keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            asaSend();
        }
    });

    asaSafeBind('asaClearBtn', 'click', asaNewChat);
    asaRenderEmptyState();
    asaLoadHistory();
}

function asaSetBusy(busy) {
    asaBusy = busy;
    asaEl('asaSendBtn').disabled = busy;
    asaEl('asaInput').disabled = busy;
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
    const host = asaEl('asaHistory');
    if (!host) return;
    try {
        const list = await (await asaStore()).listConversations();
        const count = asaEl('asaHistoryCount');
        if (count) count.textContent = list.length ? `(${list.length})` : '';
        host.innerHTML = list.length ? list.map(c => `
          <div class="asa-history-item d-flex align-items-center gap-2 py-1 ${c.id === asaConvId ? 'fw-bold' : ''}">
            <button type="button" class="btn btn-ghost btn-sm flex-grow-1 text-start text-truncate" onclick="asaOpenSaved('${c.id}')" title="${escHtml(c.title)}">
              <i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>${escHtml(c.title)}
              <span class="text-faint ms-1" style="font-size:.72rem">${escHtml(new Date(c.updated_at).toLocaleDateString())}</span>
            </button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="asaDeleteSaved('${c.id}')" aria-label="Delete conversation"><i class="bi bi-trash3" aria-hidden="true"></i></button>
          </div>`).join('')
          : '<div class="text-faint" style="font-size:.85rem">No saved conversations yet.</div>';
    } catch (error) {
        console.warn('AI Study Assistant: could not load history', error);
        host.innerHTML = '<div class="text-faint" style="font-size:.85rem">Couldn\'t load your conversations. ' + escHtml(error.message || '') + '</div>';
    }
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
        asaLoadHistory();
    } catch (error) {
        Toast.show("Couldn't open that conversation: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
    }
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
    asaLoadHistory();
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
    empty.className = 'ai-state';
    empty.id = 'asaEmptyState';
    empty.innerHTML = `<i class="bi bi-stars" aria-hidden="true"></i>
        <p>Ask a question, request an explanation, summarize a lesson, or attach study material to get started.</p>`;
    log.appendChild(empty);
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
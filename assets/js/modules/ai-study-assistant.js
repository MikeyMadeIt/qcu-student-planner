/* ============================================================
   AI STUDY ASSISTANT
   Conversation-style page session (not persisted to a database).
   The frontend sends recent prior turns as `history` on every
   request since the backend does not remember earlier messages
   on its own. AI output is rendered through a small safe
   markdown-lite renderer that builds DOM nodes directly —
   never through unsafe innerHTML of untrusted text. ============================================================ */

let asaAttachment = null;
let asaMessages = [];   /* [{role:'user'|'assistant', content, file?}] — this page session only */
let asaBusy = false;

/* Keep only the last N turns as context sent to the backend, to bound payload size. */
const ASA_HISTORY_LIMIT = 12;

function asaEl(id) { return document.getElementById(id); }

/* See aqmSafeBind in ai-quiz-maker.js for why this exists: a missing element
   or setup error is logged, never thrown, so it can't block the rest of this
   page's controls (including Send) from being wired up. */
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
    /* Bound first and on its own so Send is never skipped because something
       else below it failed to set up. */
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

    asaSafeBind('asaClearBtn', 'click', asaClearConversation);
    asaRenderEmptyState();
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
    } catch (error) {
        asaShowTyping(false);
        asaShowError('Could not reach the AI service. Please try again.');
    } finally {
        asaSetBusy(false);
    }
}

/* The "ai-study" backend returns the assistant's reply as a plain string in
   `result` for the "assistant" feature. A couple of alternate shapes are
   tolerated defensively in case the backend's "additional metadata" ever
   wraps the text. */
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

function asaClearConversation() {
    if (!asaMessages.length) return;
    confirmAction({
        title: 'Clear conversation?',
        message: 'This clears the current session only. It cannot be undone.',
        confirmLabel: 'Clear',
        danger: true,
        icon: 'bi-trash3-fill',
        onConfirm: () => {
            asaMessages = [];
            asaHideError();
            asaRenderEmptyState();
        },
    });
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

/* Rebuilds the whole log from asaMessages. Simple and safe for a page-session-only
   chat of this size; every piece of text goes through safe DOM construction. */
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

/* ---------- Safe markdown-lite renderer ----------
   Builds real DOM nodes for paragraphs, unordered/ordered lists, headings,
   and fenced code blocks. Never passes AI-generated text through innerHTML —
   all text content is set via textContent / createTextNode. */
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

        /* fenced code block */
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

        /* heading */
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

        /* list item (- , * , or 1. ) */
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

        /* blank line separates paragraphs */
        if (!line.trim()) {
            flushParagraph();
            closeList();
            i++;
            continue;
        }

        /* plain text line */
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

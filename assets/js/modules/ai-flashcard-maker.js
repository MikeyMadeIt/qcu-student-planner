/* ============================================================
   AI FLASHCARD MAKER
   Creation form -> validated flashcard set -> flip/shuffle/
   navigate UI. Generated decks are saved to Supabase through
   services/ai-flashcard-store.js (protected by RLS).
   ============================================================ */

let afmAttachment = null;
let afmSet = null;       /* { title, cards: [{front, back}] } */
let afmOrder = [];       /* indices into afmSet.cards, shuffle-able */
let afmIndex = 0;
let afmFlipped = false;
let afmBusy = false;
let afmDeckId = null;      /* saved deck id, once persisted */
let afmSavePromise = null; /* resolves when the deck row exists */

function afmEl(id) { return document.getElementById(id); }

/* See aqmSafeBind in ai-quiz-maker.js for why this exists: a missing element
   or setup error is logged, never thrown, so it can't block the rest of this
   page's controls (including the Generate button) from being wired up. */
function afmSafeBind(id, event, handler) {
    try {
        const el = afmEl(id);
        if (!el) { console.error(`AI Flashcard Maker: missing element #${id}`); return; }
        el.addEventListener(event, handler);
    } catch (error) {
        console.error(`AI Flashcard Maker: could not bind ${event} on #${id}`, error);
    }
}

function initAiFlashcardMaker() {
    /* Bound first and on its own so it's never skipped because something
       else below it failed to set up. */
    afmSafeBind('afmForm', 'submit', event => {
        event.preventDefault();
        afmGenerate();
    });

    try {
        afmAttachment = initAiFileAttachment({
            inputEl: afmEl('afmFileInput'),
            triggerEl: afmEl('afmDropzone'),
            dropzoneEl: afmEl('afmDropzone'),
            infoEl: afmEl('afmFileInfo'),
            removeEl: afmEl('afmFileRemove'),
            emptyEl: afmEl('afmFileEmpty'),
            onError: msg => Toast.show(msg, 'danger', 'bi-exclamation-triangle-fill'),
        });
    } catch (error) {
        console.error('AI Flashcard Maker: file attachment setup failed', error);
    }
    if (!afmAttachment) afmAttachment = { getFile: () => null, clear: () => {} };

    afmSafeBind('afmRetryBtn', 'click', afmGenerate);
    afmSafeBind('afmNewSetBtn', 'click', afmReset);
    afmSafeBind('afmRestartBtn', 'click', afmRestart);
    afmSafeBind('afmShuffleBtn', 'click', afmShuffle);
    afmSafeBind('afmPrevBtn', 'click', () => afmGoTo(afmIndex - 1));
    afmSafeBind('afmNextBtn', 'click', () => afmGoTo(afmIndex + 1));
    afmSafeBind('afmCard', 'click', afmFlip);
    afmSafeBind('afmCard', 'keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); afmFlip(); }
    });

    afmLoadHistory();
}

function afmSetBusy(busy) {
    afmBusy = busy;
    const btn = afmEl('afmGenerateBtn');
    btn.disabled = busy;
    btn.innerHTML = busy
        ? `<i class="bi bi-arrow-repeat ai-spin" aria-hidden="true"></i> Generating…`
        : `<i class="bi bi-stars" aria-hidden="true"></i> Generate Flashcards`;
}

async function afmGenerate() {
    if (afmBusy) return;

    const topic = afmEl('afmTopic').value.trim();
    const notes = afmEl('afmNotes').value.trim();
    const file = afmAttachment.getFile();

    if (!topic && !notes && !file) {
        Toast.show('Add a topic, some notes, or attach a file to generate flashcards.', 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    afmShowView('loading');
    afmSetBusy(true);

    try {
        const { AiService } = await import('../services/ai-service.js');

        let fileData = null;
        if (file) {
            try {
                fileData = await aiUploadToBase64(file);
            } catch (error) {
                afmShowError(error.message || 'That file could not be read.');
                return;
            }
        }

        const result = await AiService.generateFlashcards({ topic, notes, file: fileData });

        if (!result.ok) {
            afmShowError(result.message);
            return;
        }

        const validated = afmValidateSet(result.data);
        if (!validated) {
            afmShowError('The AI returned flashcards in an unexpected format. Please try generating again.');
            return;
        }

        afmSet = validated;
        afmPersistDeck(validated, {
            topic: topic || (notes ? notes.slice(0, 120) : ''),
            fileName: file ? file.name : null,
        });
        afmOrder = afmSet.cards.map((_, i) => i);
        afmIndex = 0;
        afmFlipped = false;
        afmRenderCard();
        afmShowView('cards');
    } catch (error) {
        afmShowError('Something went wrong generating your flashcards. Please try again.');
    } finally {
        afmSetBusy(false);
    }
}

/* ---------- Persistence (Supabase) ---------- */

async function afmStore() { return (await import('../services/ai-flashcard-store.js')).AiFlashcardStore; }

function afmPersistDeck(set, meta) {
    afmDeckId = null;
    afmSavePromise = (async () => {
        try {
            const store = await afmStore();
            afmDeckId = await store.saveDeck(set, meta);
            afmLoadHistory();
        } catch (error) {
            console.warn('AI Flashcard Maker: could not save deck', error);
            Toast.show("Flashcards generated, but they couldn't be saved: " + error.message, 'danger', 'bi-cloud-slash');
        }
    })();
}

async function afmLoadHistory() {
    const host = afmEl('afmHistory');
    if (!host) return;
    try {
        const list = await (await afmStore()).listDecks();
        host.innerHTML = list.length ? list.map(d => `
          <div class="aqm-history-card">
            <div class="aqm-history-card-info">
              <div class="aqm-history-card-title text-truncate" title="${escHtml(d.title)}">${escHtml(d.title)}</div>
              <div class="aqm-history-card-meta">
                ${d.card_count} card${d.card_count === 1 ? '' : 's'}${d.topic ? ' · ' + escHtml(d.topic) : ''}
              </div>
            </div>
            <div class="aqm-history-card-actions">
              <button type="button" class="btn-icon btn-sm" onclick="afmOpenSaved('${d.id}')" aria-label="Open ${escHtml(d.title)}"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></button>
              <button type="button" class="btn-icon btn-sm aqm-danger" onclick="afmDeleteSaved('${d.id}')" aria-label="Delete ${escHtml(d.title)}"><i class="bi bi-trash3" aria-hidden="true"></i></button>
            </div>
          </div>`).join('')
          : afmHistoryEmptyMarkup('bi-journal-text', 'Generate a flashcard set and it will show up here.');
    } catch (error) {
        console.warn('AI Flashcard Maker: could not load history', error);
        host.innerHTML = afmHistoryEmptyMarkup('bi-exclamation-triangle', "Couldn't load your saved decks", 'Please refresh the page to try again.');
    }
}

/* Mirrors aqmHistoryEmptyMarkup in ai-quiz-maker.js — same centered
   icon + message treatment for the loading / empty / error states. */
function afmHistoryEmptyMarkup(icon, title, subtext) {
    return `<div class="aqm-history-empty">
        <i class="bi ${icon}" aria-hidden="true"></i>
        <p>${escHtml(title)}</p>
        ${subtext ? `<span>${escHtml(subtext)}</span>` : ''}
    </div>`;
}

async function afmOpenSaved(id) {
    try {
        const deck = await (await afmStore()).getDeck(id);
        afmSet = deck; afmDeckId = id; afmSavePromise = Promise.resolve();
        afmOrder = deck.cards.map((_, i) => i);
        afmIndex = 0; afmFlipped = false;
        afmRenderCard(); afmShowView('cards');
    } catch (error) {
        Toast.show("Couldn't open that deck: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
    }
}

function afmDeleteSaved(id) {
    confirmAction({
        title: 'Delete deck?', message: 'This flashcard deck will be permanently removed.',
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill',
        async onConfirm() {
            try { await (await afmStore()).deleteDeck(id); Toast.show('Deck deleted'); afmLoadHistory(); }
            catch (error) { Toast.show("Couldn't delete: " + error.message, 'danger', 'bi-exclamation-triangle-fill'); }
        }
    });
}

function afmValidateSet(data) {
    if (!data || typeof data !== 'object') return null;
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Your Flashcards';
    const rawCards = Array.isArray(data.cards) ? data.cards : (Array.isArray(data.flashcards) ? data.flashcards : null);
    if (!rawCards || !rawCards.length) return null;

    const cards = [];
    for (const c of rawCards) {
        if (!c || typeof c !== 'object') continue;
        const front = typeof c.front === 'string' ? c.front.trim() : (typeof c.question === 'string' ? c.question.trim() : '');
        const back = typeof c.back === 'string' ? c.back.trim() : (typeof c.answer === 'string' ? c.answer.trim() : '');
        if (!front || !back) continue;
        cards.push({ front, back });
    }
    if (!cards.length) return null;
    return { title, cards };
}

function afmShowView(view) {
    afmEl('afmForm').hidden = view !== 'form';
    const history = afmEl('afmHistorySection');
    if (history) history.hidden = view !== 'form';
    afmEl('afmLoadingState').hidden = view !== 'loading';
    afmEl('afmErrorState').hidden = view !== 'error';
    afmEl('afmCardsPanel').hidden = view !== 'cards';
}

function afmShowError(message) {
    afmEl('afmErrorMessage').textContent = message;
    afmShowView('error');
}

function afmReset() {
    afmSet = null;
    afmDeckId = null;
    afmSavePromise = null;
    afmOrder = [];
    afmIndex = 0;
    afmFlipped = false;
    afmShowView('form');
    afmLoadHistory();
}

function afmRestart() {
    if (!afmSet) return;
    afmOrder = afmSet.cards.map((_, i) => i);
    afmIndex = 0;
    afmFlipped = false;
    afmRenderCard();
}

function afmShuffle() {
    if (!afmSet) return;
    for (let i = afmOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [afmOrder[i], afmOrder[j]] = [afmOrder[j], afmOrder[i]];
    }
    afmIndex = 0;
    afmFlipped = false;
    afmRenderCard();
    Toast.show('Cards shuffled.', 'accent', 'bi-shuffle');
}

function afmGoTo(index) {
    if (!afmSet) return;
    afmIndex = Math.max(0, Math.min(index, afmOrder.length - 1));
    afmFlipped = false;
    afmRenderCard();
}

function afmFlip() {
    afmFlipped = !afmFlipped;
    afmEl('afmCard').classList.toggle('is-flipped', afmFlipped);
    afmEl('afmCard').setAttribute('aria-pressed', String(afmFlipped));
}

function afmRenderCard() {
    const card = afmSet.cards[afmOrder[afmIndex]];
    const total = afmOrder.length;

    afmEl('afmSetTitle').textContent = afmSet.title;
    afmEl('afmProgressLabel').textContent = `Card ${afmIndex + 1} of ${total}`;
    afmEl('afmProgressFill').style.width = `${((afmIndex + 1) / total) * 100}%`;
    afmEl('afmCardFront').textContent = card.front;
    afmEl('afmCardBack').textContent = card.back;

    afmEl('afmCard').classList.remove('is-flipped');
    afmEl('afmCard').setAttribute('aria-pressed', 'false');

    afmEl('afmPrevBtn').disabled = afmIndex === 0;
    afmEl('afmNextBtn').disabled = afmIndex === total - 1;
}
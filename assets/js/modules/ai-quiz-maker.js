/* ============================================================
   AI QUIZ MAKER
   Creation form -> validated quiz structure -> interactive
   quiz-taking UI with scoring, review and retake.
   Classic script; loads AiService via a dynamic import since
   this file is not itself a module. Nothing here is saved to a
   database — the generated quiz lives only in page memory. ============================================================ */

let aqmAttachment = null; /* { getFile, clear } from initAiFileAttachment */
let aqmQuiz = null;       /* validated quiz object currently loaded */
let aqmIndex = 0;         /* current question index while taking the quiz */
let aqmAnswers = [];      /* selected option index per question, or null */
let aqmSubmitted = false;
let aqmBusy = false;
let aqmQuizId = null;      /* saved quiz id, once persisted */
let aqmSavePromise = null; /* resolves when the quiz row exists */

function aqmEl(id) { return document.getElementById(id); }

/* Binds one listener defensively: a missing element or any other setup error
   is logged instead of thrown, so one bad lookup can never again silently
   stop the rest of this page's controls (including the Generate button)
   from being wired up. */
function aqmSafeBind(id, event, handler) {
    try {
        const el = aqmEl(id);
        if (!el) { console.error(`AI Quiz Maker: missing element #${id}`); return; }
        el.addEventListener(event, handler);
    } catch (error) {
        console.error(`AI Quiz Maker: could not bind ${event} on #${id}`, error);
    }
}

function initAiQuizMaker() {
    /* The Generate form's submit handler is bound first and on its own, so it
       can never be skipped because something else below it failed to set up. */
    aqmSafeBind('aqmForm', 'submit', event => {
        event.preventDefault();
        aqmGenerate();
    });

    try {
        aqmAttachment = initAiFileAttachment({
            inputEl: aqmEl('aqmFileInput'),
            triggerEl: aqmEl('aqmDropzone'),
            dropzoneEl: aqmEl('aqmDropzone'),
            infoEl: aqmEl('aqmFileInfo'),
            removeEl: aqmEl('aqmFileRemove'),
            emptyEl: aqmEl('aqmFileEmpty'),
            onError: msg => Toast.show(msg, 'danger', 'bi-exclamation-triangle-fill'),
        });
    } catch (error) {
        console.error('AI Quiz Maker: file attachment setup failed', error);
    }
    if (!aqmAttachment) aqmAttachment = { getFile: () => null, clear: () => {} }; /* safe fallback so generation still works without an attachment */

    try {
        const countInput = aqmEl('aqmQuestionCount');
        const countLabel = aqmEl('aqmQuestionCountLabel');
        if (countInput && countLabel)
            countInput.addEventListener('input', () => { countLabel.textContent = countInput.value; });
    } catch (error) {
        console.error('AI Quiz Maker: question-count control setup failed', error);
    }

    try {
        aqmInitDifficultyPills();
    } catch (error) {
        console.error('AI Quiz Maker: difficulty selector setup failed', error);
    }

    aqmSafeBind('aqmRetryBtn', 'click', aqmGenerate);
    aqmSafeBind('aqmRetakeBtn', 'click', aqmRetake);
    aqmSafeBind('aqmNewQuizBtn', 'click', aqmReset);
    aqmSafeBind('aqmPrevBtn', 'click', () => aqmGoTo(aqmIndex - 1));
    aqmSafeBind('aqmNextBtn', 'click', () => aqmGoTo(aqmIndex + 1));
    aqmSafeBind('aqmSubmitBtn', 'click', aqmSubmitQuiz);

    aqmLoadHistory();
}

/* Three-way "Easy / Medium / Hard" pill group. Keeps the hidden #aqmDifficulty
   input (read by aqmGenerate) in sync and behaves like a radio group for
   keyboard and screen-reader users. */
function aqmInitDifficultyPills() {
    const group = aqmEl('aqmDifficultyGroup');
    const hiddenInput = aqmEl('aqmDifficulty');
    if (!group || !hiddenInput) return;
    const pills = Array.from(group.querySelectorAll('.aqm-pill'));
    if (!pills.length) return;

    function select(pill) {
        pills.forEach(p => {
            const isSelected = p === pill;
            p.classList.toggle('is-selected', isSelected);
            p.setAttribute('aria-checked', String(isSelected));
            p.tabIndex = isSelected ? 0 : -1;
        });
        hiddenInput.value = pill.dataset.value;
    }

    pills.forEach((pill, i) => {
        pill.tabIndex = pill.classList.contains('is-selected') ? 0 : -1;
        pill.addEventListener('click', () => select(pill));
        pill.addEventListener('keydown', event => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const next = pills[(i + (event.key === 'ArrowRight' ? 1 : pills.length - 1)) % pills.length];
            next.focus();
            select(next);
        });
    });
}

function aqmSetBusy(busy) {
    aqmBusy = busy;
    const btn = aqmEl('aqmGenerateBtn');
    btn.disabled = busy;
    btn.innerHTML = busy
        ? `<i class="bi bi-arrow-repeat ai-spin" aria-hidden="true"></i> Generating…`
        : `<i class="bi bi-stars" aria-hidden="true"></i> Generate Quiz`;
}

async function aqmGenerate() {
    if (aqmBusy) return; /* prevent duplicate submissions while a request is processing */

    const topic = aqmEl('aqmTopic').value.trim();
    const notes = aqmEl('aqmNotes').value.trim();
    const file = aqmAttachment.getFile();

    if (!topic && !notes && !file) {
        Toast.show('Add a topic, some notes, or attach a file to generate a quiz.', 'danger', 'bi-exclamation-triangle-fill');
        return;
    }

    aqmShowView('loading');
    aqmSetBusy(true);

    try {
        const { AiService } = await import('../services/ai-service.js');

        let fileData = null;
        if (file) {
            try {
                fileData = await aiUploadToBase64(file);
            } catch (error) {
                aqmShowError(error.message || 'That file could not be read.');
                return;
            }
        }

        const result = await AiService.generateQuiz({
            topic,
            notes,
            questionCount: Number(aqmEl('aqmQuestionCount').value),
            difficulty: aqmEl('aqmDifficulty').value,
            file: fileData,
        });

        if (!result.ok) {
            aqmShowError(result.message);
            return;
        }

        const validated = aqmValidateQuiz(result.data);
        if (!validated) {
            aqmShowError('The AI returned a quiz in an unexpected format. Please try generating again.');
            return;
        }

        aqmQuiz = validated;
        aqmPersistQuiz(validated, {
            topic: topic || (notes ? notes.slice(0, 120) : ''),
            difficulty: aqmEl('aqmDifficulty').value,
            fileName: file ? file.name : null,
        });
        aqmAnswers = new Array(validated.questions.length).fill(null);
        aqmIndex = 0;
        aqmSubmitted = false;
        aqmRenderQuestion();
        aqmShowView('quiz');
    } catch (error) {
        aqmShowError('Something went wrong generating your quiz. Please try again.');
    } finally {
        aqmSetBusy(false);
    }
}

/* Defensively validates the AI's response shape so a malformed reply never
   crashes the page. The real "ai-study" backend returns each question as
   { question, A, B, C, D, correctAnswer: "A"|"B"|"C"|"D", explanation } —
   this also tolerates a choices[]/correctIndex shape or a lettered object
   under "choices", in case the model's output format drifts slightly.
   Returns a normalized { title, questions:[{question,choices,correctIndex,
   explanation}] } object, or null if nothing usable could be recovered. */
function aqmValidateQuiz(data) {
    if (!data || typeof data !== 'object') return null;
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'Your Quiz';
    const rawQuestions = Array.isArray(data.questions) ? data.questions : null;
    if (!rawQuestions || !rawQuestions.length) return null;

    const letters = ['A', 'B', 'C', 'D'];
    const questions = [];
    for (const q of rawQuestions) {
        if (!q || typeof q !== 'object') continue;
        const questionText = typeof q.question === 'string' ? q.question.trim() : '';
        if (!questionText) continue;

        /* Pull the four choices from whichever shape is present. */
        let choices = [];
        if (letters.every(l => typeof q[l] === 'string' && q[l].trim())) {
            choices = letters.map(l => q[l].trim());
        } else if (q.choices && typeof q.choices === 'object' && !Array.isArray(q.choices)
            && letters.every(l => typeof q.choices[l] === 'string' && q.choices[l].trim())) {
            choices = letters.map(l => q.choices[l].trim());
        } else if (Array.isArray(q.choices)) {
            choices = q.choices.filter(c => typeof c === 'string' && c.trim());
        }
        if (choices.length !== 4) continue;

        let correctIndex = null;
        if (typeof q.correctAnswer === 'string') {
            const letterMatch = q.correctAnswer.trim().toUpperCase();
            const byLetter = { A: 0, B: 1, C: 2, D: 3 }[letterMatch];
            if (byLetter !== undefined) correctIndex = byLetter;
            else {
                const byText = choices.findIndex(c => c.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase());
                if (byText >= 0) correctIndex = byText;
            }
        } else if (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4) {
            correctIndex = q.correctIndex;
        }
        if (correctIndex === null) continue;

        questions.push({
            question: questionText,
            choices,
            correctIndex,
            explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
        });
    }

    if (!questions.length) return null;
    return { title, questions };
}

function aqmShowView(view) {
    aqmEl('aqmForm').hidden = view !== 'form';
    aqmEl('aqmHistorySection').hidden = view !== 'form';
    aqmEl('aqmLoadingState').hidden = view !== 'loading';
    aqmEl('aqmErrorState').hidden = view !== 'error';
    aqmEl('aqmQuizCard').hidden = view !== 'quiz';
    aqmEl('aqmResultsCard').hidden = view !== 'results';
}

function aqmShowError(message) {
    aqmEl('aqmErrorMessage').textContent = message;
    aqmShowView('error');
}

function aqmReset() {
    aqmQuiz = null;
    aqmAnswers = [];
    aqmIndex = 0;
    aqmSubmitted = false;
    aqmShowView('form');
    aqmQuizId = null; 
    aqmSavePromise = null;
}

function aqmRetake() {
    if (!aqmQuiz) return;
    aqmAnswers = new Array(aqmQuiz.questions.length).fill(null);
    aqmIndex = 0;
    aqmSubmitted = false;
    aqmRenderQuestion();
    aqmShowView('quiz');
}

function aqmGoTo(index) {
    if (!aqmQuiz) return;
    aqmIndex = Math.max(0, Math.min(index, aqmQuiz.questions.length - 1));
    aqmRenderQuestion();
}

function aqmSelectChoice(choiceIndex) {
    if (aqmSubmitted) return;
    aqmAnswers[aqmIndex] = choiceIndex;
    aqmRenderQuestion();
}

function aqmRenderQuestion() {
    const q = aqmQuiz.questions[aqmIndex];
    const total = aqmQuiz.questions.length;

    aqmEl('aqmQuizTitle').textContent = aqmQuiz.title;
    aqmEl('aqmProgressLabel').textContent = `Question ${aqmIndex + 1} of ${total}`;
    aqmEl('aqmProgressFill').style.width = `${((aqmIndex + 1) / total) * 100}%`;
    aqmEl('aqmQuestionText').textContent = q.question;

    const letters = ['A', 'B', 'C', 'D'];
    const choicesEl = aqmEl('aqmChoices');
    choicesEl.innerHTML = q.choices.map((choice, i) => {
        const selected = aqmAnswers[aqmIndex] === i;
        let stateClass = selected ? 'is-selected' : '';
        let icon = '';
        if (aqmSubmitted) {
            if (i === q.correctIndex) { stateClass = 'is-correct'; icon = '<i class="bi bi-check-circle-fill ai-choice-icon" aria-hidden="true"></i>'; }
            else if (selected) { stateClass = 'is-incorrect'; icon = '<i class="bi bi-x-circle-fill ai-choice-icon" aria-hidden="true"></i>'; }
        }
        return `<button type="button" class="ai-choice ${stateClass}" data-choice="${i}" ${aqmSubmitted ? 'disabled' : ''} aria-pressed="${selected}">
            <span class="ai-choice-letter" aria-hidden="true">${letters[i]}</span>
            <span class="ai-choice-text">${escHtml(choice)}</span>
            ${icon}
        </button>`;
    }).join('');

    choicesEl.querySelectorAll('.ai-choice').forEach(btn => {
        btn.addEventListener('click', () => aqmSelectChoice(Number(btn.dataset.choice)));
    });

    const explanationEl = aqmEl('aqmExplanation');
    if (aqmSubmitted && q.explanation) {
        explanationEl.hidden = false;
        explanationEl.innerHTML = `<i class="bi bi-lightbulb" aria-hidden="true"></i> ${escHtml(q.explanation)}`;
    } else {
        explanationEl.hidden = true;
    }

    aqmEl('aqmPrevBtn').disabled = aqmIndex === 0;
    const isLast = aqmIndex === total - 1;
    aqmEl('aqmNextBtn').hidden = isLast;
    aqmEl('aqmSubmitBtn').hidden = !isLast || aqmSubmitted;
    aqmEl('aqmViewResultsBtn').hidden = !(isLast && aqmSubmitted);
}

function aqmSubmitQuiz() {
    if (!aqmQuiz) return;
    const unanswered = aqmAnswers.filter(a => a === null).length;
    if (unanswered > 0) {
        const proceed = window.confirm(`You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`);
        if (!proceed) return;
    }
    aqmSubmitted = true;
    aqmRenderQuestion();
    aqmShowResults();
    const total = aqmQuiz.questions.length;
    const correct = aqmQuiz.questions.filter((q, i) => aqmAnswers[i] === q.correctIndex).length;
    aqmPersistAttempt(correct, total, Math.round((correct / total) * 100));
}

function aqmShowResults() {
    const total = aqmQuiz.questions.length;
    let correct = 0;
    aqmQuiz.questions.forEach((q, i) => { if (aqmAnswers[i] === q.correctIndex) correct++; });
    const percent = Math.round((correct / total) * 100);

    aqmEl('aqmResultsCard').style.setProperty('--score', percent);
    aqmEl('aqmScoreRing').style.setProperty('--score', percent);
    aqmEl('aqmScorePercent').textContent = `${percent}%`;
    aqmEl('aqmScoreFraction').textContent = `${correct} / ${total} correct`;

    const letters = ['A', 'B', 'C', 'D'];
    aqmEl('aqmReviewList').innerHTML = aqmQuiz.questions.map((q, i) => {
        const userAnswer = aqmAnswers[i];
        const wasCorrect = userAnswer === q.correctIndex;
        return `<div class="ai-review-item">
            <div class="ai-review-item-q"><i class="bi ${wasCorrect ? 'bi-check-circle-fill ai-choice-icon' : 'bi-x-circle-fill ai-choice-icon'}" aria-hidden="true"></i><span>${i + 1}. ${escHtml(q.question)}</span></div>
            <div class="text-soft" style="font-size:.85rem">
                Your answer: ${userAnswer === null ? '<em>No answer</em>' : escHtml(`${letters[userAnswer]}. ${q.choices[userAnswer]}`)}
                ${wasCorrect ? '' : `<br>Correct answer: ${escHtml(`${letters[q.correctIndex]}. ${q.choices[q.correctIndex]}`)}`}
            </div>
            ${q.explanation ? `<div class="ai-explanation" style="margin-top:.5rem">${escHtml(q.explanation)}</div>` : ''}
        </div>`;
    }).join('');

    aqmShowView('results');
}

async function aqmStore() { return (await import('../services/ai-quiz-store.js')).AiQuizStore; }

function aqmPersistQuiz(quiz, meta) {
    aqmQuizId = null;
    aqmSavePromise = (async () => {
        try {
            const store = await aqmStore();
            aqmQuizId = await store.saveQuiz(quiz, meta);
            aqmLoadHistory();
        } catch (error) {
            console.warn('AI Quiz Maker: could not save quiz', error);
            Toast.show("Quiz generated, but it couldn't be saved: " + error.message, 'danger', 'bi-cloud-slash');
        }
    })();
}

async function aqmPersistAttempt(correct, total, percent) {
    try {
        await aqmSavePromise;            /* make sure the quiz row exists first */
        if (!aqmQuizId) return;
        const store = await aqmStore();
        await store.saveAttempt(aqmQuizId, { correct, total, percent, answers: aqmAnswers.slice() });
        aqmLoadHistory();
    } catch (error) {
        console.warn('AI Quiz Maker: could not save attempt', error);
        Toast.show("Your score couldn't be saved: " + error.message, 'danger', 'bi-cloud-slash');
    }
}

async function aqmLoadHistory() {
    const host = aqmEl('aqmHistory');
    if (!host) return;
    try {
        const list = await (await aqmStore()).listQuizzes();
        host.innerHTML = list.length ? list.map(q => `
          <div class="aqm-history-card">
            <div class="aqm-history-card-info">
              <div class="aqm-history-card-title text-truncate" title="${escHtml(q.title)}">${escHtml(q.title)}</div>
              <div class="aqm-history-card-meta">
                ${q.question_count} question${q.question_count === 1 ? '' : 's'} · ${q.attempts} attempt${q.attempts === 1 ? '' : 's'}
                ${q.bestPercent !== null ? ' · best ' + q.bestPercent + '%' : ''}
              </div>
            </div>
            <div class="aqm-history-card-actions">
              <button type="button" class="btn-icon btn-sm" onclick="aqmOpenSaved('${q.id}')" aria-label="Open ${escHtml(q.title)}"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></button>
              <button type="button" class="btn-icon btn-sm aqm-danger" onclick="aqmDeleteSaved('${q.id}')" aria-label="Delete ${escHtml(q.title)}"><i class="bi bi-trash3" aria-hidden="true"></i></button>
            </div>
          </div>`).join('')
          : aqmHistoryEmptyMarkup('bi-journal-text', 'No saved quizzes yet', 'Generate a quiz below and it will show up here.');
    } catch (error) {
        host.innerHTML = aqmHistoryEmptyMarkup('bi-exclamation-triangle', "Couldn't load your saved quizzes", 'Please refresh the page to try again.');
    }
}

/* Shared markup for the history list's loading / empty / error states —
   centered icon + message, filling the card the same way whether it's
   waiting, has nothing to show, or failed to load. */
function aqmHistoryEmptyMarkup(icon, title, subtext) {
    return `<div class="aqm-history-empty">
        <i class="bi ${icon}" aria-hidden="true"></i>
        <p>${escHtml(title)}</p>
        ${subtext ? `<span>${escHtml(subtext)}</span>` : ''}
    </div>`;
}

async function aqmOpenSaved(id) {
    try {
        const quiz = await (await aqmStore()).getQuiz(id);
        aqmQuiz = quiz; aqmQuizId = id; aqmSavePromise = Promise.resolve();
        aqmAnswers = new Array(quiz.questions.length).fill(null);
        aqmIndex = 0; aqmSubmitted = false;
        aqmRenderQuestion(); aqmShowView('quiz');
    } catch (error) {
        Toast.show("Couldn't open that quiz: " + error.message, 'danger', 'bi-exclamation-triangle-fill');
    }
}

function aqmDeleteSaved(id) {
    confirmAction({
        title: 'Delete quiz?', message: 'This quiz and its scores will be permanently removed.',
        confirmLabel: 'Delete', danger: true, icon: 'bi-trash-fill',
        async onConfirm() {
            try { await (await aqmStore()).deleteQuiz(id); Toast.show('Quiz deleted'); aqmLoadHistory(); }
            catch (error) { Toast.show("Couldn't delete: " + error.message, 'danger', 'bi-exclamation-triangle-fill'); }
        }
    });
}

/* "View results" link available from the last question after submitting. */
document.addEventListener('click', event => {
    if (event.target.closest && event.target.closest('#aqmViewResultsBtn'))
        aqmShowResults();
});

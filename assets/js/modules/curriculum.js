/* ============================================================
   CURRICULUM.JS: per-program curriculum shown as a single-page PDF viewer
   Keys must match the program codes in assets/data/registration-options.json.
   file: null means the curriculum PDF is not available yet.
   Preview uses PDF.js (loaded in curriculum.html). Phones that can't
   render the preview still get the Download and Open buttons.
   ============================================================ */

const CURRICULA = {
    'BSA':       { title: 'Bachelor of Science in Accountancy', version: 'AY 2025-2026', file: '../../assets/pdfs/bsa.pdf' },
    'BS Entrep': { title: 'Bachelor of Science in Entrepreneurship', version: 'AY 2021-2022', file: '../../assets/pdfs/bsentrep.pdf' },
    'BSECE':     { title: 'Bachelor of Science in Electronics Engineering', version: 'BSECE-2021', file: '../../assets/pdfs/bsece.pdf' },
    'BSIE':      { title: 'Bachelor of Science in Industrial Engineering', version: 'BSIE-2021', file: '../../assets/pdfs/bsie.pdf' },
    'BSIT':      { title: 'Bachelor of Science in Information Technology', version: 'BSIT-2021', file: '../../assets/pdfs/bsit.pdf' },
    'BSIS':      { title: 'Bachelor of Science in Information Systems', version: 'AY 2023-2024', file: '../../assets/pdfs/bsis.pdf' },
    'BSCS':      { title: 'Bachelor of Science in Computer Science', version: 'AY 2023-2024', file: '../../assets/pdfs/bscs.pdf' },
    'BECEd':     { title: 'Bachelor of Early Childhood Education', version: 'BECEd-2022', file: '../../assets/pdfs/becd.pdf' },

    /* No curriculum PDF yet */
    'BSMA':      { title: 'Bachelor of Science in Management Accounting', version: '', file: null },
    'BSCpE':     { title: 'Bachelor of Science in Computer Engineering', version: '', file: null },
};

const CUR_ZOOM_MIN = 0.5;
const CUR_ZOOM_MAX = 3;
const CUR_ZOOM_STEP = 0.25;

const curState = {
    file: null,
    pdf: null,
    page: 1,
    zoom: 1,
    rotation: 0,
    renderTask: null,
    loadToken: 0,
    resizeTimer: null,
};

function curEl(id) { return document.getElementById(id); }

function renderEmptyState(message) {
    curEl('curProgram').textContent = 'No program selected';
    curEl('curVersion').textContent = '';
    curEl('curriculumContainer').innerHTML = `
        <div class="cur-empty glass">
            <i class="bi bi-journal-bookmark"></i>
            <p>${message}</p>
        </div>`;
}

function renderUnavailable(c) {
    curEl('curProgram').textContent = c.title;
    curEl('curVersion').textContent = '';
    curEl('curriculumContainer').innerHTML = `
        <div class="cur-empty glass">
            <i class="bi bi-hourglass-split"></i>
            <p>The curriculum for <strong>${c.title}</strong> is not available yet.</p>
        </div>`;
}

function renderProgram(code) {
    const c = CURRICULA[code];

    curState.file = null;
    curState.pdf = null;
    curState.page = 1;
    curState.zoom = 1;
    curState.rotation = 0;
    curState.loadToken++;

    if (!c) {
        renderEmptyState('Select a program above to view its curriculum.');
        return;
    }
    if (!c.file) {
        renderUnavailable(c);
        return;
    }

    curEl('curProgram').textContent = c.title;
    curEl('curVersion').textContent = c.version;
    curState.file = c.file;

    curEl('curriculumContainer').innerHTML = `
        <div class="curv glass">
            <div class="curv-stage" id="curStage">
                <div class="cur-viewer-status" id="curViewerStatus">Loading preview…</div>
                <canvas class="curv-canvas" id="curCanvas" hidden></canvas>
            </div>
            <div class="curv-nav">
                <button class="curv-btn" id="curPrev" aria-label="Previous page">
                    <i class="bi bi-chevron-left"></i>
                </button>
                <div class="curv-pager" id="curPager"></div>
                <button class="curv-btn" id="curNext" aria-label="Next page">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </div>
        </div>

        <div class="curv-tools">
            <button class="curv-btn" id="curZoomOut" aria-label="Zoom out" title="Zoom out">
                <i class="bi bi-zoom-out"></i>
            </button>
            <button class="curv-btn" id="curZoomIn" aria-label="Zoom in" title="Zoom in">
                <i class="bi bi-zoom-in"></i>
            </button>
            <button class="curv-btn" id="curFit" aria-label="Fit to width" title="Fit to width">
                <i class="bi bi-arrows-angle-contract"></i>
            </button>
            <button class="curv-btn" id="curRotate" aria-label="Rotate" title="Rotate">
                <i class="bi bi-arrow-clockwise"></i>
            </button>
        </div>

        <div class="curv-actions">
            <a class="curv-btn curv-btn-accent" href="${c.file}" download>
                <i class="bi bi-download"></i> Download
            </a>
            <a class="curv-btn" href="${c.file}" target="_blank" rel="noopener">
                <i class="bi bi-box-arrow-up-right"></i> Open
            </a>
        </div>`;

    bindCurControls();
    loadCurPdf(c.file);
}

function bindCurControls() {
    curEl('curPrev').addEventListener('click', () => goToPage(curState.page - 1));
    curEl('curNext').addEventListener('click', () => goToPage(curState.page + 1));
    curEl('curZoomOut').addEventListener('click', () => setZoom(curState.zoom - CUR_ZOOM_STEP));
    curEl('curZoomIn').addEventListener('click', () => setZoom(curState.zoom + CUR_ZOOM_STEP));
    curEl('curFit').addEventListener('click', () => { curState.zoom = 1; curState.rotation = 0; drawCurPage(); });
    curEl('curRotate').addEventListener('click', () => {
        curState.rotation = (curState.rotation + 90) % 360;
        drawCurPage();
    });

    /* Swipe left/right to change page, only when not zoomed in */
    const stage = curEl('curStage');
    let startX = null;
    stage.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => {
        if (startX === null || curState.zoom > 1) return;
        const dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) goToPage(curState.page + (dx < 0 ? 1 : -1));
    });
}

async function loadCurPdf(url) {
    const token = ++curState.loadToken;
    const status = curEl('curViewerStatus');

    if (!window.pdfjsLib) {
        status.textContent = 'Preview is not available here. Use the Open or Download buttons below.';
        return;
    }

    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument(url).promise;
        if (token !== curState.loadToken) return;

        curState.pdf = pdf;
        curState.page = 1;
        drawCurPage();
    } catch (err) {
        if (token !== curState.loadToken) return;
        status.textContent = 'Preview could not load. Use the Open or Download buttons below.';
    }
}

async function drawCurPage() {
    if (!curState.pdf) return;

    const canvas = curEl('curCanvas');
    const stage = curEl('curStage');
    const status = curEl('curViewerStatus');
    const ratio = window.devicePixelRatio || 1;

    if (curState.renderTask) {
        try { curState.renderTask.cancel(); } catch (e) { /* already finished */ }
    }

    const page = await curState.pdf.getPage(curState.page);
    const base = page.getViewport({ scale: 1, rotation: curState.rotation });
    const fitWidth = Math.max(stage.clientWidth - 24, 160);
    const cssScale = (fitWidth / base.width) * curState.zoom;
    const viewport = page.getViewport({ scale: cssScale * ratio, rotation: curState.rotation });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = Math.floor(viewport.width / ratio) + 'px';
    canvas.style.height = Math.floor(viewport.height / ratio) + 'px';
    canvas.hidden = false;
    status.hidden = true;

    curState.renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    try { await curState.renderTask.promise; } catch (e) { /* cancelled by a newer draw */ }

    updateCurControls();
}

function goToPage(n) {
    if (!curState.pdf || n < 1 || n > curState.pdf.numPages) return;
    curState.page = n;
    drawCurPage();
}

function setZoom(z) {
    curState.zoom = Math.min(CUR_ZOOM_MAX, Math.max(CUR_ZOOM_MIN, Math.round(z * 100) / 100));
    drawCurPage();
}

function updateCurControls() {
    const total = curState.pdf ? curState.pdf.numPages : 0;
    curEl('curPager').textContent =
        `Page ${curState.page} of ${total}  ·  ${Math.round(curState.zoom * 100)}%`;
    curEl('curPrev').disabled = curState.page <= 1;
    curEl('curNext').disabled = curState.page >= total;
    curEl('curZoomOut').disabled = curState.zoom <= CUR_ZOOM_MIN;
    curEl('curZoomIn').disabled = curState.zoom >= CUR_ZOOM_MAX;
}

/* Redraw at the new width when the screen rotates or resizes */
window.addEventListener('resize', () => {
    clearTimeout(curState.resizeTimer);
    curState.resizeTimer = setTimeout(() => {
        if (curState.pdf) drawCurPage();
    }, 300);
});

function initCurriculum() {
    const select = curEl('curProgramSelect');

    select.innerHTML = '<option value="">Select a program</option>' +
        Object.entries(CURRICULA).map(([code, d]) =>
            `<option value="${code}">${d.title}</option>`).join('');

    const saved = getSelectedProgram();
    const code = CURRICULA[saved] ? saved : '';
    select.value = code;
    renderProgram(code);

    select.addEventListener('change', e => {
        setSelectedProgram(e.target.value);
        renderProgram(e.target.value);
    });
}

// GRADES.JS — Enhanced v4

// Grade equivalent badge

function gradeEquivBadgeHtml(point) {
    if (point === null || point === undefined)
        return '';
    const row = GRADE_TABLE.slice().sort((a, b) => Math.abs(a.point - point) - Math.abs(b.point - point))[0];
    if (!row)
        return '';
    let cls = 'grade-equiv-badge-blue';
    if (row.point <= 1.75)
        cls = 'grade-equiv-badge-green';
    else if (row.point <= 2.75)
        cls = 'grade-equiv-badge-blue';
    else if (row.point === 3.00)
        cls = 'grade-equiv-badge-amber';
    else
        cls = 'grade-equiv-badge-red';
    return `<span class="grade-equiv-badge ${cls}">${escapeHtml(row.label)}</span>`;
}

// Data normalization lives in services/gwa.js (normalizeGradeRecord)

function syncGradesWithSubjects() {
    const semId = DB.getActiveSemesterId();
    const subjects = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    let allGrades = DB.getGrades().map(normalizeGradeRecord);
    subjects.forEach(s => {
        if (!allGrades.find(g => g.subjectId === s.id)) {
            allGrades.push({ subjectId: s.id, semesterId: semId, components: [] });
        }
    });
    allGrades.forEach(g => {
        if (!g.semesterId) {
            const sub = DB.getSubject(g.subjectId);
            g.semesterId = sub ? sub.semesterId : semId;
        }
    });
    DB.saveGrades(allGrades);
    return allGrades.filter(g => subjects.some(s => s.id === g.subjectId));
}

// Sparkline trend data (grading period based)

function getSparklineDatapoints(components) {
    const periodOrder = ['prelim', 'midterm', 'semi', 'pre-final', 'final', 'prefinal'];
    function periodRank(name) {
        const n = (name || '').toLowerCase();
        for (let i = 0; i < periodOrder.length; i++)
            if (n.includes(periodOrder[i]))
                return i;
        return 999;
    }
    const sorted = [...components].sort((a, b) => periodRank(a.name) - periodRank(b.name));
    const points = [];
    sorted.forEach(c => {
        const avg = componentAvgPct(c);
        if (avg !== null)
            points.push({ label: c.name, pct: Math.round(avg * 10) / 10 });
    });
    return points;
}

// Trend direction

function trendDirection(points) {
    if (!points || points.length < 2)
        return 'flat';
    const first = points[0].pct;
    const last = points[points.length - 1].pct;
    const diff = last - first;
    if (diff > 2)
        return 'up';
    if (diff < -2)
        return 'down';
    return 'flat';
}

// Init

function initGrades() {
    syncGradesWithSubjects();
    renderGradesOverview();
    renderGradeCards();
    renderGradeReferenceTable();
    renderGwaCalculator();
    const linkedSubjectId = new URLSearchParams(location.search).get('subject');
    if (linkedSubjectId && DB.getSubject(linkedSubjectId))
        setTimeout(() => openGradeModal(linkedSubjectId), 0);
}

// Overview (Current GWA) — full-width 3 stat blocks

function renderGradesOverview() {
    const semId = DB.getActiveSemesterId();
    const subjects = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const grades = syncGradesWithSubjects();
    const { rows, scoredRows, gwa } = computeSemesterGWA(subjects, grades);
    const totalSubjects = subjects.length;
    const scoredSubjects = scoredRows.length;
    let highestRow = null, lowestRow = null;
    if (scoredRows.length) {
        highestRow = scoredRows.reduce((best, r) => r.point < best.point ? r : best, scoredRows[0]);
        lowestRow = scoredRows.reduce((worst, r) => r.point > worst.point ? r : worst, scoredRows[0]);
    }
    const gwaEl = document.getElementById('gGwa');
    const gwaSubEl = document.getElementById('gGwaSub');
    const gwaStatusEl = document.getElementById('gGwaStatus');
    const gwaStatusSubEl = document.getElementById('gGwaStatusSub');
    if (gwaEl)
        gwaEl.textContent = gwa === null ? '--' : gwa.toFixed(2);
    if (gwaSubEl) {
        if (gwa === null) {
            gwaSubEl.textContent = '1.00–5.00 scale';
        }
        else {
            gwaSubEl.textContent = `${gwaLabel(gwa)} · 1.00–5.00 scale`;
        }
    }
    if (gwaStatusEl && gwaStatusSubEl) {
        if (scoredSubjects === 0) {
            gwaStatusEl.innerHTML = '';
            gwaStatusSubEl.textContent = 'Add assessments to compute GWA';
        }
        else if (scoredSubjects < totalSubjects) {
            gwaStatusEl.innerHTML = `<span class="grade-status-badge incomplete"><i class="bi bi-hourglass-split me-1"></i>Incomplete</span>`;
            gwaStatusSubEl.textContent = `Based on ${scoredSubjects} of ${totalSubjects} subject${totalSubjects !== 1 ? 's' : ''}`;
        }
        else {
            gwaStatusEl.innerHTML = `<span class="grade-status-badge complete"><i class="bi bi-check2-circle me-1"></i>All Subjects</span>`;
            gwaStatusSubEl.textContent = `Based on ${scoredSubjects} subject${scoredSubjects !== 1 ? 's' : ''}`;
        }
    }
    const hiNumEl = document.getElementById('gHighest');
    const hiSubEl = document.getElementById('gHighestSub');
    if (hiNumEl)
        hiNumEl.textContent = highestRow ? highestRow.point.toFixed(2) : '--';
    if (hiSubEl)
        hiSubEl.textContent = highestRow ? `${highestRow.subject.code} · ${highestRow.pct.toFixed(1)}%` : '—';
    const loNumEl = document.getElementById('gLowest');
    const loSubEl = document.getElementById('gLowestSub');
    if (loNumEl)
        loNumEl.textContent = lowestRow ? lowestRow.point.toFixed(2) : '--';
    if (loSubEl)
        loSubEl.textContent = lowestRow ? `${lowestRow.subject.code} · ${lowestRow.pct.toFixed(1)}%` : '—';
}

// SUBJECT CARDS — sparkline + inline grade badge

function renderGradeCards() {
    const wrap = document.getElementById('gradesWrap');
    if (wrap) wrap.removeAttribute('aria-busy');
    const semId = DB.getActiveSemesterId();
    const sem = DB.getActiveSemester();
    const subs = DB.getSubjects().filter(s => s.semesterId === semId && !s.archived);
    const grades = DB.getGrades().map(normalizeGradeRecord);
    if (!subs.length) {
        const msg = sem ? `No subjects yet for ${sem.schoolYear} • ${sem.name}. Add subjects in Schedule.` : 'Add subjects in Schedule to start tracking grades.';
        wrap.innerHTML = `<div class="col-12"><div class="glass card-pad text-center py-5 text-faint">${msg}</div></div>`;
        return;
    }
    wrap.innerHTML = subs.map(s => {
        const g = grades.find(x => x.subjectId === s.id) || { components: [] };
        const pct = computeSubjectFinalPct(g.components);
        const point = pct !== null ? percentToGWA(pct) : null;
        const totalWeight = sumWeights(g.components);
        const weightWarn = g.components.length && totalWeight !== 100;
        const collapseId = `gc-${s.id}`;
        let statusBadge = '';
        const hasComponents = g.components.length > 0;
        const hasAnyScores = hasComponents && g.components.some(c => c.assessments && c.assessments.some(a => assessmentPct(a) !== null));
        if (pct !== null) {
            if (isPassingPct(pct)) {
                statusBadge = `<span class="grade-pass-badge passing"><i class="bi bi-check-circle-fill"></i> Passing</span>`;
            }
            else {
                statusBadge = `<span class="grade-pass-badge failing"><i class="bi bi-exclamation-triangle-fill"></i> At Risk</span>`;
            }
        }
        else if (hasComponents && !hasAnyScores) {
            statusBadge = `<span class="grade-pass-badge no-data"><i class="bi bi-dash-circle"></i> No data</span>`;
        }
        const equivBadge = gradeEquivBadgeHtml(point);
        const sparkPoints = getSparklineDatapoints(g.components);
        const hasSparkline = sparkPoints.length >= 2;
        return `<div class="col-md-6 col-xl-4">
      <div class="grade-card hover-lift" style="border-left:3px solid ${s.color}">
        <!-- Card top: compact three-column layout -->
        <div class="grade-card-top">
          <div class="grade-card-left">
            <div class="grade-card-code" title="${escapeHtml(s.code)}">${escapeHtml(s.code)}</div>
            ${statusBadge ? `<div class="grade-card-status-row">${statusBadge}</div>` : ''}
          </div>
          <div class="grade-card-center">
            <div class="grade-card-pct">${pct === null ? '--' : pct.toFixed(1) + '%'}</div>
            <div class="grade-card-gwa">${point === null ? '—' : 'GWA ' + point.toFixed(2)}${equivBadge}</div>
            ${weightWarn ? `<div class="weight-warn-badge" title="Weights total ${totalWeight}%, not 100% — grade is normalised automatically"><i class="bi bi-exclamation-triangle-fill me-1"></i>${totalWeight}%</div>` : ''}
          </div>
          <div class="grade-card-actions">
            <button class="btn-icon btn-icon-xs" onclick="openGradeModal('${s.id}')" title="Edit grades"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon btn-icon-xs chev-toggle" data-bs-toggle="collapse" data-bs-target="#${collapseId}" title="Toggle details"><i class="bi bi-chevron-down"></i></button>
          </div>
        </div>
        ${hasSparkline ? renderSparklineHtml(sparkPoints) : ''}
        <div class="progress grade-card-bar"><div class="progress-bar" style="width:${Math.min(pct || 0, 100)}%;background:${pct !== null && !isPassingPct(pct) ? '#fb7185' : ''}"></div></div>
        <!-- Expanded detail -->
        <div class="collapse" id="${collapseId}">
          <div class="grade-card-detail">
            ${s.desc ? `<div class="text-faint mb-2" style="font-size:.76rem">${escapeHtml(s.desc)}</div>` : ''}
            ${g.components.length ? `
              <div class="d-flex flex-column gap-1 mb-2">
                ${g.components.map(c => {
            const ws = componentWeightedScore(c);
            const avg = componentAvgPct(c);
            const cPassing = avg !== null ? isPassingPct(avg) : null;
            return `<div class="d-flex justify-content-between align-items-center" style="font-size:.75rem">
                    <span class="text-soft">${escapeHtml(c.name)} <span class="text-faint">(${c.weight}%)</span></span>
                    <div class="d-flex gap-2 align-items-center">
                      <span style="color:${cPassing === null ? 'var(--text-faint)' : cPassing ? '#34d399' : '#fb7185'}">${avg === null ? '—' : avg.toFixed(1) + '%'}</span>
                      <span class="mono fw-bold" style="min-width:36px;text-align:right">${ws === null ? '—' : ws.toFixed(2)}</span>
                    </div>
                  </div>`;
        }).join('')}
              </div>
              ${pct !== null && !isPassingPct(pct) ? `<div class="grade-warning-box mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i>Below passing threshold (${PASSING_PCT}%). Current: ${pct.toFixed(1)}%</div>` : ''}
              ${weightWarn ? `<div class="text-faint mb-2" style="font-size:.68rem;color:rgb(var(--accent-2))"><i class="bi bi-exclamation-triangle me-1"></i>Weights total ${totalWeight}%, not 100%</div>` : ''}
            ` : `<div class="text-faint" style="font-size:.76rem">No components yet — tap <i class="bi bi-pencil"></i> to add.</div>`}
          </div>
        </div>
      </div>
    </div>`;
    }).join('');
}

// SVG Sparkline (inline, below grade display)

function renderSparklineHtml(points) {
    if (!points || points.length < 2)
        return '';
    const W = 280, H = 48, PL = 4, PR = 4, PT = 6, PB = 6;
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;
    const vals = points.map(p => p.pct);
    const minV = Math.max(0, Math.min(...vals) - 5);
    const maxV = Math.min(100, Math.max(...vals) + 5);
    const range = maxV - minV || 1;
    const toX = i => PL + (i / (points.length - 1)) * chartW;
    const toY = v => PT + (1 - (v - minV) / range) * chartH;
    const dir = trendDirection(points);
    const lineColor = dir === 'up' ? '#34d399' : dir === 'down' ? '#fb7185' : '#94a3b8';
    const dotColorFn = (pct) => isPassingPct(pct) ? '#34d399' : '#fb7185';
    const polyPts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.pct).toFixed(1)}`).join(' ');
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="grade-sparkline-svg" role="img" aria-label="Grade trend sparkline">`;
    svg += `<polyline points="${polyPts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    points.forEach((p, i) => {
        const cx = toX(i), cy = toY(p.pct);
        svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${dotColorFn(p.pct)}" stroke="var(--bg,#0a0d16)" stroke-width="1">`;
        svg += `<title>${escapeHtml(p.label)}: ${p.pct}%</title>`;
        svg += `</circle>`;
    });
    svg += `</svg>`;
    const dirIcon = dir === 'up' ? '<i class="bi bi-graph-up-arrow" style="color:#34d399"></i>' : dir === 'down' ? '<i class="bi bi-graph-down-arrow" style="color:#fb7185"></i>' : '<i class="bi bi-dash-lg" style="color:#94a3b8"></i>';
    return `<div class="grade-sparkline-wrap">
    <div class="grade-sparkline-label">${dirIcon} <span>${points[0].pct}% → ${points[points.length - 1].pct}%</span></div>
    ${svg}
  </div>`;
}

let gradeDraft = null, gradeDraftSubjectId = null;
const ASSESS_GRID = '1fr 56px 56px 52px 28px';

function openGradeModal(subjectId) {
    const s = DB.getSubject(subjectId);
    const grades = DB.getGrades().map(normalizeGradeRecord);
    const g = grades.find(x => x.subjectId === subjectId) || { subjectId, components: [] };
    gradeDraftSubjectId = subjectId;
    gradeDraft = { components: JSON.parse(JSON.stringify(g.components || [])) };
    if (!gradeDraft.components.length)
        gradeDraft.components.push({ id: DB.uid(), name: '', weight: '', assessments: [] });
    document.querySelector('#gradeModal .modal-title').textContent = `${s.code} — Grading Breakdown`;
    renderGradeModalBody();
    new bootstrap.Modal(document.getElementById('gradeModal')).show();
}

function renderGradeModalBody() {
    const body = document.getElementById('gradeModalBody');
    const finalPct = computeSubjectFinalPct(gradeDraft.components);
    const totalWeight = sumWeights(gradeDraft.components);
    const weightWarn = totalWeight !== 100 && totalWeight !== 0;
    const isPassing = finalPct !== null ? isPassingPct(finalPct) : null;
    body.innerHTML = `
    <p class="text-faint mb-3" style="font-size:.8rem">
      <strong>How it works:</strong> Create components (e.g., Quizzes 30%, Midterm 25%).
      Add assessments under each — enter the name, score, and total items.
      The system averages each component's assessments, applies the weight, and sums to a final grade.
    </p>
    <div id="componentAccordion" class="d-flex flex-column gap-3">
      ${gradeDraft.components.map((c, ci) => componentBlockHtml(c, ci)).join('')}
    </div>
    <button type="button" class="btn btn-ghost btn-sm mt-3 w-100" onclick="addComponent()">
      <i class="bi bi-plus-lg me-1"></i>Add Component
    </button>
    <div id="modalWeightWarn" class="mt-2 p-2 rounded" style="background:rgba(var(--accent-2),.1);font-size:.76rem;color:rgb(var(--accent-2));${weightWarn ? '' : 'display:none'}">
      ${weightWarn ? `<i class="bi bi-exclamation-triangle me-1"></i>Weights total <strong>${totalWeight}%</strong> — should add up to 100%.` : ''}
    </div>
    <div class="text-center mt-4 pt-3" style="border-top:1px solid var(--border)">
      <div class="text-faint" style="font-size:.68rem;text-transform:uppercase;letter-spacing:.07em">Computed Final Grade</div>
      <div class="stat-num" style="font-size:2rem;color:${isPassing === null ? 'var(--text)' : isPassing ? '#34d399' : '#fb7185'}" id="modalFinalPct">${finalPct === null ? '--' : finalPct.toFixed(2) + '%'}</div>
      <div class="text-faint" style="font-size:.8rem" id="modalFinalGwa">
        ${finalPct === null ? 'Add assessments to preview' : `GWA ${percentToGWA(finalPct).toFixed(2)} · ${gwaLabel(percentToGWA(finalPct))}`}
      </div>
      ${finalPct !== null ? `
        <div class="mt-1" id="modalPassStatus">
          ${isPassing
        ? `<span class="grade-pass-badge passing"><i class="bi bi-check-circle-fill"></i> Passing (≥${PASSING_PCT}%)</span>`
        : `<span class="grade-pass-badge failing"><i class="bi bi-exclamation-triangle-fill"></i> At Risk — ${(PASSING_PCT - finalPct).toFixed(1)}% below passing</span>`}
        </div>` : ''}
    </div>
    <div class="modal-actions"><button class="btn btn-accent w-100" onclick="saveGradeComponents()">
      <i class="bi bi-check2 me-1"></i>Save Grading Breakdown
    </button></div>`;
}

function componentBlockHtml(c, ci) {
    const avg = componentAvgPct(c);
    const ws = componentWeightedScore(c);
    return `<div class="comp-block" style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;overflow:hidden">
    <!-- Header: name + weight input-group + delete -->
    <div class="d-flex align-items-center gap-2 p-2" style="border-bottom:1px solid var(--border)">
      <input class="form-control form-control-sm" style="flex:1" placeholder="Component name (e.g., Quizzes)"
        value="${escapeHtml(c.name)}" oninput="gradeDraft.components[${ci}].name=this.value;refreshGradePreview()">
      <div class="input-group input-group-sm" style="width:88px;flex-shrink:0">
        <input type="number" min="0" max="100" step="1" class="form-control text-center" placeholder="Wt."
          value="${c.weight === 0 || c.weight === '' ? '' : c.weight}"
          oninput="gradeDraft.components[${ci}].weight=this.value===''?0:+this.value;refreshGradePreview()"
          title="Weight %">
        <span class="input-group-text" style="background: transparent; color: white; border: none;">%</span>
      </div>
      <button type="button" class="btn-icon btn-icon-sm" onclick="removeComponent(${ci})" title="Remove">
        <i class="bi bi-trash3" style="color:#fb7185"></i>
      </button>
    </div>
    <!-- Assessment column headers -->
    <div style="display:grid;grid-template-columns:${ASSESS_GRID};gap:5px;padding:6px 10px 3px;font-size:.66rem;color:var(--text-faint);font-weight:700;text-transform:uppercase;letter-spacing:.04em">
      <div>Assessment</div>
      <div class="text-center">Score</div>
      <div class="text-center">Out of</div>
      <div class="text-center">%</div>
      <div></div>
    </div>
    <!-- Assessment rows -->
    <div id="assessRows-${ci}">
      ${(c.assessments || []).map((a, ai) => assessmentRowHtml(ci, ai, a)).join('')}
    </div>
    <!-- Footer: add button + live avg/weighted -->
    <div class="d-flex align-items-center justify-content-between px-2 py-2" style="border-top:1px solid var(--border);margin-top:2px">
      <button type="button" class="btn btn-ghost btn-sm" onclick="addAssessment(${ci})" style="font-size:.74rem;padding:2px 9px">
        <i class="bi bi-plus-lg me-1"></i>Add
      </button>
      <div class="text-end" style="font-size:.74rem" id="compSummary-${ci}">
        ${compSummaryHtml(avg, ws)}
      </div>
    </div>
  </div>`;
}

function compSummaryHtml(avg, ws) {
    return `<span class="text-faint">Avg: </span><span class="mono fw-bold">${avg === null ? '—' : avg.toFixed(1) + '%'}</span>`
        + `<span class="text-faint ms-2">→ Weighted: </span><span class="mono fw-bold" style="color:rgb(var(--accent))">${ws === null ? '—' : ws.toFixed(2)}</span>`;
}

function assessmentRowHtml(ci, ai, a) {
    const pct = assessmentPct(a);
    const pctColor = pct === null ? 'var(--text-faint)' : isPassingPct(pct) ? 'rgb(52,211,153)' : 'rgb(251,113,133)';
    return `<div id="assessRow-${ci}-${ai}" style="display:grid;grid-template-columns:${ASSESS_GRID};gap:5px;padding:3px 10px;align-items:center">
    <input class="form-control form-control-sm" placeholder="e.g., Quiz 1"
      value="${escapeHtml(a.name || '')}"
      oninput="gradeDraft.components[${ci}].assessments[${ai}].name=this.value">
    <input type="number" min="0" step="0.01" class="form-control form-control-sm text-center" placeholder="0"
      value="${a.score === null ? '' : a.score}"
      oninput="onAssessInput(${ci},${ai},'score',this.value)">
    <input type="number" min="0" step="0.01" class="form-control form-control-sm text-center" placeholder="100"
      value="${a.totalItems === null ? '' : a.totalItems}"
      oninput="onAssessInput(${ci},${ai},'totalItems',this.value)">
    <div class="text-center mono" id="assessPct-${ci}-${ai}" style="font-size:.76rem;color:${pctColor}">
      ${pct === null ? '—' : pct.toFixed(1) + '%'}
    </div>
    <button type="button" class="btn-icon btn-icon-sm" onclick="removeAssessment(${ci},${ai})">
      <i class="bi bi-x-lg" style="font-size:.6rem"></i>
    </button>
  </div>`;
}

function onAssessInput(ci, ai, field, value) {
    const a = gradeDraft.components[ci].assessments[ai];
    a[field] = value === '' ? null : +value;
    const pct = assessmentPct(a);
    const pctEl = document.getElementById(`assessPct-${ci}-${ai}`);
    if (pctEl) {
        pctEl.textContent = pct === null ? '—' : pct.toFixed(1) + '%';
        pctEl.style.color = pct === null ? 'var(--text-faint)' : isPassingPct(pct) ? 'rgb(52,211,153)' : 'rgb(251,113,133)';
    }
    updateCompSummary(ci);
    refreshGradePreview();
}

function updateCompSummary(ci) {
    const c = gradeDraft.components[ci];
    const avg = componentAvgPct(c);
    const ws = componentWeightedScore(c);
    const el = document.getElementById(`compSummary-${ci}`);
    if (el)
        el.innerHTML = compSummaryHtml(avg, ws);
}

function addAssessment(ci) {
    gradeDraft.components[ci].assessments.push({ id: DB.uid(), name: '', score: null, totalItems: null });
    rerenderAssessRows(ci);
    updateCompSummary(ci);
    refreshGradePreview();
}

function removeAssessment(ci, ai) {
    gradeDraft.components[ci].assessments.splice(ai, 1);
    rerenderAssessRows(ci);
    updateCompSummary(ci);
    refreshGradePreview();
}

function rerenderAssessRows(ci) {
    const wrap = document.getElementById(`assessRows-${ci}`);
    if (wrap)
        wrap.innerHTML = (gradeDraft.components[ci].assessments || []).map((a, ai) => assessmentRowHtml(ci, ai, a)).join('');
}

function addComponent() {
    gradeDraft.components.push({ id: DB.uid(), name: '', weight: 0, assessments: [] });
    renderGradeModalBody();
}

function removeComponent(ci) {
    gradeDraft.components.splice(ci, 1);
    if (!gradeDraft.components.length)
        gradeDraft.components.push({ id: DB.uid(), name: '', weight: 0, assessments: [] });
    renderGradeModalBody();
}

function refreshGradePreview() {
    const finalPct = computeSubjectFinalPct(gradeDraft.components);
    const isPassing = finalPct !== null ? isPassingPct(finalPct) : null;
    const totalWeight = sumWeights(gradeDraft.components);
    const weightWarnEl = document.getElementById('modalWeightWarn');
    if (weightWarnEl) {
        const hasComponents = gradeDraft.components.length > 0;
        const warn = hasComponents && totalWeight !== 100 && totalWeight !== 0;
        weightWarnEl.style.display = warn ? '' : 'none';
        if (warn) weightWarnEl.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>Weights total <strong>${totalWeight}%</strong> \u2014 should add up to 100%.`;
    }
    const pctEl = document.getElementById('modalFinalPct');
    const gwaEl = document.getElementById('modalFinalGwa');
    const statusEl = document.getElementById('modalPassStatus');
    if (pctEl) {
        pctEl.textContent = finalPct === null ? '--' : finalPct.toFixed(2) + '%';
        pctEl.style.color = isPassing === null ? 'var(--text)' : isPassing ? '#34d399' : '#fb7185';
    }
    if (gwaEl)
        gwaEl.textContent = finalPct === null ? 'Add assessments to preview' : `GWA ${percentToGWA(finalPct).toFixed(2)} · ${gwaLabel(percentToGWA(finalPct))}`;
    if (statusEl) {
        if (finalPct === null) {
            statusEl.innerHTML = '';
        }
        else {
            statusEl.innerHTML = isPassing
                ? `<span class="grade-pass-badge passing"><i class="bi bi-check-circle-fill"></i> Passing (≥${PASSING_PCT}%)</span>`
                : `<span class="grade-pass-badge failing"><i class="bi bi-exclamation-triangle-fill"></i> At Risk — ${(PASSING_PCT - finalPct).toFixed(1)}% below passing</span>`;
        }
    }
}

let gcSaving = false;
function saveGradeComponents() {
    // Re-entrancy guard against a rapid double-click: the modal hide()
    // below is a non-blocking fade, so a second click could otherwise
    // push a duplicate grade record before the first one commits.
    if (gcSaving) return;
    gcSaving = true;
    const cleaned = gradeDraft.components
        .map((c, i) => ({
        id: c.id || DB.uid(), name: (c.name || '').trim() || `Component ${i + 1}`, weight: +c.weight || 0,
        assessments: (c.assessments || [])
            .filter(a => a.name || (a.score !== null && a.totalItems !== null))
            .map(a => ({ id: a.id || DB.uid(), name: (a.name || '').trim(), score: a.score, totalItems: a.totalItems }))
    })).filter(c => c.name.trim() || c.weight || c.assessments.length);
    const semId = DB.getActiveSemesterId();
    const grades = DB.getGrades().map(normalizeGradeRecord);
    const idx = grades.findIndex(g => g.subjectId === gradeDraftSubjectId);
    if (idx > -1) {
        grades[idx].components = cleaned;
        grades[idx].semesterId = grades[idx].semesterId || semId;
    }
    else
        grades.push({ subjectId: gradeDraftSubjectId, semesterId: semId, components: cleaned });
    DB.saveGrades(grades);
    const inst = bootstrap.Modal.getInstance(document.getElementById('gradeModal'));
    if (inst)
        inst.hide();
    if (typeof Toast !== 'undefined') {
        const savedWeight = sumWeights(cleaned);
        if (cleaned.length && savedWeight !== 100) {
            Toast.show(`Saved \u2014 note: weights total ${savedWeight}%, not 100%. Grade is normalised automatically.`, 'warn');
        } else {
            Toast.show('Grading breakdown saved');
        }
    }
    gradeDraft = null;
    gradeDraftSubjectId = null;
    renderGradesOverview();
    renderGradeCards();
    gcSaving = false;
}

// Grade reference table

function renderGradeReferenceTable() {
    const host = document.getElementById('gradeReferenceTable');
    if (!host)
        return;
    host.innerHTML = GRADE_TABLE.map(row => `
    <div class="ref-row">
      <div class="ref-col-grade"><span class="grade-badge">${row.point.toFixed(2)}</span></div>
      <div class="ref-col-range text-soft">${row.max === 100 ? `${row.min}–${row.max}%` : row.min === 0 ? `Below ${row.max + 1}%` : `${row.min}–${row.max}%`}</div>
      <div class="ref-col-meaning">${row.label}</div>
    </div>`).join('');
}

// GWA CALCULATOR — clearly labeled as manual utility

function renderGwaCalculator() {
    const wrap = document.getElementById('gwaCalcRows');
    if (!wrap)
        return;
    let rows = DB.getGwaCalcRows();
    if (!rows.length) {
        rows = [{ id: DB.uid(), label: '', units: '', grade: '' }];
        DB.saveGwaCalcRows(rows);
    }
    wrap.innerHTML = rows.map((r, i) => gwaCalcRowHtml(r, i)).join('');
    refreshGwaTotals(rows);
}

function gwaCalcRowHtml(r, i) {
    const gradeOptions = ['', '1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00', '5.00'];
    const sel = gradeOptions.map(v => `<option value="${v}" ${r.grade == v && v !== '' ? 'selected' : ''}>${v === '' ? 'Select grade' : v}</option>`).join('');
    return `<div class="gwa-input-row">
    <input class="form-control form-control-sm gwa-col-code" placeholder="e.g., HUM 1"
      value="${escapeHtml(r.label || '')}" oninput="updateGwaCalcRow(${i},'label',this.value)">
    <input type="number" min="0" step="0.5" class="form-control form-control-sm text-center gwa-col-units" placeholder="Uts."
      value="${r.units === '' ? '' : r.units}" oninput="updateGwaCalcRow(${i},'units',this.value)">
    <select class="form-select form-select-sm gwa-col-grade" onchange="updateGwaCalcRow(${i},'grade',this.value)">
      ${sel}
    </select>
    <button type="button" class="btn-icon btn-icon-sm" onclick="removeGwaCalcRow(${i})">
      <i class="bi bi-trash3" style="color:#fb7185"></i>
    </button>
  </div>`;
}

function updateGwaCalcRow(i, field, value) {
    const rows = DB.getGwaCalcRows();
    if (!rows[i])
        return;
    rows[i][field] = (field === 'units' || field === 'grade') ? (value === '' ? '' : +value) : value;
    DB.saveGwaCalcRows(rows);
    if (field === 'grade') {
        renderGwaCalculator();
    }
    else {
        refreshGwaTotals(rows);
    }
}

function refreshGwaTotals(rows) {
    if (!rows)
        rows = DB.getGwaCalcRows();
    let totalUnits = 0, weightedSum = 0, courseCount = 0;
    rows.forEach(r => {
        // A row counts only when it has real units and a real grade. Cloud sync stores blank
        // cells as 0, so a blank row must not be counted as a course after a round-trip.
        const u = +r.units || 0, gr = +r.grade || 0;
        if (u > 0 && gr > 0) {
            totalUnits += u;
            weightedSum += u * gr;
            courseCount++;
        }
    });
    const result = courseCount > 0 && totalUnits > 0 ? weightedSum / totalUnits : null;
    const passed = result !== null ? result <= 3.00 : null;
    document.getElementById('gwaCalcResult').textContent = result === null ? '--' : result.toFixed(2);
    const meaningEl = document.getElementById('gwaCalcResultMeaning');
    if (meaningEl) {
        meaningEl.textContent = result === null ? '' : gwaLabel(result);
        meaningEl.style.color = result === null ? 'var(--text-faint)' : passed ? 'rgb(52,211,153)' : 'rgb(251,113,133)';
    }
    const statusEl = document.getElementById('gwaCalcResultStatus');
    if (statusEl) {
        statusEl.textContent = result === null ? '' : passed ? 'PASSED' : 'FAILED';
        statusEl.style.color = result === null ? 'var(--text-faint)' : passed ? 'rgba(52,211,153,.7)' : 'rgba(251,113,133,.7)';
    }
    const totUnitsEl = document.getElementById('gwaTotalUnits');
    if (totUnitsEl)
        totUnitsEl.textContent = totalUnits;
    const totCoursesEl = document.getElementById('gwaTotalCourses');
    if (totCoursesEl)
        totCoursesEl.textContent = courseCount;
}

function addGwaCalcRow() {
    const rows = DB.getGwaCalcRows();
    rows.push({ id: DB.uid(), label: '', units: '', grade: '' });
    DB.saveGwaCalcRows(rows);
    renderGwaCalculator();
}

function removeGwaCalcRow(i) {
    const rows = DB.getGwaCalcRows();
    rows.splice(i, 1);
    DB.saveGwaCalcRows(rows.length ? rows : [{ id: DB.uid(), label: '', units: '', grade: '' }]);
    renderGwaCalculator();
}

function clearAllGwaRows() {
    DB.saveGwaCalcRows([{ id: DB.uid(), label: '', units: '', grade: '' }]);
    renderGwaCalculator();
}

// COPY GWA CARD AS IMAGE (Canvas API, no external libs)

function copyGwaCardAsImage() {
    const settings = DB.getSettings();
    const name = (settings && settings.name) ? settings.name : 'Student';
    const sem = DB.getActiveSemester();
    const semLabel = sem ? `${sem.name} · ${sem.schoolYear}` : 'Current Semester';
    const gwaEl = document.getElementById('gGwa');
    const gwaSubEl = document.getElementById('gGwaSub');
    const gwa = gwaEl ? gwaEl.textContent : '--';
    const gwaSub = gwaSubEl ? gwaSubEl.textContent : '';
    const W = 560, H = 220;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f1220');
    bg.addColorStop(1, '#1a1030');
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, W, H, 18);
    ctx.fill();
    const stripe = ctx.createLinearGradient(0, 0, W, 0);
    stripe.addColorStop(0, 'rgba(124,108,246,0.9)');
    stripe.addColorStop(1, 'rgba(79,140,255,0.9)');
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 0, W, 4);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(124,108,246,0.8)';
    ctx.fillText('STUDENT PLANNER', 28, 30);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 28, 56);
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(semLabel, 28, 76);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 92);
    ctx.lineTo(W - 28, 92);
    ctx.stroke();
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('CURRENT GWA', 28, 118);
    ctx.font = '800 56px monospace';
    const gwaGrad = ctx.createLinearGradient(0, 0, 200, 0);
    gwaGrad.addColorStop(0, 'rgba(124,108,246,1)');
    gwaGrad.addColorStop(1, 'rgba(79,140,255,1)');
    ctx.fillStyle = gwaGrad;
    ctx.fillText(gwa, 26, 176);
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(gwaSub, 28, 200);
    const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    ctx.font = '400 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    const dateW = ctx.measureText(dateStr).width;
    ctx.fillText(dateStr, W - 28 - dateW, H - 18);
    canvas.toBlob(blob => {
        if (!blob) {
            showGwaToast('Failed to generate image', true);
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gwa-${name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showGwaToast('Image downloaded!');
    }, 'image/png');
}

function showGwaToast(msg, isError) {
    const el = document.getElementById('gwaToast');
    if (!el)
        return;
    el.textContent = msg;
    el.className = 'gwa-toast' + (isError ? ' gwa-toast-error' : ' gwa-toast-visible');
    void el.offsetWidth;
    el.classList.add('gwa-toast-visible');
    setTimeout(() => { el.classList.remove('gwa-toast-visible', 'gwa-toast-error'); }, 2600);
}

// GWA and grade calculations (pure logic, no DOM). Philippine 1.00–5.00 scale.
// Single source of truth: the Grades page, Dashboard and Schedule all use these helpers.
const GRADE_TABLE = [
    { point: 1.00, min: 96.50, max: 100, label: 'Excellent' },
    { point: 1.25, min: 92.50, max: 96.49, label: 'Very Good' },
    { point: 1.50, min: 88.50, max: 92.49, label: 'Very Good' },
    { point: 1.75, min: 84.50, max: 88.49, label: 'Good' },
    { point: 2.00, min: 80.50, max: 84.49, label: 'Good' },
    { point: 2.25, min: 76.50, max: 80.49, label: 'Satisfactory' },
    { point: 2.50, min: 72.50, max: 76.49, label: 'Satisfactory' },
    { point: 2.75, min: 68.50, max: 72.49, label: 'Fair' },
    { point: 3.00, min: 64.50, max: 68.49, label: 'Fair' },
    { point: 5.00, min: 0, max: 64.49, label: 'Poor' },
];
const PASSING_PCT = 64.50;

// The table's bands are defined to 2 decimals (e.g. 96.49 / 96.50), so compare at 2 decimals.
// This also removes floating-point noise such as 14.499999999999998 vs 14.5.
function roundTo(n, dp) {
    const f = Math.pow(10, dp);
    return Math.round((n + Number.EPSILON) * f) / f;
}

function isNum(v) { return typeof v === 'number' && isFinite(v); }

function percentToGWA(pct) {
    if (!isNum(pct))
        return null;
    const p = roundTo(pct, 2);
    for (const row of GRADE_TABLE) {
        if (p >= row.min)
            return row.point;
    }
    return 5.00;
}

function isPassingPct(pct) {
    return isNum(pct) && roundTo(pct, 2) >= PASSING_PCT;
}

function gwaLabel(point) {
    if (!isNum(point))
        return '—';
    const row = GRADE_TABLE.slice().sort((a, b) => Math.abs(a.point - point) - Math.abs(b.point - point))[0];
    return row ? row.label : '—';
}

// Grade math

function assessmentPct(a) {
    if (!a || !isNum(a.score) || !isNum(a.totalItems) || a.totalItems <= 0 || a.score < 0)
        return null;
    return (a.score / a.totalItems) * 100;
}

function componentAvgPct(c) {
    const valid = ((c && c.assessments) || []).map(assessmentPct).filter(p => p !== null);
    if (!valid.length)
        return null;
    return valid.reduce((s, p) => s + p, 0) / valid.length;
}

function componentWeightedScore(c) {
    const avg = componentAvgPct(c);
    if (avg === null)
        return null;
    return (avg * (+c.weight || 0)) / 100;
}

// Final subject percentage. Components with no scores yet are left out and the result is
// normalised over the weight that HAS been scored, so it is always the weighted average of
// what the student has actually earned (identical to the plain weighted sum when the
// weights add up to 100 and everything is scored).
function computeSubjectFinalPct(components) {
    if (!components || !components.length)
        return null;
    const scored = components.filter(c => componentWeightedScore(c) !== null);
    if (!scored.length)
        return null;
    const weightedSum = scored.reduce((s, c) => s + componentWeightedScore(c), 0);
    const scoredWeight = scored.reduce((s, c) => s + (+c.weight || 0), 0);
    return scoredWeight > 0 ? (weightedSum * 100) / scoredWeight : null;
}

function sumWeights(components) { return (components || []).reduce((s, c) => s + (+c.weight || 0), 0); }

// Normalise a stored grade record in place (handles legacy single-score components).
function normalizeGradeRecord(g) {
    if (!Array.isArray(g.components))
        g.components = [];
    g.components.forEach(c => {
        if (!c.id)
            c.id = DB.uid();
        if (!c.name)
            c.name = '';
        if (c.weight === undefined || c.weight === null || isNaN(+c.weight))
            c.weight = 0;
        if (!Array.isArray(c.assessments)) {
            const oldScore = (c.rawScore !== null && c.rawScore !== undefined && c.rawScore !== '')
                ? { id: DB.uid(), name: 'Score', score: +c.rawScore, totalItems: c.totalItems != null ? +c.totalItems : null }
                : (c.score !== null && c.score !== undefined && c.score !== '')
                    ? { id: DB.uid(), name: 'Score', score: +c.score, totalItems: 100 }
                    : null;
            c.assessments = oldScore ? [oldScore] : [];
        }
        c.assessments.forEach(a => {
            if (!a.id)
                a.id = DB.uid();
            a.score = (a.score === '' || a.score === undefined || a.score === null || isNaN(+a.score)) ? null : +a.score;
            a.totalItems = (a.totalItems === '' || a.totalItems === undefined || a.totalItems === null || isNaN(+a.totalItems)) ? null : +a.totalItems;
        });
    });
    return g;
}

// Unit-weighted GWA for a list of subjects. `grades` is the full list of grade records.
// Only subjects that actually have scored components take part. Returns:
//   { rows: [{ subject, pct, point }], scoredRows, gwa }   (gwa is null when it cannot be computed)
function computeSemesterGWA(subjects, grades) {
    const rows = (subjects || []).map(s => {
        const g = (grades || []).find(x => x.subjectId === s.id);
        const pct = g ? computeSubjectFinalPct(normalizeGradeRecord(g).components) : null;
        return { subject: s, pct, point: pct !== null ? percentToGWA(pct) : null };
    });
    const scoredRows = rows.filter(r => r.point !== null);
    const totalUnits = scoredRows.reduce((s, r) => s + (+r.subject.units || 0), 0);
    const gwa = totalUnits > 0
        ? scoredRows.reduce((s, r) => s + r.point * (+r.subject.units || 0), 0) / totalUnits
        : null;
    return { rows, scoredRows, gwa };
}
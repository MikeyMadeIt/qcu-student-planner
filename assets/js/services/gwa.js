/* GWA and grade calculations (pure logic, no DOM). Philippine 1.00–5.00 scale. */
const GRADE_TABLE = [
    { point: 1.00, min: 99, max: 100, label: 'Excellent' },
    { point: 1.25, min: 96, max: 98, label: 'Outstanding' },
    { point: 1.50, min: 93, max: 95, label: 'Superior' },
    { point: 1.75, min: 90, max: 92, label: 'Very Good' },
    { point: 2.00, min: 87, max: 89, label: 'Good' },
    { point: 2.25, min: 84, max: 86, label: 'Satisfactory' },
    { point: 2.50, min: 81, max: 83, label: 'Fairly Satisfactory' },
    { point: 2.75, min: 78, max: 80, label: 'Fair' },
    { point: 3.00, min: 75, max: 77, label: 'Passing' },
    { point: 5.00, min: 0, max: 74, label: 'Failed' },
];
const PASSING_PCT = 75;

function percentToGWA(pct) {
    if (pct === null || pct === undefined || isNaN(pct))
        return null;
    for (const row of GRADE_TABLE) {
        if (pct >= row.min)
            return row.point;
    }
    return 5.00;
}

function gwaLabel(point) {
    if (point === null || point === undefined)
        return '—';
    const row = GRADE_TABLE.slice().sort((a, b) => Math.abs(a.point - point) - Math.abs(b.point - point))[0];
    return row ? row.label : '—';
}

/* ---- Grade math ---- */

function assessmentPct(a) {
    if (a.score === null || a.totalItems === null || a.totalItems === 0)
        return null;
    return (a.score / a.totalItems) * 100;
}

function componentAvgPct(c) {
    const valid = c.assessments.filter(a => assessmentPct(a) !== null);
    if (!valid.length)
        return null;
    return valid.reduce((s, a) => s + assessmentPct(a), 0) / valid.length;
}

function componentWeightedScore(c) {
    const avg = componentAvgPct(c);
    if (avg === null)
        return null;
    return (avg * (+c.weight || 0)) / 100;
}

function computeSubjectFinalPct(components) {
    if (!components || !components.length)
        return null;
    const scored = components.filter(c => componentWeightedScore(c) !== null);
    if (!scored.length)
        return null;
    return scored.reduce((s, c) => s + componentWeightedScore(c), 0);
}

function sumWeights(components) { return (components || []).reduce((s, c) => s + (+c.weight || 0), 0); }

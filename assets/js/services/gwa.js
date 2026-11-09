/* GWA and grade calculations (pure logic, no DOM). Philippine 1.00–5.00 scale. */
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
    const weightedSum = scored.reduce((s, c) => s + componentWeightedScore(c), 0);
    /* MAJ-04: normalise by the sum of weights that actually have scores so the
       result stays on a 0-100 scale even when the total weight != 100%.  When
       all weights sum to exactly 100 this is a no-op (division by 1). */
    const scoredWeight = scored.reduce((s, c) => s + (+c.weight || 0), 0);
    const totalWeight  = sumWeights(components);
    /* Use the proportion of the full declared weight that the scored components
       cover.  This prevents over- or under-inflation when weights sum to != 100
       while still producing a correct partial grade when some components are
       not yet entered. */
    const divisor = totalWeight > 0 ? scoredWeight / totalWeight : 1;
    return divisor > 0 ? weightedSum / divisor : null;
}

function sumWeights(components) { return (components || []).reduce((s, c) => s + (+c.weight || 0), 0); }

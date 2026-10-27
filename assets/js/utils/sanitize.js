/* Text sanitization helpers (ES module). */
export function normalizeText(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
}

export function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
}

/* DOM / text helpers (classic script — exposes globals used by all modules) */

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = (s == null) ? '' : String(s);
    return d.innerHTML;
}

/* Aliases used across different JS files */

window.escapeHtml = escHtml;

window.escHtml = escHtml;

function debounce(fn, wait = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

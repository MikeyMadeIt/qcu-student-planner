/* Shared "not yet implemented" card for student sidebar items that don't have a
   real feature behind them yet — the four "Soon" items (Announcements, AI
   Summarizer, AI Reviewer, Legal & Policies) and any AI Tools entry (AI Quiz
   Maker, AI Flashcard Maker, AI Study Assistant) that isn't built yet either.
   One reusable renderer instead of duplicating this card's markup on every page.
   Classic script (like core/layout.js) so plain <script> pages can call it inline. */
function initFeaturePlaceholder(config) {
    const mount = document.querySelector('[data-feature-placeholder]');
    if (!mount || !config) return;
    const { icon, title, badge, description } = config;
    mount.innerHTML = `
        <i class="bi ${icon} feature-placeholder-icon" aria-hidden="true"></i>
        <span class="feature-placeholder-tag">${badge || 'Coming Soon'}</span>
        <h2>${title}</h2>
        <p>${description}</p>
        <p class="feature-placeholder-note"><i class="bi bi-info-circle" aria-hidden="true"></i>This feature isn't available yet.</p>
        <button type="button" class="btn-ghost feature-placeholder-close" data-feature-close>
            <i class="bi bi-arrow-left" aria-hidden="true"></i> Back
        </button>`;
    const closeBtn = mount.querySelector('[data-feature-close]');
    closeBtn.addEventListener('click', () => {
        /* Prefer the browser's own history so this always lands back on whatever
           page the person actually came from; fall back to the dashboard only
           when there's nowhere to go back to (e.g. opened in a new tab). */
        if (history.length > 1)
            history.back();
        else
            location.href = 'dashboard.html';
    });
}
window.initFeaturePlaceholder = initFeaturePlaceholder;

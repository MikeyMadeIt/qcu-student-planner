// Shared "not yet implemented" card for student sidebar items that don't have a
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
        if (history.length > 1)
            history.back();
        else
            location.href = 'dashboard.html';
    });
}
window.initFeaturePlaceholder = initFeaturePlaceholder;

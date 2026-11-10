// Shared module for admin sections that are intentionally not implemented yet

import { requireAdmin } from './admin-guard.js';
import { mountAdminTopbar } from './admin-shared.js';

async function init() {
    const admin = await requireAdmin();
    if (!admin) return;

    const key = document.body.dataset.pageKey;
    renderShell(key, admin);
    mountAdminTopbar(admin);
}

init();

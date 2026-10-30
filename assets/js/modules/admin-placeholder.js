/* Shared module for admin sections that are intentionally not implemented yet
   (Rejected Accounts, Inbox, Support Tickets, Email Center, Announcements,
   Reports & Analytics, Settings — see the project setup doc for the build plan).
   This still runs the real admin guard (so the page is not reachable by anyone
   the database wouldn't otherwise allow in) and renders the shared shell/sidebar,
   it just never shows invented data in place of the real feature. */

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

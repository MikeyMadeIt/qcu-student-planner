/* Admin page guard (ES module). Import and call requireAdmin() before rendering any
   admin page content. This is a usability convenience only — the real security boundary
   is server-side RLS and is_admin(); this guard just avoids flashing admin UI/data at
   someone the database would refuse anyway. */

import { AdminService } from '../services/admin-service.js';

export async function requireAdmin() {
    const result = await AdminService.verifyAdminAccess();

    if (!result.ok) {
        sessionStorage.setItem('qcu.adminDeniedReason', result.message);
        location.replace('../auth/login.html');
        return null;
    }

    return result.data;
}

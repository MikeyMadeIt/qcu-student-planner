// Admin page guard (ES module). Import and call requireAdmin() before rendering any

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

// Supabase client singleton (ES module).

import { APP_CONFIG } from './config.js';

let client = null;

export function getSupabase() {
    if (client) return client;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('Supabase library failed to load. Check your internet connection and reload.');
    }

    client = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    return client;
}

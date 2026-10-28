/* Supabase client singleton (ES module).
   Requires the supabase-js UMD bundle to be loaded first via a <script> tag:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>
   That exposes window.supabase.createClient(). This module wraps it so every
   other module can `import { getSupabase } from '../core/supabase-client.js'`
   and always get the same client instance (same auth session, no duplicate sockets). */

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

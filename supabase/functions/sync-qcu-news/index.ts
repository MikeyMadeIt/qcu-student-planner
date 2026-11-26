import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { cors, corsPreflight, hasDisallowedOrigin } from '../_shared/cors.ts';

const QCU_API = 'https://qcu.edu.ph/wp-json/wp/v2';
const CATEGORIES = [{ id: 26, category: 'news' }, { id: 16, category: 'announcement' }];
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}
function plain(value: string | undefined) {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, '’')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '“').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(\d+);|&#x([\da-f]+);/gi, (_, decimal, hex) => {
      const codePoint = decimal ? Number(decimal) : parseInt(hex, 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint) : ' ';
    })
    .replace(/\s+/g, ' ').trim();
}
function validQcuUrl(value: unknown) {
  try { const u = new URL(String(value)); return u.protocol === 'https:' && u.hostname === 'qcu.edu.ph' ? u.toString() : null; }
  catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  if (hasDisallowedOrigin(req)) return json(req, 403, { error: 'This origin is not allowed.' });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed.' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(req, 500, { error: 'The news sync service is not configured.' });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const scheduledSecret = Deno.env.get('QCU_NEWS_CRON_SECRET');
  const scheduled = Boolean(scheduledSecret && req.headers.get('x-cron-secret') === scheduledSecret);
  if (!scheduled) {
    const bearer = req.headers.get('Authorization') || '';
    if (!bearer.toLowerCase().startsWith('bearer ')) return json(req, 401, { error: 'Sign in to refresh QCU publications.' });
    const jwt = bearer.slice(7);
    const { data: userData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !userData.user) return json(req, 401, { error: 'Your session has expired. Sign in again.' });
    const { data: profile } = await admin.from('profiles').select('account_status').eq('id', userData.user.id).maybeSingle();
    if (profile?.account_status !== 'approved') return json(req, 403, { error: 'An approved planner account is required.' });
  }

  const now = new Date();
  const { data: state } = await admin.from('qcu_news_sync_state').select('*').eq('id', true).maybeSingle();
  let force = false;
  let requestedPages = 1;
  if (!scheduled) {
    try { const body = await req.clone().json(); force = body?.force === true; requestedPages = Math.max(1, Math.min(5, Number(body?.pages) || 1)); } catch { /* empty body is fine */ }
  }
  const isDue = !state?.last_success_at || now.getTime() - Date.parse(state.last_success_at) > 30 * 60 * 1000;
  const manualCooldownElapsed = !state?.last_attempt_at || now.getTime() - Date.parse(state.last_attempt_at) > 5 * 60 * 1000;
  if (!scheduled && !(isDue || (force && manualCooldownElapsed))) return json(req, 200, { ok: true, skipped: true, last_success_at: state.last_success_at });
  const lockUntil = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const { data: claimed, error: lockError } = await admin.rpc('claim_qcu_news_sync', { p_now: now.toISOString(), p_lock_until: lockUntil });
  if (lockError) return json(req, 500, { error: 'Could not claim the news synchronization lock.' });
  if (!claimed) return json(req, 202, { ok: true, in_progress: true });

  try {
    const pages = scheduled ? 2 : requestedPages;
    const articles: Record<string, unknown>[] = [];
    for (const source of CATEGORIES) {
      for (let page = 1; page <= pages; page++) {
        const endpoint = new URL(`${QCU_API}/posts`);
        endpoint.search = new URLSearchParams({ categories: String(source.id), page: String(page), per_page: '50', _embed: 'wp:featuredmedia', _fields: 'id,date,modified,link,title,excerpt,featured_media,categories,_links,_embedded' }).toString();
        const response = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'QCU-Student-Planner/1.0 (public article metadata cache)' }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`QCU returned HTTP ${response.status} for ${source.category} page ${page}.`);
        const totalPages = Number(response.headers.get('X-WP-TotalPages'));
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error(`QCU returned an invalid ${source.category} response.`);
        for (const item of rows) {
          const articleUrl = validQcuUrl(item.link);
          const published = new Date(item.date);
          if (!articleUrl || !item.id || !plain(item.title?.rendered) || !Number.isFinite(published.getTime())) continue;
          const image = item._embedded?.['wp:featuredmedia']?.[0]?.source_url;
          articles.push({ external_id: item.id, article_url: articleUrl, title: plain(item.title.rendered),
            excerpt: plain(item.excerpt?.rendered) || null, featured_image_url: validQcuUrl(image),
            published_at: published.toISOString(), modified_at: item.modified ? new Date(item.modified).toISOString() : null,
            category: source.category, source_name: 'Quezon City University', synced_at: now.toISOString() });
        }
        if (rows.length < 50 || (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages)) break;
      }
    }
    const { error: upsertError } = await admin.from('qcu_news_articles').upsert(articles, { onConflict: 'article_url' });
    if (upsertError) throw new Error(`Could not store QCU articles: ${upsertError.message}`);
    const { error: stateError } = await admin.from('qcu_news_sync_state').update({ last_success_at: now.toISOString(), last_error: null, lock_until: null }).eq('id', true);
    if (stateError) throw new Error(`Articles stored, but sync status could not be updated: ${stateError.message}`);
    return json(req, 200, { ok: true, count: articles.length, last_success_at: now.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QCU synchronization failed.';
    await admin.from('qcu_news_sync_state').update({ last_error: message.slice(0, 500), lock_until: null }).eq('id', true);
    console.error('sync-qcu-news:', message);
    return json(req, 502, { error: 'QCU publications could not be refreshed. Previously cached articles remain available.' });
  }
});

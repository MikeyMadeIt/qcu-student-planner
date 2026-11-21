import { getSupabase } from '../core/supabase-client.js';

const DESKTOP_PAGE_SIZE = 6;
const COMPACT_PAGE_SIZE = 5;
const supabase = getSupabase();
let category = 'all';
let search = '';
let currentPage = 1;
let busy = false;
let reloadQueued = false;
let lastSyncCount = null;
let searchTimer;
let pageSize = getPageSize();
const grid = document.getElementById('newsGrid');
const pagination = document.getElementById('newsPagination');
const pageLabel = document.getElementById('newsPageLabel');
const newsCount = document.getElementById('newsCount');

function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value || ''; return el.innerHTML; }
function getPageSize() { return window.matchMedia('(min-width: 992px)').matches ? DESKTOP_PAGE_SIZE : COMPACT_PAGE_SIZE; }
function validUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'qcu.edu.ph' ? u.href : null; } catch { return null; } }
function date(value) { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' }) : ''; }
function renderSkeleton() { grid.innerHTML = Array.from({ length: pageSize }, () => '<div class="news-skeleton" aria-hidden="true"></div>').join(''); grid.setAttribute('aria-busy','true'); }
function renderArticle(row) {
  const link = validUrl(row.article_url);
  if (!link) return '';
  const image = validUrl(row.featured_image_url);
  const label = row.category === 'news' ? 'News' : 'Announcement';
  return `<article class="news-card${image ? ' has-image' : ''}">${image ? `<img class="news-image" src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div class="news-card-body"><span class="news-category">${label}</span><h2>${escapeHtml(row.title)}</h2>${row.excerpt ? `<p>${escapeHtml(row.excerpt)}</p>` : ''}<div class="news-meta"><span>${escapeHtml(date(row.published_at))} · Quezon City University</span><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Read Article <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a></div></div></article>`;
}
async function load(reset = false) {
  if (reset) currentPage = 1;
  if (busy) { reloadQueued = true; return; }
  busy = true;
  if (reset) { renderSkeleton(); pagination.hidden = true; }
  const offset = (currentPage - 1) * pageSize;
  let query = supabase.from('qcu_news_articles').select('external_id,article_url,title,excerpt,featured_image_url,published_at,modified_at,category,source_name', { count:'exact' }).order('published_at', { ascending:false }).range(offset, offset + pageSize - 1);
  if (category !== 'all') query = query.eq('category', category);
  if (search) query = query.ilike('title', `%${search.replace(/[%,()]/g, ' ')}%`);
  const { data, error, count } = await query;
  if (error) {
    grid.innerHTML = `<div class="news-empty"><i class="bi bi-wifi-off" aria-hidden="true"></i><p>Could not load cached QCU publications: ${escapeHtml(error.message)}</p></div>`;
    pagination.hidden = true;
    newsCount.textContent = '';
  } else {
    const html = (data || []).map(renderArticle).join('');
    if (reset && !html && lastSyncCount > 0) {
      grid.innerHTML = `<div class="news-empty">The sync processed ${lastSyncCount} QCU records, but no cached rows are visible to this account. Check that migration 0030_qcu_news.sql was applied and that the account is approved.</div>`;
    } else {
      const emptyText = search ? 'No QCU publications match this search.'
        : category !== 'all' ? 'No cached publications are available in this category yet.'
          : 'No cached QCU publications are available yet. Reload this page to try syncing again.';
      grid.innerHTML = html || `<div class="news-empty">${emptyText}</div>`;
    }
    const totalPages = Math.ceil((count || 0) / pageSize);
    newsCount.textContent = `${count || 0} ${count === 1 ? 'article' : 'articles'}`;
    pagination.hidden = totalPages <= 1;
    pageLabel.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    document.getElementById('newsPrevious').disabled = currentPage <= 1;
    document.getElementById('newsNext').disabled = currentPage >= totalPages;
  }
  grid.setAttribute('aria-busy','false'); busy = false;
  if (reloadQueued) { reloadQueued = false; await load(false); }
}
document.querySelectorAll('.news-filter').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.news-filter').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
  category = button.dataset.category; load(true);
}));
document.getElementById('newsSearch').addEventListener('input', event => {
  clearTimeout(searchTimer); searchTimer = setTimeout(() => { search = event.target.value.trim(); load(true); }, 250);
});
document.getElementById('newsPrevious').addEventListener('click', () => { if (currentPage > 1) { currentPage--; load(false); } });
document.getElementById('newsNext').addEventListener('click', () => { currentPage++; load(false); });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nextPageSize = getPageSize();
    if (nextPageSize !== pageSize) { pageSize = nextPageSize; load(true); }
  }, 150);
});

// Reloading the page requests a sync. The server enforces a five-minute
// cooldown and a database lock so reloads cannot cause repeated source fetches.
(async () => {
  try {
    const { data, error } = await supabase.functions.invoke('sync-qcu-news', { body: { pages: 1, force: true } });
    if (!error && Number.isFinite(data?.count)) lastSyncCount = data.count;
  } catch { /* Cached articles remain available if the sync endpoint is down. */ }
  await load(true);
})();

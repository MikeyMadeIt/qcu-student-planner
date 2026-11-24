import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const CLASSROOM_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
];

export function createAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('server configuration missing');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function configuredOrigins(): Set<string> {
  const configured = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  if (!configured) return new Set();

  const origins = configured.split(',').map(value => value.trim());
  if (!origins.length || origins.some(value => !value)) return new Set();
  const parsed = origins.map(value => {
    try {
      const url = new URL(value);
      const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password ||
          url.pathname !== '/' || url.search || url.hash || url.origin === 'null') return null;
      return url.origin;
    } catch {
      return null;
    }
  });
  if (parsed.some(origin => origin === null)) return new Set();
  return new Set(parsed as string[]);
}

function requestOrigin(req: Request): string | null {
  const value = req.headers.get('Origin');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedRequestOrigin(req: Request): string | null {
  const origin = requestOrigin(req);
  return origin && configuredOrigins().has(origin) ? origin : null;
}

export function isAllowedOrigin(req: Request): boolean {
  return allowedRequestOrigin(req) !== null;
}

// Requests without Origin are valid for server-to-server callers. A present but
// malformed or unlisted Origin is distinct and must not be treated as absent.
export function hasDisallowedOrigin(req: Request): boolean {
  return req.headers.has('Origin') && !isAllowedOrigin(req);
}

export function cors(req: Request) {
  const origin = requestOrigin(req);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (origin && configuredOrigins().has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function corsPreflight(req: Request) {
  return new Response(null, {
    status: isAllowedOrigin(req) ? 204 : 403,
    headers: cors(req),
  });
}

export function safeRedirect(result: string, returnOrigin?: string | null) {
  const base = Deno.env.get('APP_BASE_URL')?.trim();
  try {
    if (!base) throw new Error('missing');
    const root = new URL(base);
    const localHttp = root.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(root.hostname);
    if ((root.protocol !== 'https:' && !localHttp) || root.username || root.password ||
        !['/', '/qcu-student-planner/'].includes(root.pathname) || root.search || root.hash || root.origin === 'null' ||
        !configuredOrigins().has(root.origin)) throw new Error('invalid');
    if (!['connected', 'denied', 'not-approved', 'error'].includes(result)) throw new Error('invalid result');
    let destination = root;
    let hasTrustedReturnOrigin = false;
    if (returnOrigin) {
      try {
        const requested = new URL(returnOrigin);
        if (requested.origin === returnOrigin && requested.pathname === '/' && !requested.search && !requested.hash &&
            !requested.username && !requested.password && configuredOrigins().has(requested.origin)) {
          destination = requested;
          hasTrustedReturnOrigin = true;
        }
      } catch {
        // A malformed stored origin is not trusted; use the canonical fallback.
      }
    }
    // Preserve the canonical APP_BASE_URL path on fallback, while validated
    // transaction origins are exact Vercel origins rooted at /.
    const url = hasTrustedReturnOrigin
      ? new URL('/pages/app/classroom.html', destination)
      : new URL('pages/app/classroom.html', destination);
    url.searchParams.set('classroom_oauth', result);
    return new Response(null, {
      status: 303,
      headers: { Location: url.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch {
    return new Response('Google Classroom connection is unavailable.', {
      status: 503, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }
}

export async function authenticatedApprovedUser(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) return { error: 'Sign in to manage Google Classroom.', status: 401 } as const;
  const jwt = authorization.slice(7);
  const admin = createAdmin();
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return { error: 'Your Planner session has expired. Sign in again.', status: 401 } as const;
  const { data: profile, error: profileError } = await admin.from('profiles').select('account_status').eq('id', data.user.id).maybeSingle();
  if (profileError || profile?.account_status !== 'approved') return { error: 'An approved Planner account is required.', status: 403 } as const;
  return { admin, user: data.user } as const;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  let binary = '';
  new Uint8Array(digest).forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function randomBase64Url(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  data.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

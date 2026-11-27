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

export function isAllowedOrigin(req: Request): boolean {
  const origin = requestOrigin(req);
  return origin !== null && configuredOrigins().has(origin);
}

// Requests without Origin are valid for server-to-server callers. A present
// malformed or unlisted Origin is rejected separately by the caller.
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

export function corsPreflight(req: Request) {
  return new Response(null, {
    status: isAllowedOrigin(req) ? 204 : 403,
    headers: cors(req),
  });
}

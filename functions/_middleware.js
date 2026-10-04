const DEFAULT_BACKEND = 'https://backend.audiotechlabs.com';
const CONTROL_PREFIX = '/control-center';
const CONTROL_LOGIN = '/control-center/login/';
const CANONICAL_CONTROL_HOST = 'www.audiotechlabs.com';

function backendOrigin(env) {
  const value = env?.BACKEND_ORIGIN || DEFAULT_BACKEND;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid BACKEND_ORIGIN');
  }
  return url.origin;
}

function controlSecurityHeaders(headers) {
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return headers;
}

function redirectToLogin(url) {
  const target = new URL(CONTROL_LOGIN, url.origin);
  target.searchParams.set('next', url.pathname + url.search);
  return new Response(null, { status: 302, headers: controlSecurityHeaders(new Headers({ Location: target.toString() })) });
}

function unavailable() {
  return new Response('Control Center temporarily unavailable', {
    status: 503,
    headers: controlSecurityHeaders(new Headers({ 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' }))
  });
}

async function authorizeControlCenter(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  if (!/(?:^|;\s*)atl_session=/.test(cookie)) return { ok: false, status: 401 };
  const target = new URL('/auth/me', backendOrigin(env));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json', Cookie: cookie },
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal
    });
    if (response.status === 401) return { ok: false, status: 401 };
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return { ok: false, status: 503 };
    const value = await response.json();
    const user = value?.user;
    return { ok: user?.role === 'admin' && user?.mustChange !== true, status: user?.role === 'admin' ? 403 : 401 };
  } catch {
    return { ok: false, status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

async function securedNext(context) {
  const response = await context.next();
  const headers = controlSecurityHeaders(new Headers(response.headers));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const method = context.request.method.toUpperCase();
  const hostname = url.hostname.toLowerCase();
  const isDemoRoot = hostname === 'demo.audiotechlabs.com' && url.pathname === '/';
  const isControl = url.pathname === CONTROL_PREFIX || url.pathname.startsWith(CONTROL_PREFIX + '/');

  if ((method === 'GET' || method === 'HEAD') && isDemoRoot) {
    url.pathname = '/demo/';
    return Response.redirect(url.toString(), 302);
  }

  if (!isControl) return context.next();

  if (hostname.endsWith('.pages.dev') || hostname === 'audiotechlabs.com') {
    const target = new URL(url.toString());
    target.hostname = CANONICAL_CONTROL_HOST;
    target.protocol = 'https:';
    target.port = '';
    return Response.redirect(target.toString(), 302);
  }

  if (url.pathname === CONTROL_PREFIX) {
    const target = new URL(url.toString());
    target.pathname = CONTROL_PREFIX + '/';
    return Response.redirect(target.toString(), 302);
  }

  if (url.pathname === CONTROL_LOGIN || url.pathname.startsWith(CONTROL_LOGIN)) return securedNext(context);

  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: controlSecurityHeaders(new Headers({ Allow: 'GET, HEAD' })) });
  }

  const auth = await authorizeControlCenter(context.request, context.env);
  if (!auth.ok) return auth.status === 503 ? unavailable() : redirectToLogin(url);
  return securedNext(context);
}

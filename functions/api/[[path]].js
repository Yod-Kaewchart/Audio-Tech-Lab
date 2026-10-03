const DEFAULT_BACKEND = 'https://backend.audiotechlabs.com';

function backendOrigin(env) {
  const value = env?.BACKEND_ORIGIN || DEFAULT_BACKEND;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid BACKEND_ORIGIN');
  }
  return url.origin;
}

function noStore(headers = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
    ...headers
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const incoming = new URL(request.url);
  const origin = backendOrigin(env);
  if (incoming.origin === origin) return new Response('Proxy loop rejected', { status: 508 });
  const suffix = incoming.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  const target = new URL(suffix + incoming.search, origin);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-Host', incoming.host);
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  else headers.delete('X-Forwarded-For');
  const health = suffix === '/health';
  if (health) {
    headers.set('Cache-Control', 'no-store, no-cache');
    headers.set('Pragma', 'no-cache');
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
  }

  const controller = health ? new AbortController() : null;
  const timeout = health ? setTimeout(() => controller.abort(), 4500) : null;
  try {
    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: controller?.signal
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = request.body;
      init.duplex = 'half';
    }
    const upstream = await fetch(new Request(target, init));
    if (!health) return upstream;
    const responseHeaders = new Headers(upstream.headers);
    for (const [name, value] of Object.entries(noStore())) responseHeaders.set(name, value);
    // Keep the deadline active through the health body, not just its headers.
    const body = await upstream.arrayBuffer();
    return new Response([204, 205, 304].includes(upstream.status) ? null : body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch (error) {
    const timeoutFailure = controller?.signal.aborted;
    return Response.json(
      { error: timeoutFailure ? 'Backend health timeout' : 'Backend unavailable' },
      { status: timeoutFailure ? 504 : 502, headers: noStore({ 'Content-Type': 'application/json; charset=utf-8' }) }
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

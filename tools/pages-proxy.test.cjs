'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadProxy(t) {
  const source = path.resolve(__dirname, '..', 'functions', 'api', '[[path]].js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-pages-proxy-'));
  const target = path.join(dir, 'proxy.mjs');
  fs.copyFileSync(source, target);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return import(pathToFileURL(target).href + '?v=' + Date.now());
}

test('Pages proxy preserves method, query, body, cookies, range and streaming response headers', async t => {
  const { onRequest } = await loadProxy(t);
  const originalFetch = global.fetch;
  let received;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async request => {
    received = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: await request.text()
    };
    return new Response('xy', {
      status: 206,
      headers: {
        'Content-Type': 'audio/flac',
        'Content-Range': 'bytes 0-1/2',
        'Accept-Ranges': 'bytes',
        'Set-Cookie': 'atl_session=abc; Path=/; HttpOnly; Secure; SameSite=Lax',
        'Content-Disposition': "attachment; filename*=UTF-8''%E0%B9%84%E0%B8%9F%E0%B8%A5%E0%B9%8C.flac"
      }
    });
  };
  const request = new Request('https://demo.audiotechlabs.com/api/audio/abc?download=1', {
    method: 'POST',
    headers: {
      Cookie: 'atl_session=incoming',
      Origin: 'https://demo.audiotechlabs.com',
      Range: 'bytes=0-1',
      'Content-Type': 'application/octet-stream',
      'CF-Connecting-IP': '203.0.113.10'
    },
    body: 'payload'
  });
  const response = await onRequest({ request, env: { BACKEND_ORIGIN: 'https://backend.audiotechlabs.com' } });
  assert.equal(received.url, 'https://backend.audiotechlabs.com/audio/abc?download=1');
  assert.equal(received.method, 'POST');
  assert.equal(received.body, 'payload');
  assert.equal(received.headers.cookie, 'atl_session=incoming');
  assert.equal(received.headers.range, 'bytes=0-1');
  assert.equal(received.headers.origin, 'https://demo.audiotechlabs.com');
  assert.equal(received.headers['x-forwarded-proto'], 'https');
  assert.equal(received.headers['x-forwarded-host'], 'demo.audiotechlabs.com');
  assert.equal(received.headers['x-forwarded-for'], '203.0.113.10');
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-1/2');
  assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''/);
  assert.match(response.headers.get('set-cookie'), /atl_session=abc/);
  assert.equal(await response.text(), 'xy');
});

test('Health proxy strips validators, never caches and reports unreachable backend as JSON', async t => {
  const { onRequest } = await loadProxy(t);
  const originalFetch = global.fetch;
  let headers;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async request => {
    headers = request.headers;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
    });
  };
  const request = new Request('https://demo.audiotechlabs.com/api/health?nonce=fresh', {
    headers: { 'If-None-Match': 'old', 'If-Modified-Since': new Date(0).toUTCString() }
  });
  const response = await onRequest({ request, env: {} });
  assert.equal(headers.get('if-none-match'), null);
  assert.equal(headers.get('if-modified-since'), null);
  assert.equal(headers.get('cache-control'), 'no-store, no-cache');
  assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
  assert.equal(response.headers.get('cloudflare-cdn-cache-control'), 'no-store');

  global.fetch = async () => { throw new TypeError('tunnel unavailable'); };
  const offline = await onRequest({
    request: new Request('https://demo.audiotechlabs.com/api/health?nonce=offline'),
    env: {}
  });
  assert.equal(offline.status, 502);
  assert.equal(offline.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
  assert.deepEqual(await offline.json(), { error: 'Backend unavailable' });
});

test('Pages proxy rejects an unsafe backend origin configuration', async t => {
  const { onRequest } = await loadProxy(t);
  await assert.rejects(
    onRequest({
      request: new Request('https://demo.audiotechlabs.com/api/health'),
      env: { BACKEND_ORIGIN: 'http://127.0.0.1:8787' }
    }),
    /Invalid BACKEND_ORIGIN/
  );
});

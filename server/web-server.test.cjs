'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const { createWebServer } = require('./web-server.cjs');
test('Demo and API share one origin; proxy preserves authentication and hides non-public files', async t => {
  const backend = http.createServer((req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ path: req.url, cookie: req.headers.cookie, csrf: req.headers['x-csrf-token'] }));
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const web = createWebServer({ backendPort: backend.address().port });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => web.close(resolve)); if (backend.listening) await new Promise(resolve => backend.close(resolve)); });
  const base = 'http://127.0.0.1:' + web.address().port;
  const response = await fetch(base + '/api/auth/me', { headers: { Cookie: 'test=synthetic', 'X-CSRF-Token': 'test-only' } });
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { path: '/auth/me', cookie: 'test=synthetic', csrf: 'test-only' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const file of ['/server/auth.cjs', '/.git/config', '/tools/runtime/state.json', '/%2e%2e%5cserver/auth.cjs']) assert.equal((await fetch(base + file)).status, 404);
  const sitemap = await fetch(base + '/sitemap.xml'); assert.equal(sitemap.status, 200); assert.match(sitemap.headers.get('content-type'), /application\/xml/);
  const demo = await fetch(base + '/demo/'); assert.equal(demo.status, 200); assert.match(await demo.text(), /retry-connection/);
  await new Promise(resolve => backend.close(resolve));
  const offline = await fetch(base + '/api/health'); assert.equal(offline.status, 502); assert.ok((await offline.json()).error);
});

test('Proxy forwards attachment headers and delivers chunks before upstream finishes', async t => {
  let finish, cookie;
  const backend = http.createServer((req, res) => {
    cookie = req.headers.cookie;
    assert.equal(req.url, '/download/job/01%20-%20Track.flac');
    res.writeHead(200, { 'Content-Type': 'audio/flac', 'Content-Length': '8', 'Content-Disposition': 'attachment; filename="Track.flac"; filename*=UTF-8\'\'Track.flac' });
    finish = () => res.end('5678');
    res.write('1234');
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const web = createWebServer({ backendPort: backend.address().port });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => web.close(resolve)); await new Promise(resolve => backend.close(resolve)); });
  const response = await fetch('http://127.0.0.1:' + web.address().port + '/api/download/job/01%20-%20Track.flac', { headers: { Cookie: 'synthetic=session' }, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200); assert.equal(cookie, 'synthetic=session');
  assert.equal(response.headers.get('content-type'), 'audio/flac');
  assert.equal(response.headers.get('content-length'), '8');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="Track.flac"; filename*=UTF-8\'\'Track.flac');
  const reader = response.body.getReader(), first = await reader.read();
  assert.equal(Buffer.from(first.value).toString(), '1234');
  finish();
  let remainder = '';
  for (;;) { const part = await reader.read(); if (part.done) break; remainder += Buffer.from(part.value).toString(); }
  assert.equal(remainder, '5678');
});

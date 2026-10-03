'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), http = require('node:http');
const { createServer } = require('./upload-server.js');
const { createWebServer } = require('./web-server.cjs');
const healthHeaders = require('./health-headers.cjs');
const source = fs.readFileSync(path.join(__dirname, '../dist/demo/server-state.js'), 'utf8');
const contract = { ok: true, service: 'audio-tech-labs-demo', apiVersion: 1, authentication: true };
const reply = (url, value = {}, status = 200) => new Response(JSON.stringify({ ...contract, nonce: new URL(url, 'http://localhost').searchParams.get('nonce'), ...value }), { status, headers: { 'Content-Type': 'application/json' } });
const turn = () => new Promise(resolve => setImmediate(resolve));

// Execute the production server-state module with only the DOM and scheduler replaced.
function browser(fetchHealth) {
  const nodes = new Map(), timers = new Map(), intervals = [], events = new Map(), states = [];
  let timerId = 0;
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: false, disabled: false, textContent: '', value: '',
      addEventListener() {}, querySelector: child => node(selector + ' ' + child)
    });
    return nodes.get(selector);
  }
  Object.defineProperty(node('#server-status'), 'className', { set(value) { states.push(value); }, get() { return states.at(-1); } });
  const document = {
    documentElement: { dataset: {} },
    querySelector: node,
    hidden: false,
    addEventListener: (name, callback) => events.set(name, callback)
  };
  const windowEvents = [];
  const window = {
    addEventListener: (name, callback) => events.set(name, callback),
    dispatchEvent: event => windowEvents.push(event),
    demoServer: null,
    demoServerState: 'checking'
  };
  let now = Date.now();
  const context = vm.createContext({
    document, window, crypto, AbortController, Date: class extends Date { static now() { return now; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, ms) => intervals.push({ callback, ms }),
    fetch: fetchHealth
  });
  vm.runInContext(source, context);
  return {
    node, states, timers, intervals, events, windowEvents, document,
    advance: ms => { now += ms; },
    request: (url, options) => window.demoServer.request(url, options),
    reloadModule: () => vm.runInContext(source, context),
    status: () => node('#server-status span').textContent,
    state: () => vm.runInContext('window.demoServer.state', context),
    boot: () => vm.runInContext('window.demoServer.check()', context),
    check: visibleChecking => vm.runInContext('window.demoServer.check(' + JSON.stringify({ visibleChecking: !!visibleChecking }) + ')', context),
    whenOnline: () => vm.runInContext('window.demoServer.whenOnline()', context)
  };
}

test('Browser requires every contract field and a fresh nonce; errors and edge/static responses are offline', async t => {
  const cases = [
    ['valid backend', url => reply(url), true],
    ['missing ok', url => reply(url, { ok: undefined })],
    ['false ok', url => reply(url, { ok: false })],
    ['missing service', url => reply(url, { service: undefined })],
    ['wrong service', url => reply(url, { service: 'static-web' })],
    ['missing version', url => reply(url, { apiVersion: undefined })],
    ['wrong version', url => reply(url, { apiVersion: 2 })],
    ['string version', url => reply(url, { apiVersion: '1' })],
    ['missing authentication', url => reply(url, { authentication: undefined })],
    ['string authentication', url => reply(url, { authentication: 'true' })],
    ['missing nonce', url => reply(url, { nonce: undefined })],
    ['stale cached response', url => reply(url, { nonce: 'previous-request' })],
    ['invalid JSON', () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
    ['null JSON', () => new Response('null', { headers: { 'Content-Type': 'application/json' } })],
    ['static page', () => new Response('<html>Demo</html>', { headers: { 'Content-Type': 'text/html' } })],
    ['network unreachable', () => { throw new TypeError('fetch failed'); }],
    ['redirect rejected', () => { throw new TypeError('unexpected redirect'); }],
    ...[304, 500, 502, 503, 504, 522, 524].map(status => ['HTTP ' + status, url => status === 304 ? new Response(null, { status }) : reply(url, {}, status)])
  ];
  for (const [name, fetcher, online = false] of cases) await t.test(name, async () => {
    const page = browser(fetcher);
    await page.boot();
    assert.equal(page.status(), online ? 'SERVER ONLINE' : 'SERVER OFFLINE');
    if (!online) assert.ok(!page.states.includes('server-status is-online'), 'boot must never flash online');
    assert.equal(page.timers.size, 0);
  });
});

test('Stale health is rechecked before mutation; offline invalidates an older successful response', async () => {
  let healthCalls = 0, posts = 0, fail = false, finish;
  const page = browser((url, options) => {
    if (!url.includes('/health')) { posts++; return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); }
    healthCalls++;
    if (fail) throw new Error('unreachable');
    return reply(url);
  });
  await page.boot();
  page.advance(21000); fail = true;
  await assert.rejects(page.request('/api/auth/login', { method: 'POST' }), error => error.offline);
  assert.equal(posts, 0); assert.equal(healthCalls, 2); assert.equal(page.state(), 'offline');
  fail = false; await page.check();
  await page.request('/api/auth/login', { method: 'POST' }); assert.equal(posts, 1);
  page.reloadModule(); assert.equal(page.intervals.length, 1);
  page.document.hidden = true;
  const count = healthCalls; page.intervals[0].callback(); assert.equal(healthCalls, count);

  const racing = browser(url => new Promise(resolve => { finish = () => resolve(reply(url)); }));
  racing.events.get('offline')(); finish(); await turn();
  assert.equal(racing.state(), 'offline');
});

test('Background polling keeps the prior online UI stable, deduplicates requests and recovers automatically', async () => {
  const requests = [];
  let fail = false, pending = false, finish;
  const page = browser((url, options) => {
    requests.push({ url, options });
    if (pending) return new Promise(resolve => { finish = () => resolve(reply(url)); });
    if (fail) throw new TypeError('Backend offline');
    return reply(url);
  });
  await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  assert.equal(page.intervals.length, 1); assert.equal(page.intervals[0].ms, 15000);
  pending = true;
  const check = page.check();
  assert.equal(page.status(), 'SERVER ONLINE', 'background health checks must not flicker to checking');
  page.check();
  assert.equal(requests.length, 2, 'concurrent health checks must share one request');
  finish(); await check;
  assert.equal(page.status(), 'SERVER ONLINE');
  pending = false; fail = true;
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER OFFLINE');
  fail = false;
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  assert.equal(new Set(requests.map(r => r.url)).size, requests.length);
  for (const { url, options } of requests) {
    assert.match(url, /^\/api\/health\?nonce=/);
    assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Cache-Control'], 'no-store, no-cache');
    assert.equal(options.headers.Pragma, 'no-cache');
  }
  for (const event of ['online', 'pageshow', 'visibilitychange']) {
    const count = requests.length;
    page.events.get(event)(); await page.boot();
    assert.equal(requests.length, count + 1);
  }
});

test('Offline waiters resume only after a fresh successful health check', async () => {
  let offline = false, resumed = false;
  const page = browser(url => {
    if (offline) throw new TypeError('Backend stopped');
    return reply(url);
  });
  await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  offline = true;
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER OFFLINE');
  const waiting = page.whenOnline().then(() => { resumed = true; });
  await turn(); assert.equal(resumed, false);
  offline = false;
  page.intervals[0].callback(); await page.boot();
  await waiting;
  assert.equal(page.status(), 'SERVER ONLINE');
  assert.equal(resumed, true);
});

test('Timeout covers fetch and JSON body; late success cannot revive online and the next poll recovers', async t => {
  for (const stage of ['fetch', 'body']) await t.test(stage, async () => {
    let hang = false, finish, signal;
    const page = browser((url, options) => {
      signal = options.signal;
      if (!hang) return reply(url);
      const pending = new Promise(resolve => { finish = () => resolve(stage === 'fetch' ? reply(url) : { ...contract, nonce: new URL(url, 'http://localhost').searchParams.get('nonce') }); });
      return stage === 'fetch' ? pending : { ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: () => pending };
    });
    await page.boot(); hang = true;
    const check = page.check(true); await turn();
    assert.equal(page.status(), 'SERVER CHECKING');
    const deadline = [...page.timers.values()][0]; assert.equal(deadline.ms, 5000);
    deadline.callback(); assert.equal(await check, false);
    assert.equal(signal.aborted, true); assert.equal(page.status(), 'SERVER OFFLINE');
    finish(); await turn(); assert.equal(page.status(), 'SERVER OFFLINE');
    hang = false; page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  });
});

const listen = (server, port = 0) => new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const close = async server => { if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
function assertNoCache(response) {
  for (const [name, value] of Object.entries(healthHeaders)) assert.equal(response.headers.get(name), value, name);
}

test('Real runtime through public-host proxy: backend stop, offline reload, restart and automatic recovery', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-health-'));
  let backend, web;
  t.after(async () => {
    await close(web); await close(backend);
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'atl-health-')));
    fs.rmSync(root, { recursive: true, force: true });
  });
  backend = createServer({ root }); await listen(backend);
  const port = backend.address().port;
  const direct = await fetch('http://127.0.0.1:' + port + '/health');
  assertNoCache(direct);
  const health = await direct.json();
  for (const [name, value] of Object.entries(contract)) assert.equal(health[name], value);
  web = createWebServer({ backendPort: port, publicOrigin: 'https://demo.audiotechlabs.com' }); await listen(web);
  const base = 'http://127.0.0.1:' + web.address().port;
  const tunnelHeaders = { Host: 'demo.audiotechlabs.com', 'X-Forwarded-Proto': 'https' };
  // Use raw HTTP to supply the same Host/protocol headers as cloudflared;
  // Node's fetch does not consistently honor a custom Host header.
  const proxied = (url, options = {}) => new Promise((resolve, reject) => {
    const req = http.request(base + url, { headers: { ...options.headers, ...tunnelHeaders }, signal: options.signal }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
    });
    req.on('error', reject); req.end();
  });
  const healthy = await proxied('/api/health?nonce=test-runtime');
  assertNoCache(healthy); assert.equal((await healthy.json()).nonce, 'test-runtime');
  assert.equal(healthy.headers.get('strict-transport-security'), 'max-age=86400');
  assert.equal(healthy.headers.get('x-content-type-options'), 'nosniff');
  assert.match(healthy.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const page = browser(proxied); await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  await close(backend);
  const staticPage = await proxied('/demo/'); assert.equal(staticPage.status, 200); await staticPage.text();
  const offline = await proxied('/api/health?nonce=backend-stopped');
  assert.equal(offline.status, 502); assertNoCache(offline); await offline.text();
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER OFFLINE');
  const reloaded = browser(proxied); await reloaded.boot(); assert.equal(reloaded.status(), 'SERVER OFFLINE');
  assert.ok(!reloaded.states.includes('server-status is-online'));
  backend = createServer({ root }); await listen(backend, port);
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER ONLINE');
  reloaded.intervals[0].callback(); await reloaded.boot(); assert.equal(reloaded.status(), 'SERVER ONLINE');
  assert.equal(reloaded.state(), 'online');
});

test('Proxy preserves invalid health, prevents caching and bounds an unresponsive backend', async t => {
  let received, hang = false;
  const backend = http.createServer((req, res) => {
    received = req.headers;
    if (hang) return;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
    res.end(JSON.stringify({ authentication: true }));
  });
  await listen(backend);
  const web = createWebServer({ backendPort: backend.address().port }); await listen(web);
  t.after(async () => { await close(web); await close(backend); });
  const base = 'http://127.0.0.1:' + web.address().port;
  const response = await fetch(base + '/api/health?nonce=invalid', { headers: { 'If-None-Match': 'old', 'If-Modified-Since': new Date().toUTCString() } });
  assertNoCache(response); assert.deepEqual(await response.json(), { authentication: true });
  assert.equal(received['cache-control'], 'no-store, no-cache'); assert.equal(received.pragma, 'no-cache');
  assert.equal(received['if-none-match'], undefined); assert.equal(received['if-modified-since'], undefined);
  const page = browser((url, options) => fetch(base + url, options));
  await page.boot(); assert.equal(page.status(), 'SERVER OFFLINE');
  hang = true;
  const timeout = await fetch(base + '/api/health?nonce=timeout', { signal: AbortSignal.timeout(7000) });
  assert.equal(timeout.status, 504); assertNoCache(timeout); await timeout.text();
  page.intervals[0].callback(); await page.boot(); assert.equal(page.status(), 'SERVER OFFLINE');
});

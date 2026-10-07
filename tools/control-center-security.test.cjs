'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

async function middleware() {
  const source = fs.readFileSync(path.join(root, 'functions', '_middleware.js'), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

async function request(mod, url, { cookie = '', mode = 'admin' } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    if (mode === 'offline') throw new Error('offline');
    if (mode === 'unauthorized') return new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } });
    return Response.json({ user: { role: mode === 'user' ? 'user' : 'admin', mustChange: mode === 'mustChange' } });
  };
  try {
    const headers = cookie ? { Cookie: cookie } : {};
    return await mod.onRequest({
      request: new Request(url, { headers }),
      env: { BACKEND_ORIGIN: 'https://backend.audiotechlabs.com' },
      next: async () => new Response('STATIC', { status: 200, headers: { 'Content-Type': 'text/html' } })
    });
  } finally {
    globalThis.fetch = original;
  }
}

test('Control Center source and Pages artifacts stay identical', () => {
  assert.equal(fs.readFileSync(path.join(root, 'control-center', 'frontend', 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'dist', 'control-center', 'index.html'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'control-center', 'frontend', 'login', 'index.html'), 'utf8'), fs.readFileSync(path.join(root, 'dist', 'control-center', 'login', 'index.html'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'control-center', 'frontend', 'dashboard.js'), 'utf8'), fs.readFileSync(path.join(root, 'dist', 'control-center', 'dashboard.js'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'control-center', 'frontend', 'session.js'), 'utf8'), fs.readFileSync(path.join(root, 'dist', 'control-center', 'session.js'), 'utf8'));
  const routes = JSON.parse(fs.readFileSync(path.join(root, 'dist', '_routes.json'), 'utf8'));
  assert.ok(routes.include.includes('/control-center'));
  assert.ok(routes.include.includes('/control-center/*'));
  const dashboard = fs.readFileSync(path.join(root, 'control-center', 'frontend', 'index.html'), 'utf8');
  const session = fs.readFileSync(path.join(root, 'control-center', 'frontend', 'session.js'), 'utf8');
  const login = fs.readFileSync(path.join(root, 'control-center', 'frontend', 'login', 'index.html'), 'utf8');
  assert.ok(session.includes("location.replace('https://www.audiotechlabs.com/cdn-cgi/access/logout')"));
  assert.ok(dashboard.includes('src="/control-center/session.js"'));
  assert.ok(dashboard.includes('src="/control-center/dashboard.js"'));
  assert.ok(login.includes('function clearLoginPage()'));
  assert.ok(login.includes('event.persisted'));
});

test('Control Center edge gate is admin-only and fails closed', async () => {
  const mod = await middleware();
  let response = await request(mod, 'https://www.audiotechlabs.com/control-center/');
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /\/control-center\/login\//);

  response = await request(mod, 'https://www.audiotechlabs.com/control-center/login/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.ok(response.headers.get('content-security-policy'));
  assert.equal(response.headers.get('x-frame-options'), 'DENY');

  response = await request(mod, 'https://audio-tech-lab.pages.dev/control-center/');
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get('location')).hostname, 'www.audiotechlabs.com');

  const cookie = 'atl_session=' + 'a'.repeat(43);
  assert.equal((await request(mod, 'https://www.audiotechlabs.com/control-center/', { cookie, mode: 'admin' })).status, 200);
  assert.equal((await request(mod, 'https://www.audiotechlabs.com/control-center/', { cookie, mode: 'user' })).status, 302);
  assert.equal((await request(mod, 'https://www.audiotechlabs.com/control-center/', { cookie, mode: 'mustChange' })).status, 302);
  assert.equal((await request(mod, 'https://www.audiotechlabs.com/control-center/', { cookie, mode: 'offline' })).status, 503);
});

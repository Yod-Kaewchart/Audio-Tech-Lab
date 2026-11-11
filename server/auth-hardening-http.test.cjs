'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createServer } = require('./upload-server.js');

test('HTTP auth sends Retry-After and preserves CSRF, cookie and session behavior', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-auth-http-'));
  const server = createServer({ root, origin: 'https://tests.invalid', runJob: async () => '{}' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(route, data, headers = {}) {
    return fetch(base + route, { method: 'POST', headers: { Origin: 'https://tests.invalid', 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https', ...headers }, body: JSON.stringify(data) });
  }
  const registration = { username: 'rateuser', email: 'rateuser@example.invalid', password: 'Synthetic-Password-123' };
  assert.equal((await request('/auth/register', null)).status, 400);
  assert.equal((await request('/auth/register', registration)).status, 201);
  for (let i = 0; i < 4; i++) assert.equal((await request('/auth/register', registration)).status, 409);
  const blocked = await request('/auth/register', registration, { 'CF-Connecting-IP': '203.0.113.99' });
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  const login = await request('/auth/login', { username: registration.username, password: registration.password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie'); assert.match(cookie, /HttpOnly; SameSite=Strict/); assert.match(cookie, /; Secure/);
  const csrf = (await login.json()).csrf, session = cookie.split(';')[0];
  assert.equal((await request('/auth/logout', {}, { Cookie: session })).status, 403);
  assert.equal((await request('/auth/logout', {}, { Cookie: session, 'X-CSRF-Token': csrf })).status, 200);
  assert.equal((await fetch(base + '/auth/me', { headers: { Cookie: session, Origin: 'https://tests.invalid' } })).status, 401);
});

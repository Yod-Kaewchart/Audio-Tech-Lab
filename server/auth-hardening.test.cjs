'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createAuth } = require('./auth.cjs');
const { createScryptGate, createRegistrationLimiter } = require('./auth-limits.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, derive = async () => Buffer.alloc(64)) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-auth-hardening-'));
  const file = path.join(root, 'users.json');
  fs.writeFileSync(file, JSON.stringify({ users: [{ id: 'test-admin', username: 'admin', role: 'admin', status: 'active', version: 1, salt: 'test-salt', hash: Buffer.alloc(64).toString('hex') }] }));
  const auth = createAuth(root, { derive }); t.after(() => { auth.close(); fs.rmSync(root, { recursive: true, force: true }); });
  async function request(route, data, { cookie, csrf, method = 'POST', headers = {}, peer = '127.0.0.1' } = {}) {
    const req = { method, headers: { 'content-type': 'application/json', ...headers, ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) }, socket: { remoteAddress: peer } };
    const result = {}, res = { setHeader(name, value) { result[name] = value; } };
    try { await auth.handle(req, res, route, async () => data, (_res, status, body) => { result.status = status; result.body = body; }, () => new Set()); }
    catch (error) { result.status = error.status || 500; result.retryAfter = error.retryAfter; }
    return result;
  }
  return { auth, file, request };
}
const registration = n => ({ username: 'person' + n, email: 'person' + n + '@example.invalid', password: 'synthetic-password' });

test('concurrent duplicate registration reserves attempts before hashing and returns 429 with retry time', async t => {
  const pending = [], f = fixture(t, () => new Promise(resolve => pending.push(resolve)));
  const tasks = Array.from({ length: 8 }, () => f.request('/auth/register', registration(1)));
  await tick(); assert.equal(pending.length, 5);
  for (const resolve of pending) resolve(Buffer.alloc(64));
  const results = await Promise.all(tasks);
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 4);
  assert.equal(results.filter(r => r.status === 429 && r.retryAfter > 0).length, 3);
});
test('shared IP, spoofed forwarding headers and different identities do not share the five-attempt bucket', async t => {
  const f = fixture(t);
  for (let i = 0; i < 8; i++) {
    const result = await f.request('/auth/register', registration(i), { headers: { 'cf-connecting-ip': '203.0.113.' + i, 'x-forwarded-for': '192.0.2.' + i } });
    assert.equal(result.status, 201);
  }
  for (let i = 0; i < 4; i++) assert.equal((await f.request('/auth/register', registration(0))).status, 409);
  const blocked = await f.request('/auth/register', registration(0), { headers: { 'cf-connecting-ip': '198.51.100.99' } });
  assert.equal(blocked.status, 429); assert.ok(blocked.retryAfter > 0);
});
test('registration rate data has bounded identities, global flood limit and fixed expiry', () => {
  let time = 1000;
  const limiter = createRegistrationLimiter({ now: () => time, windowMs: 1000, perIdentity: 5, globalLimit: 3, maxEntries: 10 });
  limiter.reserve('a', 'a@example.invalid'); limiter.reserve('b', 'b@example.invalid'); limiter.reserve('c', 'c@example.invalid');
  assert.throws(() => limiter.reserve('d', 'd@example.invalid'), e => e.status === 429 && e.retryAfter === 1);
  time += 1000; limiter.reserve('d', 'd@example.invalid');
  const tiny = createRegistrationLimiter({ now: () => time, maxEntries: 2 }); tiny.reserve('a', 'a@example.invalid');
  assert.throws(() => tiny.reserve('b', 'b@example.invalid'), e => e.status === 429);
});
test('malformed registration flooding is bounded separately from legitimate registration', async t => {
  let hashes = 0; const f = fixture(t, async () => { hashes++; return Buffer.alloc(64); });
  for (let i = 0; i < 300; i++) assert.equal((await f.request('/auth/register', { username: '', email: '', password: '' })).status, 400);
  const blocked = await f.request('/auth/register', { username: '', email: '', password: '' });
  assert.equal(blocked.status, 429); assert.ok(blocked.retryAfter > 0); assert.equal(hashes, 0);
  assert.equal((await f.request('/auth/register', registration(1))).status, 201);
});
test('requests already over one identity quota do not consume the shared circuit breaker', () => {
  const limiter = createRegistrationLimiter({ perIdentity: 1, globalLimit: 2 });
  limiter.reserve('person', 'person@example.invalid');
  for (let i = 0; i < 5; i++) assert.throws(() => limiter.reserve('person', 'person@example.invalid'), e => e.status === 429);
  assert.doesNotThrow(() => limiter.reserve('another', 'another@example.invalid'));
});
test('shared scrypt gate bounds active and queued work and recovers from synchronous and async failures', async () => {
  const pending = []; let active = 0, peak = 0;
  const gate = createScryptGate({ concurrency: 2, maxWaiting: 2, derive: () => {
    active++; peak = Math.max(peak, active);
    return new Promise((resolve, reject) => pending.push({ resolve: () => { active--; resolve(Buffer.alloc(64)); }, reject: () => { active--; reject(new Error('synthetic failure')); } }));
  } });
  const tasks = Array.from({ length: 4 }, () => gate('synthetic', 'salt'));
  await assert.rejects(gate('synthetic', 'salt'), e => e.status === 429 && e.retryAfter === 1);
  await tick(); assert.equal(pending.length, 2); pending[0].resolve(); pending[1].reject();
  const failure = assert.rejects(tasks[1], /synthetic failure/); await tick(); assert.equal(pending.length, 4);
  pending[2].resolve(); pending[3].resolve(); await Promise.all([tasks[0], tasks[2], tasks[3], failure]);
  assert.equal(peak, 2);
  const syncFailure = createScryptGate({ concurrency: 1, maxWaiting: 1, derive: () => { throw new Error('sync failure'); } });
  await assert.rejects(syncFailure('x', 's'), /sync failure/); await assert.rejects(syncFailure('x', 's'), /sync failure/);
});
test('authentication rejects excess queued scrypt work and resumes after capacity returns', async t => {
  const pending = [], gate = createScryptGate({ concurrency: 1, maxWaiting: 1, derive: () => new Promise(resolve => pending.push(resolve)) });
  const f = fixture(t, gate), login = () => f.request('/auth/login', { username: 'admin', password: 'synthetic-password' });
  const first = login(), second = login(), excess = login(); await tick();
  const overloaded = await excess; assert.equal(overloaded.status, 429); assert.equal(overloaded.retryAfter, 1);
  assert.equal(pending.length, 1); pending[0](Buffer.alloc(64)); await tick();
  assert.equal(pending.length, 2); pending[1](Buffer.alloc(64));
  assert.deepEqual((await Promise.all([first, second])).map(result => result.status), [200, 200]);
});
test('scrypt queue flooding does not exhaust the work budget for later users', async t => {
  let release, calls = 0;
  const gate = createScryptGate({ concurrency: 1, maxWaiting: 0, derive: () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(Buffer.alloc(64)) });
  const f = fixture(t, gate), first = f.request('/auth/register', registration(0)); await tick();
  for (let i = 1; i <= 310; i++) {
    const rejected = await f.request('/auth/register', registration(i));
    assert.equal(rejected.status, 429); assert.equal(rejected.retryAfter, 1);
  }
  release(Buffer.alloc(64)); assert.equal((await first).status, 201); await tick();
  assert.equal((await f.request('/auth/register', registration(400))).status, 201);
});
test('login, password change, registration and admin creation use the shared derive interface; disabled sessions are revoked', async t => {
  let derives = 0; const f = fixture(t, async () => { derives++; return Buffer.alloc(64); });
  let login = await f.request('/auth/login', { username: 'admin', password: 'synthetic-password' });
  assert.equal(login.status, 200); assert.match(login['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  const cookie = login['Set-Cookie'].split(';')[0], csrf = login.body.csrf;
  assert.equal((await f.request('/auth/password', { currentPassword: 'synthetic-password', newPassword: 'different-synthetic-password' }, { cookie })).status, 403);
  assert.equal((await f.request('/auth/password', { currentPassword: 'synthetic-password', newPassword: 'different-synthetic-password' }, { cookie, csrf })).status, 200);
  assert.equal((await f.request('/auth/register', registration(12))).status, 201);
  assert.equal((await f.request('/admin/users', { username: 'newaccount', password: 'synthetic-password' }, { cookie, csrf })).status, 201);
  assert.equal(derives, 5);
  const db = JSON.parse(fs.readFileSync(f.file, 'utf8')); db.users[0].status = 'disabled'; fs.writeFileSync(f.file, JSON.stringify(db));
  assert.equal((await f.request('/auth/me', undefined, { cookie, method: 'GET' })).status, 401);
  db.users[0].status = 'active'; fs.writeFileSync(f.file, JSON.stringify(db));
  assert.equal((await f.request('/auth/me', undefined, { cookie, method: 'GET' })).status, 401);
});
test('disabling an account during password verification prevents the pending login', async t => {
  let release; const f = fixture(t, () => new Promise(resolve => { release = resolve; }));
  const pending = f.request('/auth/login', { username: 'admin', password: 'synthetic-password' });
  await tick(); const db = JSON.parse(fs.readFileSync(f.file, 'utf8')); db.users[0].status = 'disabled'; fs.writeFileSync(f.file, JSON.stringify(db));
  release(Buffer.alloc(64)); const result = await pending;
  assert.equal(result.status, 403); assert.equal(result['Set-Cookie'], undefined);
});
test('password changes revoke other sessions, enforce admin authorization and retain expiry and idle limits', async t => {
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const f = fixture(t), signIn = async username => {
    const result = await f.request('/auth/login', { username, password: 'synthetic-password' });
    assert.equal(result.status, 200); return { cookie: result['Set-Cookie'].split(';')[0], csrf: result.body.csrf };
  };
  const first = await signIn('admin'), second = await signIn('admin');
  const change = { currentPassword: 'synthetic-password', newPassword: 'different-synthetic-password' };
  assert.equal((await f.request('/auth/password', change, first)).status, 200);
  assert.equal((await f.request('/auth/me', undefined, { ...second, method: 'GET' })).status, 401);
  assert.equal((await f.request('/auth/me', undefined, { ...first, method: 'GET' })).status, 200);
  assert.equal((await f.request('/auth/register', registration(20))).status, 201);
  const user = await signIn('person20');
  assert.equal((await f.request('/admin/users', { username: 'blockedadmin', password: 'synthetic-password' }, user)).status, 403);
  now += 31 * 60 * 1000;
  assert.equal((await f.request('/auth/me', undefined, { ...first, method: 'GET' })).status, 401);
  const fresh = await signIn('admin');
  for (let i = 0; i < 16; i++) { now += 29 * 60 * 1000; assert.equal((await f.request('/auth/me', undefined, { ...fresh, method: 'GET' })).status, 200); }
  now += 17 * 60 * 1000;
  assert.equal((await f.request('/auth/me', undefined, { ...fresh, method: 'GET' })).status, 401);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { createServer } = require('./upload-server.js');
const until = async check => { const deadline = Date.now() + 5000; while (!check()) { if (Date.now() > deadline) throw new Error('Queue stalled'); await new Promise(resolve => setTimeout(resolve, 10)); } };
test('HTTP queue is shared, private, idempotent and protects files while processing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-queue-api-')), origin = 'https://queue-tests.invalid', controls = [];
  let current = 0, maximum = 0;
  const runner = () => { current++; maximum = Math.max(maximum, current); return new Promise(resolve => controls.push(resolve)).finally(() => current--); };
  const server = createServer({ root, origin, runJob: runner });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function req(route, user, data, csrf = true) {
    const headers = { Origin: origin, 'X-Forwarded-Proto': 'https' };
    if (user) { headers.Cookie = user.cookie; if (csrf) headers['X-CSRF-Token'] = user.csrf; }
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  async function login(username, password) {
    const result = await req('/auth/login', null, { username, password }); assert.equal(result.status, 200);
    const user = { cookie: result.cookie.split(';')[0], csrf: result.data.csrf };
    const changed = await req('/auth/password', user, { currentPassword: password, newPassword: 'Changed-' + username + '-Password-123' }); assert.equal(changed.status, 200); user.csrf = changed.data.csrf;
    return user;
  }
  function file(userId, name) { const id = crypto.randomUUID(), dir = path.join(root, 'uploads', userId); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, id + '-' + name), 'test'); return id; }
  try {
    const temporary = fs.readFileSync(path.join(root, 'tools', 'runtime', 'security', 'first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    const alice = await login('yod', temporary);
    assert.equal((await req('/admin/users', alice, { username: 'bobby', password: 'Temporary-Password-123' })).status, 201);
    const bob = await login('bobby', 'Temporary-Password-123');
    const users = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'runtime', 'security', 'users.json'), 'utf8')).users;
    const a = file(users.find(x => x.username === 'yod').id, 'a.wav'), b = file(users.find(x => x.username === 'bobby').id, 'b.wav'), c = file(users.find(x => x.username === 'yod').id, 'c.wav');
    const input = { fileId: a, requestId: crypto.randomUUID() }, first = await req('/analyze', alice, input); assert.equal(first.status, 202);
    await until(() => controls.length === 1);
    const second = await req('/export', bob, { fileId: b, format: 'wav', boundaries: [] }); assert.equal(second.status, 202); assert.equal(second.data.position, 1);
    assert.equal((await req('/jobs')).status, 401);
    assert.equal((await req('/jobs/' + second.data.jobId, alice)).status, 404);
    assert.equal((await req('/jobs/' + second.data.jobId + '/cancel', alice, {})).status, 404);
    assert.equal((await req('/jobs', alice)).data.jobs.length, 1);
    assert.equal((await req('/jobs/' + second.data.jobId + '/cancel', bob, {}, false)).status, 403);
    assert.equal((await req('/upload/remove', alice, { fileId: a })).status, 409);
    assert.equal((await req('/upload/remove', bob, { fileId: b })).status, 409);
    assert.equal((await req('/analyze', alice, input)).data.jobId, first.data.jobId);
    assert.equal((await req('/analyze', alice, { ...input, fileId: c })).status, 409);
    controls[0](JSON.stringify({ duration: 3 })); await until(() => controls.length === 2);
    const third = await req('/analyze', alice, { fileId: c }); assert.equal(third.status, 202);
    assert.equal((await req('/jobs/' + second.data.jobId + '/cancel', bob, {})).status, 409);
    assert.equal((await req('/jobs/' + third.data.jobId + '/cancel', alice, {})).data.status, 'cancelled');
    assert.equal((await req('/upload/remove', alice, { fileId: c })).status, 200);
    controls[1](JSON.stringify({ jobId: crypto.randomUUID(), files: [], success: 0, failed: 0 })); await until(() => current === 0);
    assert.equal((await req('/jobs/' + first.data.jobId, alice)).data.result.duration, 3);
    assert.equal((await req('/jobs/' + second.data.jobId, bob)).data.status, 'succeeded');
    assert.equal(maximum, 1); assert.equal(controls.length, 2);
  } finally { for (const resolve of controls) resolve('{}'); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});

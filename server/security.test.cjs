'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { createServer } = require('./upload-server.js');
test('Authentication and file ownership security, including real Analyze/Export', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-security-'));
  const origin = 'https://security-tests.invalid';
  let server, base, availableDisk = 100e9;
  function wave() {
    const samples = 24000, buffer = Buffer.alloc(44 + samples * 2);
    buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
    buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) buffer.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + 2 * i);
    return buffer;
  }
  async function start() {
    server = createServer({ root, origin, freeBytes: () => availableDisk, storageLimits: { userBytes: 1e9 }, scripts: fs.existsSync(path.join(__dirname, 'analyze-upload.py')) ? __dirname : path.resolve(__dirname, '..', '..', '..', 'server') });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  }
  async function request(route, client, data, extra = {}) {
    const headers = { Origin: origin, 'X-Forwarded-Proto': 'https', ...extra.headers };
    if (client?.cookie) headers.Cookie = client.cookie;
    if (client?.csrf && extra.csrf !== false) headers['X-CSRF-Token'] = client.csrf;
    let body;
    if (data !== undefined) { headers['Content-Type'] = Buffer.isBuffer(data) ? 'application/octet-stream' : 'application/json'; body = Buffer.isBuffer(data) ? data : JSON.stringify(data); }
    const response = await fetch(base + route, { method: data === undefined ? 'GET' : 'POST', headers, body, redirect: 'manual' });
    const content = response.headers.get('content-type') || '';
    return { status: response.status, data: content.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer()), cookie: response.headers.get('set-cookie') };
  }
  async function completed(client, response) {
    assert.equal(response.status, 202);
    const deadline = Date.now() + 30000;
    let job = response.data;
    while (['queued', 'running'].includes(job.status)) {
      if (Date.now() > deadline) throw new Error('Audio job did not complete');
      await new Promise(resolve => setTimeout(resolve, 30));
      const polled = await request('/jobs/' + job.jobId, client);
      assert.equal(polled.status, 200); job = polled.data;
    }
    assert.equal(job.status, 'succeeded', job.error);
    return { status: 200, data: job.result };
  }
  async function login(username, password) {
    const response = await request('/auth/login', null, { username, password }); assert.equal(response.status, 200);
    assert.match(response.cookie, /HttpOnly/); assert.match(response.cookie, /SameSite=Strict/); assert.match(response.cookie, /Secure/);
    return { cookie: response.cookie.split(';')[0], csrf: response.data.csrf };
  }
  async function change(client, currentPassword, newPassword) {
    const response = await request('/auth/password', client, { currentPassword, newPassword }); assert.equal(response.status, 200); client.csrf = response.data.csrf;
  }
  try {
    const legacyId = crypto.randomUUID(), legacyJob = crypto.randomUUID();
    fs.mkdirSync(path.join(root, 'uploads'), { recursive: true }); fs.writeFileSync(path.join(root, 'uploads', legacyId + '-legacy.wav'), wave());
    fs.mkdirSync(path.join(root, 'exports', legacyJob), { recursive: true }); fs.writeFileSync(path.join(root, 'exports', legacyJob, 'old.wav'), wave());
    await start();
    const temporary = fs.readFileSync(path.join(root, 'tools', 'runtime', 'security', 'first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    let admin, alice, bob, uploaded, job;
    await t.test('Anonymous requests cannot list files, download, upload, analyze, export, or delete', async () => {
      assert.equal((await request('/health')).status, 200);
      for (const route of ['/uploads', '/download/' + legacyJob + '/old.wav', '/auth/me']) assert.equal((await request(route)).status, 401);
      for (const route of ['/upload/init', '/upload/chunk', '/upload/complete', '/upload/remove', '/analyze', '/export', '/export/delete']) assert.equal((await request(route, null, {})).status, 401);
      assert.equal((await request('/auth/login', null, { username: 'yod', password: 'wrong' })).status, 401);
      assert.equal((await request('/auth/login', null, { username: 'yod', password: temporary }, { headers: { Origin: 'https://attacker.invalid' } })).status, 403);
    });
    await t.test('Passwords are hashed, temporary password change is required, CSRF is enforced', async () => {
      const db = fs.readFileSync(path.join(root, 'tools', 'runtime', 'security', 'users.json'), 'utf8'); assert.ok(!db.includes(temporary));
      admin = await login('yod', temporary);
      assert.equal((await request('/uploads', admin)).status, 403);
      assert.equal((await request('/auth/password', admin, { currentPassword: temporary, newPassword: 'Owner-Changed-Password-123' }, { csrf: false })).status, 403);
      await change(admin, temporary, 'Owner-Changed-Password-123');
      assert.ok(!fs.existsSync(path.join(root, 'tools', 'runtime', 'security', 'first-login.txt')));
      const files = (await request('/uploads', admin)).data.files; assert.equal(files.length, 1); assert.equal(files[0].fileId, legacyId);
      assert.equal((await request('/download/' + legacyJob + '/old.wav', admin)).status, 200);
    });
    await t.test('Public registration creates only normal users with their chosen password', async () => {
      const registered = await request('/auth/register', null, { username: 'publicuser', email: 'PublicUser@Example.com', password: 'Public-Password-123', role: 'admin' }, { headers: { 'CF-Connecting-IP': '192.0.2.10' } });
      assert.equal(registered.status, 201); assert.equal(registered.data.user.role, 'user'); assert.equal(registered.data.user.mustChange, false);
      assert.equal((await request('/auth/register', null, { username: 'publicuser', email: 'other@example.com', password: 'Another-Password-123' }, { headers: { 'CF-Connecting-IP': '192.0.2.11' } })).status, 409);
      assert.equal((await request('/auth/register', null, { username: 'x', email: 'bad', password: 'short' }, { headers: { 'CF-Connecting-IP': '192.0.2.12' } })).status, 400);
      const publicUser = await login('publicuser', 'Public-Password-123');
      const publicByEmail = await login('publicuser@example.com', 'Public-Password-123'); assert.ok(publicByEmail.cookie);
      assert.equal((await request('/uploads', publicUser)).status, 200);
      assert.equal((await request('/admin/users', publicUser)).status, 403);
      const db = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'runtime', 'security', 'users.json'), 'utf8'));
      assert.equal(db.users.find(x => x.username === 'publicuser').role, 'user');
    });
    await t.test('Only the administrator can create accounts; users must set their own passwords', async () => {
      for (const username of ['alice', 'bobby']) assert.equal((await request('/admin/users', admin, { username, password: 'Temporary-Password-123', role: 'admin' })).status, 201);
      alice = await login('alice', 'Temporary-Password-123'); bob = await login('bobby', 'Temporary-Password-123');
      assert.equal((await request('/upload/init', alice, { name: 'one.wav', size: 20 })).status, 403);
      await change(alice, 'Temporary-Password-123', 'Alice-New-Password-123'); await change(bob, 'Temporary-Password-123', 'Bobby-New-Password-123');
      assert.equal((await request('/admin/users', alice, { username: 'other', password: 'Temporary-Password-123' })).status, 403);
      assert.equal((await request('/admin/users', alice)).status, 403);
      assert.equal((await request('/uploads', alice)).data.files.length, 0);
    });
    await t.test('Upload sessions and completed files cannot be accessed by another account', async () => {
      const wav = wave(), init = await request('/upload/init', alice, { name: 'security-test.wav', size: wav.length }); assert.equal(init.status, 200);
      const headers = { 'X-Upload-Id': init.data.uploadId, 'X-Chunk-Index': '0' };
      assert.equal((await request('/upload/chunk', bob, wav, { headers })).status, 404);
      assert.equal((await request('/upload/complete', bob, { uploadId: init.data.uploadId })).status, 404);
      assert.equal((await request('/upload/chunk', alice, wav, { headers })).status, 200);
      const complete = await request('/upload/complete', alice, { uploadId: init.data.uploadId }); assert.equal(complete.status, 200); uploaded = complete.data.fileId;
      assert.equal((await request('/uploads', alice)).data.files.length, 1); assert.equal((await request('/uploads', bob)).data.files.length, 0);
      for (const route of ['/upload/remove', '/analyze', '/export']) assert.equal((await request(route, bob, { fileId: uploaded, format: 'wav', boundaries: [] })).status, 404);
      assert.equal((await request('/upload/remove', alice, { fileId: uploaded }, { csrf: false })).status, 403);
      assert.equal((await request('/uploads', alice, undefined, { headers: { Origin: 'https://attacker.invalid' } })).status, 403);
    });
    await t.test('Real audio Analyze, Export and download work for the owner only', async () => {
      const analysis = await completed(alice, await request('/analyze', alice, { fileId: uploaded })); assert.equal(analysis.status, 200); assert.equal(analysis.data.duration, 3); assert.ok(Array.isArray(analysis.data.detections));
      const output = await completed(alice, await request('/export', alice, { fileId: uploaded, format: 'wav', boundaries: [1.5] })); assert.equal(output.status, 200); assert.equal(output.data.success, 2); job = output.data.jobId;
      assert.equal((await request(output.data.files[0].url, alice)).status, 200);
      assert.equal((await request(output.data.files[0].url, bob)).status, 404);
      assert.equal((await request('/export/delete', bob, { jobId: job })).status, 404);
      assert.equal((await request('/export/delete', alice, { jobId: job })).status, 200);
      for (const [format, boundaries] of [['flac', []], ['wav', []], ['flac', [1.5]]]) {
        const exported = await completed(alice, await request('/export', alice, { fileId: uploaded, format, boundaries }));
        assert.equal(exported.data.success, boundaries.length + 1);
        const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
        const ownerId = users.find(user => user.username === 'alice').id;
        for (const file of exported.data.files) {
          assert.equal(path.extname(file.name), '.' + format);
          const downloaded = await request(file.url, alice);
          assert.equal(downloaded.status, 200);
          assert.deepEqual(downloaded.data, fs.readFileSync(path.join(root, 'exports', ownerId, exported.data.jobId, file.name)));
          assert.equal(downloaded.data.subarray(0, 4).toString(), format === 'flac' ? 'fLaC' : 'RIFF');
        }
        assert.equal((await request('/export/delete', alice, { jobId: exported.data.jobId })).status, 200);
      }
      assert.equal((await request('/upload/remove', alice, { fileId: uploaded })).status, 200);
      assert.equal((await request('/uploads', alice)).data.files.length, 0);
    });
    await t.test('Quota and changing disk space reject uploads before writing, and limit real exports', async () => {
      assert.equal((await request('/upload/init', alice, { name: 'large.wav', size: 1e9 + 1 })).status, 413);
      availableDisk = 5e9 + 100;
      assert.equal((await request('/upload/init', alice, { name: 'full.wav', size: 101 })).status, 507);
      availableDisk = 100e9;
      const init = await request('/upload/init', alice, { name: 'reserved.wav', size: 20 }); assert.equal(init.status, 200);
      availableDisk = 5e9 + 19;
      const chunk = await request('/upload/chunk', alice, Buffer.alloc(20), { headers: { 'X-Upload-Id': init.data.uploadId, 'X-Chunk-Index': '0' } });
      assert.equal(chunk.status, 507);
      assert.equal((await request('/storage', alice)).data.usedBytes, 0);
      availableDisk = 5e9 + 1024;
      const legacy = (await request('/uploads', admin)).data.files[0];
      const submitted = await request('/export', admin, { fileId: legacy.fileId, format: 'wav', boundaries: [] }); assert.equal(submitted.status, 202);
      let job = submitted.data; const deadline = Date.now() + 30000;
      while (['queued', 'running'].includes(job.status)) { assert.ok(Date.now() < deadline); await new Promise(resolve => setTimeout(resolve, 30)); job = (await request('/jobs/' + job.jobId, admin)).data; }
      assert.equal(job.status, 'failed'); assert.match(job.error, /Export/);
      assert.equal((await request('/storage', admin)).data.reservedBytes, 0);
      availableDisk = 100e9;
    });
    await t.test('Logout revokes the session; invalid login attempts are rate limited', async () => {
      assert.equal((await request('/auth/logout', bob, {})).status, 200); assert.equal((await request('/uploads', bob)).status, 401);
      for (let i = 0; i < 8; i++) assert.equal((await request('/auth/login', null, { username: 'nonexistent', password: 'incorrect' }, { headers: { 'CF-Connecting-IP': '192.0.2.200' } })).status, 401);
      assert.equal((await request('/auth/login', null, { username: 'nonexistent', password: 'incorrect' }, { headers: { 'CF-Connecting-IP': '192.0.2.200' } })).status, 429);
    });
    await t.test('Accounts and ownership survive a server restart; old sessions are invalidated', async () => {
      await new Promise(resolve => server.close(resolve)); await start();
      assert.equal((await request('/uploads', admin)).status, 401);
      admin = await login('yod', 'Owner-Changed-Password-123');
      assert.equal((await request('/uploads', admin)).data.files.length, 1);
      alice = await login('alice', 'Alice-New-Password-123'); assert.equal((await request('/uploads', alice)).data.files.length, 0);
    });
  } finally { if (server?.listening) await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});

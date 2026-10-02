'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { createServer } = require('./upload-server.js');
const { RETENTION } = require('./file-lifecycle.cjs');
const { ActivityStore } = require('./activity-store.cjs');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function fixture(runJob) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-history-')), origin = 'https://history-tests.invalid';
  let server;
  function runner(script, args) {
    const kind = path.basename(script);
    if (kind === 'preview-upload.py') {
      const file = path.join(args[1], args[2] + '.flac'); fs.writeFileSync(file, 'fLaC');
      return Promise.resolve(JSON.stringify({ name: path.basename(file), size: 4 }));
    }
    if (kind === 'export-upload.py' || kind === 'merge-upload.py') {
      const jobId = crypto.randomUUID(), target = path.join(args.at(-1), jobId);
      fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'track.wav'), 'RIFF');
      return Promise.resolve(JSON.stringify({ jobId, files: [{ name: 'track.wav', size: 4 }], success: 1 }));
    }
    return runJob ? runJob(script, args) : Promise.resolve(JSON.stringify({ duration: 3, waveform: ['PRIVATE-LARGE-RESULT'], boundaries: [1] }));
  }
  async function start() {
    server = createServer({ root, origin, runJob: runner });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  }
  await start();
  async function req(route, user, data) {
    const headers = { Origin: origin, 'X-Forwarded-Proto': 'https' };
    if (user) { headers.Cookie = user.cookie; headers['X-CSRF-Token'] = user.csrf; }
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  async function login(username, password, change = false) {
    const result = await req('/auth/login', null, { username, password }); assert.equal(result.status, 200);
    const user = { cookie: result.cookie.split(';')[0], csrf: result.data.csrf };
    if (change) {
      const changed = await req('/auth/password', user, { currentPassword: password, newPassword: 'Changed-' + username + '-Password-123' });
      assert.equal(changed.status, 200); user.csrf = changed.data.csrf;
    }
    return user;
  }
  const temporary = fs.readFileSync(path.join(root, 'tools/runtime/security/first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
  let admin = await login('yod', temporary, true);
  assert.equal((await req('/admin/users', admin, { username: 'bobby', password: 'Temporary-Password-123' })).status, 201);
  let bob = await login('bobby', 'Temporary-Password-123', true);
  const users = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'), 'utf8')).users;
  const aid = users.find(u => u.username === 'yod').id, bid = users.find(u => u.username === 'bobby').id;
  function file(owner, name, id = crypto.randomUUID()) {
    const directory = path.join(root, 'uploads', owner); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, id + '-' + name), 'audio'); return id;
  }
  function age(owner, id) {
    const directory = path.join(root, 'uploads', owner), name = fs.readdirSync(directory).find(n => n.startsWith(id + '-'));
    const time = new Date(Date.now() - RETENTION - 1000); fs.utimesSync(path.join(directory, name), time, time);
  }
  async function done(route, user, input) {
    const submitted = await req(route, user, input); assert.equal(submitted.status, 202);
    let job = submitted.data;
    for (let i = 0; ['queued', 'running'].includes(job.status); i++) {
      assert.ok(i < 500); await tick();
      const polled = await req('/jobs/' + job.jobId, user); assert.equal(polled.status, 200); job = polled.data;
    }
    assert.equal(job.status, 'succeeded'); return job;
  }
  return { root, req, file, age, done, aid, bid, get admin() { return admin; }, get bob() { return bob; },
    async restartWithJobs(jobs) {
      await new Promise(resolve => server.close(resolve));
      fs.writeFileSync(path.join(root, 'tools/runtime/security/processing-jobs.json'), JSON.stringify({ version: 1, jobs }));
      await start(); admin = await login('yod', 'Changed-yod-Password-123'); bob = await login('bobby', 'Changed-bobby-Password-123');
    },
    async restart() {
      await new Promise(resolve => server.close(resolve)); await start();
      admin = await login('yod', 'Changed-yod-Password-123'); bob = await login('bobby', 'Changed-bobby-Password-123');
    },
    async close() { await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); } };
}
test('History follows its source beyond 20 jobs; audit is private, paged and excludes analysis data', async () => {
  const f = await fixture();
  try {
    const id = f.file(f.aid, 'album.wav');
    for (let i = 0; i < 23; i++) await f.done('/analyze', f.admin, { fileId: id });
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 23);
    assert.equal((await f.req('/jobs', f.bob)).data.jobs.length, 0);
    assert.equal((await f.req('/admin/audit')).status, 401);
    assert.equal((await f.req('/admin/audit', f.bob)).status, 403);
    assert.equal((await f.req('/admin/audit?limit=101', f.admin)).status, 400);
    const first = await f.req('/admin/audit?limit=5', f.admin);
    assert.equal(first.status, 200); assert.equal(first.data.entries.length, 5);
    assert.ok(first.data.entries.every(e => e.username === 'yod' && e.size === 5));
    const second = await f.req('/admin/audit?limit=5&before=' + first.data.nextCursor, f.admin);
    assert.ok(second.data.entries.every(e => e.auditId < first.data.nextCursor));
    assert.ok(!JSON.stringify(first.data).includes('PRIVATE-LARGE-RESULT'));
    assert.ok(!JSON.stringify(first.data).includes('boundaries'));
    assert.equal((await f.req('/upload/remove', f.bob, { fileId: id })).status, 404);
    assert.equal((await f.req('/upload/remove', f.admin, { fileId: id })).status, 200);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 0);
    const audit = (await f.req('/admin/audit?limit=100', f.admin)).data.entries;
    assert.equal(audit.filter(e => e.status === 'completed' && e.kind === 'analyze').length, 23);
    assert.ok(audit.some(e => e.status === 'manual-delete' && e.fileId === id));
  } finally { await f.close(); }
});
test('Remove cascades preview, export and multi-source history while keeping another owner isolated', async () => {
  const f = await fixture();
  try {
    const a = f.file(f.aid, 'a.wav'), b = f.file(f.aid, 'b.wav');
    f.file(f.bid, 'b.wav', b);
    const analysis = await f.done('/analyze', f.admin, { fileId: a });
    const preview = await f.done('/preview', f.admin, { fileId: b });
    const exported = await f.done('/export', f.admin, { fileId: b, format: 'wav', boundaries: [] });
    const merged = await f.done('/merge', f.admin, { fileIds: [a, b], format: 'wav', name: 'album' });
    assert.equal((await f.req('/upload/remove', f.admin, { fileId: b })).status, 200);
    assert.ok(!fs.existsSync(path.join(f.root, 'previews', f.aid, b + '.flac')));
    assert.ok(!fs.existsSync(path.join(f.root, 'exports', f.aid, exported.result.jobId)));
    assert.ok(!fs.existsSync(path.join(f.root, 'exports', f.aid, merged.result.jobId)));
    assert.deepEqual((await f.req('/jobs', f.admin)).data.jobs.map(j => j.jobId), [analysis.jobId]);
    assert.equal((await f.req('/jobs/' + preview.jobId, f.admin)).status, 404);
    assert.equal((await f.req('/uploads', f.bob)).data.files[0].fileId, b);
    assert.equal((await f.req('/admin/storage/delete', f.admin, { ownerId: f.bid, id: b, type: 'upload' })).status, 200);
    assert.equal((await f.req('/uploads', f.bob)).data.files.length, 0);
  } finally { await f.close(); }
});
test('59-minute expiry uses the same cascade and protects running and waiting jobs until completion', async () => {
  const controls = [];
  const f = await fixture(() => new Promise(resolve => controls.push(resolve)));
  try {
    const a = f.file(f.aid, 'a.wav'), b = f.file(f.aid, 'b.wav');
    await f.done('/preview', f.admin, { fileId: a });
    const oldExport = await f.done('/export', f.admin, { fileId: a, format: 'wav', boundaries: [] });
    const exportRoot = path.join(f.root, 'exports', f.aid, oldExport.result.jobId);
    const oldTime = new Date(Date.now() - RETENTION - 1000);
    const first = await f.req('/analyze', f.admin, { fileId: a });
    const second = await f.req('/analyze', f.admin, { fileId: b });
    fs.utimesSync(path.join(exportRoot, 'track.wav'), oldTime, oldTime); fs.utimesSync(exportRoot, oldTime, oldTime);
    f.age(f.aid, a); f.age(f.aid, b);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 4);
    assert.ok(fs.existsSync(exportRoot));
    assert.equal((await f.req('/uploads', f.admin)).data.files.length, 2);
    assert.equal((await f.req('/upload/remove', f.admin, { fileId: a })).status, 409);
    assert.equal((await f.req('/admin/storage/delete', f.admin, { ownerId: f.aid, id: b, type: 'upload' })).status, 409);
    controls[0]('{}');
    while (controls.length < 2) await tick();
    assert.equal((await f.req('/uploads', f.admin)).data.files.length, 1);
    assert.equal((await f.req('/jobs/' + first.data.jobId, f.admin)).status, 404);
    assert.ok(!fs.existsSync(path.join(f.root, 'previews', f.aid, a + '.flac')));
    controls[1]('{}'); await tick();
    assert.equal((await f.req('/uploads', f.admin)).data.files.length, 0);
    assert.equal((await f.req('/jobs/' + second.data.jobId, f.admin)).status, 404);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 0);
    const audit = (await f.req('/admin/audit', f.admin)).data.entries;
    assert.equal(audit.filter(e => e.status === 'auto-cleanup' && e.kind === 'upload').length, 2);
    assert.equal(audit.filter(e => e.status === 'completed' && e.kind === 'analyze').length, 2);
  } finally { for (let i = 0; i < 3; i++) { for (const release of controls) release('{}'); await tick(); } await f.close(); }
});
test('Deleting only an export removes its history, and auto expiry cascades recent derivatives', async () => {
  const f = await fixture();
  try {
    const id = f.file(f.aid, 'a.wav');
    const analysis = await f.done('/analyze', f.admin, { fileId: id });
    const output = await f.done('/export', f.admin, { fileId: id, format: 'wav', boundaries: [] });
    assert.equal((await f.req('/export/delete', f.bob, { jobId: output.result.jobId })).status, 404);
    assert.equal((await f.req('/export/delete', f.admin, { jobId: output.result.jobId })).status, 200);
    assert.deepEqual((await f.req('/jobs', f.admin)).data.jobs.map(j => j.jobId), [analysis.jobId]);
    const next = await f.done('/export', f.admin, { fileId: id, format: 'wav', boundaries: [] });
    await f.done('/preview', f.admin, { fileId: id });
    f.age(f.aid, id);
    assert.equal((await f.req('/uploads', f.admin)).data.files.length, 0);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 0);
    assert.ok(!fs.existsSync(path.join(f.root, 'exports', f.aid, next.result.jobId)));
  } finally { await f.close(); }
});
test('Legacy jobs migrate once, recover interrupted work and drop orphan histories without losing audit', async () => {
  const f = await fixture();
  try {
    const id = f.file(f.aid, 'legacy.wav'), vanished = crypto.randomUUID(), now = Date.now();
    const legacy = [
      { id: crypto.randomUUID(), owner: f.aid, kind: 'analyze', fileId: id, filename: 'legacy.wav', queuedAt: now - 5000, startedAt: now - 4000, finishedAt: now - 3000, status: 'succeeded', result: { duration: 42 } },
      { id: crypto.randomUUID(), owner: f.aid, kind: 'preview', fileId: id, filename: 'legacy.wav', queuedAt: now - 2000, startedAt: now - 1000, status: 'running' },
      { id: crypto.randomUUID(), owner: f.aid, kind: 'analyze', fileId: vanished, filename: 'gone.wav', queuedAt: now - 5000, finishedAt: now - 3000, status: 'failed' }
    ];
    // Restart closes and saves current jobs first; inject legacy data between close and next construction via a separate fixture restart hook.
    f.legacy = legacy;
    await f.restartWithJobs(legacy);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 2);
    assert.equal((await f.req('/jobs/' + legacy[0].id, f.admin)).data.result.duration, 42);
    assert.equal((await f.req('/jobs/' + legacy[1].id, f.admin)).data.status, 'failed');
    const before = (await f.req('/admin/audit?limit=100&category=processing', f.admin)).data.entries.length;
    await f.restart();
    assert.equal((await f.req('/admin/audit?limit=100&category=processing', f.admin)).data.entries.length, before);
    assert.equal((await f.req('/jobs', f.admin)).data.jobs.length, 2);
    const store = new ActivityStore(path.join(f.root, 'tools/runtime/security/activity.sqlite'));
    assert.ok(store.audit({ limit: 100 }).entries.some(e => e.fileId === vanished)); store.close();
  } finally { await f.close(); }
});

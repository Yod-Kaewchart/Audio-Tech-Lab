'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { ActivityStore } = require('./activity-store.cjs');
const { createServer } = require('./upload-server.js');
const { createAuth } = require('./auth.cjs');
test('Audit filters query all rows, preserve legacy events, and paginate while new entries arrive', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-audit-store-'));
  const file = path.join(root, 'activity.sqlite'), ownerId = crypto.randomUUID();
  let store = new ActivityStore(file);
  try {
    store.record({ id: crypto.randomUUID(), owner: ownerId, username: 'yod', kind: 'analyze', fileId: crypto.randomUUID(), queuedAt: Date.now(), startedAt: Date.now(), finishedAt: Date.now(), status: 'succeeded', error: 'SECRET-STACK', result: { waveform: ['SECRET-RESULT'] } });
    store.record({ id: crypto.randomUUID(), owner: ownerId, username: 'yod', kind: 'ai-review', fileId: crypto.randomUUID(), queuedAt: Date.now(), startedAt: Date.now(), finishedAt: Date.now(), status: 'succeeded', result: { rationale: 'SECRET-AI-RESULT' }, telemetry: { model: 'gpt-6-sol', candidateCount: 16, shortlistBefore: 20, shortlistSelected: 16, inputTokens: 1200, outputTokens: 300, totalTokens: 1500, prompt: 'SECRET-AI-PROMPT', rawResponse: 'SECRET-AI-RAW' } });
    store.record({ id: crypto.randomUUID(), owner: ownerId, username: 'yod', kind: 'ai-review', fileId: crypto.randomUUID(), queuedAt: Date.now(), startedAt: Date.now(), finishedAt: Date.now(), status: 'failed', error: 'SECRET-PROVIDER-STACK', errorCode: 'OPENAI_TIMEOUT', telemetry: { model: 'gpt-6-sol', candidateCount: 8, shortlistBefore: 12, shortlistSelected: 8, apiKey: 'SECRET-API-KEY' } });
    store.deletion({ ownerId, username: 'deleteduser', kind: 'upload', filename: 'Album.wav', reason: 'auto-cleanup' });
    store.event({ type: 'openai-connected', ownerId, username: 'yod' });
    store.event({ type: 'openai-test-failed', status: 'failed', ownerId, username: 'yod' });
    for (let i = 0; i < 130; i++) store.event({ type: 'login', status: i % 2 ? 'failed' : 'completed', ownerId, username: 'yod', password: 'SECRET-PASSWORD', sessionToken: 'SECRET-TOKEN', csrf: 'SECRET-CSRF', spotifyToken: 'SECRET-SPOTIFY', error: 'SECRET-ERROR' });
    const first = store.audit({ limit: 7, type: 'login', status: 'failed', username: 'yod' });
    assert.equal(first.entries.length, 7); assert.ok(first.nextCursor);
    const ids = first.entries.map(e => e.auditId); let before = first.nextCursor;
    store.event({ type: 'login', status: 'failed', username: 'yod' });
    while (before) {
      const page = store.audit({ limit: 7, before, type: 'login', status: 'failed', username: 'yod' });
      assert.ok(page.entries.every(e => e.auditId < before)); ids.push(...page.entries.map(e => e.auditId)); before = page.nextCursor;
    }
    assert.equal(ids.length, 65); assert.equal(new Set(ids).size, ids.length);
    assert.equal(store.audit({ category: 'processing', type: 'analyze', status: 'completed' }).entries.length, 1);
    assert.equal(store.audit({ category: 'processing', type: 'ai-review', status: 'completed' }).entries.length, 1);
    assert.equal(store.audit({ category: 'integration', type: 'openai-connected', username: 'yod' }).entries.length, 1);
    assert.equal(store.audit({ category: 'integration', type: 'openai-test-failed', status: 'failed' }).entries.length, 1);
    assert.equal(store.audit({ category: 'file', type: 'delete', username: 'deleteduser' }).entries[0].status, 'auto-cleanup');
    assert.equal(store.audit({ username: 'nobody' }).entries.length, 0);
    for (const input of [{ limit: 101 }, { before: 0 }, { type: 'secret' }, { category: 'invalid' }, { status: 'invalid' }, { username: "yod' OR 1=1" }]) assert.throws(() => store.audit(input), { status: 400 });
    const login = JSON.stringify(store.audit({ type: 'login', limit: 100 })); assert.ok(!login.includes('SECRET-'));
    const aiReview = store.audit({ type: 'ai-review', status: 'completed' }).entries[0];
    assert.equal(aiReview.model, 'gpt-6-sol'); assert.equal(aiReview.candidateCount, 16); assert.equal(aiReview.shortlistBefore, 20); assert.equal(aiReview.shortlistSelected, 16); assert.equal(aiReview.totalTokens, 1500);
    const failedReview = store.audit({ type: 'ai-review', status: 'failed' }).entries[0]; assert.equal(failedReview.errorCode, 'OPENAI_TIMEOUT'); assert.equal(failedReview.candidateCount, 8);
    const processing = JSON.stringify(store.audit({ category: 'processing', limit: 100 })); assert.ok(!processing.includes('SECRET-AI-RESULT')); assert.ok(!processing.includes('SECRET-RESULT')); assert.ok(!processing.includes('SECRET-STACK')); assert.ok(!processing.includes('SECRET-AI-PROMPT')); assert.ok(!processing.includes('SECRET-AI-RAW')); assert.ok(!processing.includes('SECRET-PROVIDER-STACK')); assert.ok(!processing.includes('SECRET-API-KEY'));
    const all = store.audit({ limit: 100 }).entries.map(e => e.auditId);
    store.close(); store = new ActivityStore(file); assert.deepEqual(store.audit({ limit: 100 }).entries.map(e => e.auditId), all);
  } finally { store.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
test('Account events are admin-only, identify actor and deleted user, and never persist credentials', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-audit-api-')), origin = 'https://audit-tests.invalid';
  const integrationSecrets = new Set(), openaiStore = { delete: id => integrationSecrets.delete(id) };
  let server;
  async function start() { server = createServer({ root, origin, openaiStore, runJob: async () => '{}' }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); }
  const close = () => new Promise(resolve => server.close(resolve));
  async function req(route, client, data, method) {
    const headers = { Origin: origin, 'Content-Type': 'application/json' };
    if (client) { headers.Cookie = client.cookie; headers['X-CSRF-Token'] = client.csrf; }
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, { method: method || (data === undefined ? 'GET' : 'POST'), headers, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  const credentials = [];
  async function login(username, password) {
    const r = await req('/auth/login', null, { username, password }); assert.equal(r.status, 200);
    const cookie = r.cookie.split(';')[0]; credentials.push(password, r.data.csrf, cookie.split('=')[1]); return { cookie, csrf: r.data.csrf };
  }
  try {
    await start();
    const temporary = fs.readFileSync(path.join(root, 'tools/runtime/security/first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    let admin = await login('yod', temporary);
    assert.equal((await req('/admin/audit', admin)).status, 403);
    assert.equal((await req('/auth/password', admin, { currentPassword: temporary, newPassword: 'Audit-Admin-Password-123' })).status, 200);
    assert.equal((await req('/auth/register', null, { username: 'audituser', email: 'audit@example.invalid', password: 'Audit-User-Password-123' })).status, 201);
    const user = await login('audit@example.invalid', 'Audit-User-Password-123');
    assert.equal((await req('/admin/audit')).status, 401); assert.equal((await req('/admin/audit', user)).status, 403);
    assert.equal((await req('/auth/login', null, { username: 'audituser', password: 'SECRET-WRONG' })).status, 401);
    assert.equal((await req('/auth/login', null, { username: 'unknown-secret-input', password: 'SECRET-WRONG' })).status, 401);
    assert.equal((await req('/auth/logout', user, {})).status, 200);
    assert.equal((await req('/admin/users', admin, { username: 'deleteme', password: 'Delete-Temporary-Password-123' })).status, 201);
    const deleted = (await req('/admin/users', admin)).data.users.find(u => u.username === 'deleteme');
    integrationSecrets.add(deleted.id);
    assert.equal((await req('/admin/users/' + deleted.id, admin, undefined, 'DELETE')).status, 200);
    assert.equal(integrationSecrets.has(deleted.id), false);
    // Rejected administrative operations must not appear as successful events.
    assert.equal((await req('/admin/users/' + deleted.id, admin, undefined, 'DELETE')).status, 404);
    for (const params of ['limit=101', 'before=0', 'category=invalid', 'status=invalid', 'type=invalid', 'username=x%27']) assert.equal((await req('/admin/audit?' + params, admin)).status, 400);
    const snapshot = (await req('/admin/audit?limit=100', admin)).data.entries;
    for (const type of ['login', 'logout', 'register', 'password-changed', 'user-created', 'user-deleted']) assert.ok(snapshot.some(e => e.type === type));
    const deletion = snapshot.find(e => e.type === 'user-deleted'); assert.equal(deletion.username, 'deleteme'); assert.equal(deletion.actorUsername, 'yod'); assert.equal(deletion.ownerId, deleted.id);
    assert.equal(snapshot.filter(e => e.type === 'user-deleted').length, 1);
    const failures = (await req('/admin/audit?type=login&status=failed', admin)).data.entries;
    assert.equal(failures.length, 2); assert.ok(failures.some(e => e.username === 'audituser')); assert.ok(failures.some(e => e.username === null));
    assert.equal((await req('/admin/audit?category=admin&username=deleteme', admin)).data.entries.length, 2);
    const text = JSON.stringify(snapshot);
    const privateUsers = JSON.parse(fs.readFileSync(path.join(root, 'tools/runtime/security/users.json'))).users;
    for (const secret of [...credentials, 'SECRET-WRONG', 'unknown-secret-input', 'audit@example.invalid', ...privateUsers.flatMap(u => [u.hash, u.salt])]) assert.ok(!text.includes(secret));
    await close(); await start(); admin = await login('yod', 'Audit-Admin-Password-123');
    const persisted = (await req('/admin/audit?limit=100', admin)).data.entries;
    assert.ok(snapshot.every(prior => persisted.some(next => next.auditId === prior.auditId)));
    assert.deepEqual((await req('/jobs', admin)).data.jobs, []);
  } finally { if (server?.listening) await close(); fs.rmSync(root, { recursive: true, force: true }); }
});
test('Auth observer is decoupled and does not break a successful login when audit storage fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-audit-hook-')); let auth;
  try {
    let captured; auth = createAuth(root, { onActivity: event => { captured = event; throw new Error('SECRET-BACKEND-ERROR'); } });
    const password = fs.readFileSync(path.join(root, 'first-login.txt'), 'utf8').match(/Temporary password: ([^\r\n]+)/)[1];
    const request = { method: 'POST', headers: { 'content-type': 'application/json' }, socket: {}, };
    let status; const original = console.error; const messages = [];
    console.error = message => messages.push(message);
    try { await auth.handle(request, { setHeader() {} }, '/auth/login', async () => ({ username: 'yod', password }), (_res, code) => { status = code; }, () => new Set()); }
    finally { console.error = original; }
    assert.equal(status, 200); assert.equal(captured.type, 'login'); assert.deepEqual(Object.keys(captured).sort(), ['actorId', 'actorUsername', 'ownerId', 'status', 'type', 'username']);
    assert.ok(!JSON.stringify(captured).includes(password)); assert.deepEqual(messages, ['Account activity could not be recorded']);
  } finally { auth?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

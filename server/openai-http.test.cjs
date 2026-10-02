'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createServer } = require('./upload-server.js');

test('OpenAI BYOK HTTP API is authenticated, CSRF protected and isolated per user', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-openai-http-'));
  const origin = 'https://openai-http-tests.invalid', secrets = new Map();
  const keyA = 'sk-test-' + 'A'.repeat(28) + 'A7xQ', keyB = 'sk-test-' + 'B'.repeat(28) + 'B9yR';
  const validate = value => {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!/^sk-[A-Za-z0-9_-]{17,509}$/.test(key)) throw Object.assign(new Error('Enter a valid OpenAI API key'), { status: 400 });
    return key;
  };
  const openaiStore = {
    has: id => secrets.has(id), write: (id, key) => secrets.set(id, validate(key)),
    read: id => { if (!secrets.has(id)) throw Object.assign(new Error('OpenAI is not connected'), { status: 409 }); return secrets.get(id); },
    delete: id => secrets.delete(id), validate,
    fingerprintFrom: key => '••••' + validate(key).slice(-4),
    status: id => secrets.has(id) ? { connected: true, fingerprint: '••••' + secrets.get(id).slice(-4) } : { connected: false, fingerprint: null }
  };
  const openaiFetch = async (_url, options) => {
    const token = String(options?.headers?.Authorization || '').replace(/^Bearer /, '');
    if (![keyA, keyB].includes(token)) return new Response(JSON.stringify({ error: { message: 'provider-private-detail' } }), { status: 401, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ data: [{ id: 'gpt-6-sol' }, { id: 'unrelated-model' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const server = createServer({ root, origin, openaiStore, openaiFetch, runJob: async () => '{}' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(route, client, { method = 'GET', data, csrf = true } = {}) {
    const headers = { Origin: origin, 'X-Forwarded-Proto': 'https' };
    if (client?.cookie) headers.Cookie = client.cookie;
    if (client?.csrf && csrf) headers['X-CSRF-Token'] = client.csrf;
    let body;
    if (data !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(data); }
    const response = await fetch(base + route, { method, headers, body });
    const value = await response.json();
    return { status: response.status, data: value, cookie: response.headers.get('set-cookie') };
  }
  async function login(username, password) {
    const response = await request('/auth/login', null, { method: 'POST', data: { username, password } });
    assert.equal(response.status, 200);
    return { cookie: response.cookie.split(';')[0], csrf: response.data.csrf };
  }
  try {
    assert.equal((await request('/ai/providers')).status, 401);
    for (const [username, email, password] of [
      ['alice', 'alice@example.invalid', 'Alice-OpenAI-Test-123'],
      ['bobby', 'bobby@example.invalid', 'Bobby-OpenAI-Test-123']
    ]) {
      const created = await request('/auth/register', null, { method: 'POST', data: { username, email, password } });
      assert.equal(created.status, 201);
    }
    const alice = await login('alice', 'Alice-OpenAI-Test-123');
    const bob = await login('bobby', 'Bobby-OpenAI-Test-123');
    let result = await request('/ai/providers', alice);
    assert.equal(result.status, 200); assert.equal(result.data.providers[0].connected, false);
    assert.equal((await request('/ai/openai/test', alice, { method: 'POST', data: { apiKey: keyA }, csrf: false })).status, 403);
    result = await request('/ai/openai/test', alice, { method: 'POST', data: { apiKey: keyA } });
    assert.equal(result.status, 200); assert.equal(result.data.connected, false); assert.deepEqual(result.data.models.map(x => x.id), ['gpt-6-sol']);
    assert.equal(secrets.size, 0);
    result = await request('/ai/openai/credential', alice, { method: 'PUT', data: { apiKey: keyA } });
    assert.equal(result.status, 200); assert.equal(result.data.connected, true); assert.equal(result.data.fingerprint, '••••A7xQ');
    assert.equal(JSON.stringify(result.data).includes(keyA), false);
    result = await request('/ai/providers', bob);
    assert.equal(result.status, 200); assert.equal(result.data.providers[0].connected, false);
    result = await request('/ai/openai/models', alice);
    assert.equal(result.status, 200); assert.deepEqual(result.data.models.map(x => x.id), ['gpt-6-sol']);
    const rejectedKey = 'sk-test-' + 'X'.repeat(32);
    result = await request('/ai/openai/test', alice, { method: 'POST', data: { apiKey: rejectedKey } });
    assert.equal(result.status, 401); assert.equal(result.data.error, 'OpenAI API key was rejected');
    assert.equal(JSON.stringify(result.data).includes('provider-private-detail'), false);
    result = await request('/ai/openai/credential', bob, { method: 'PUT', data: { apiKey: keyB } });
    assert.equal(result.status, 200); assert.equal(secrets.size, 2);
    result = await request('/ai/openai/credential', alice, { method: 'DELETE', data: {} });
    assert.equal(result.status, 200); assert.equal(result.data.connected, false);
    assert.equal(secrets.size, 1); assert.equal([...secrets.values()][0], keyB);
    result = await request('/ai/providers', alice);
    assert.equal(result.status, 200); assert.equal(result.data.providers[0].connected, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

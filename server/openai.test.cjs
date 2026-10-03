'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createOpenAIProvider } = require('./openai.cjs');

function createFixture() {
  const secrets = new Map(), events = [];
  const good = 'sk-test-' + 'A'.repeat(28) + 'A7xQ';
  const other = 'sk-test-' + 'B'.repeat(28) + 'B9yR';
  const validate = value => {
    const key = typeof value === 'string' ? value.trim() : '';
    if (!/^sk-[A-Za-z0-9_-]{17,509}$/.test(key)) throw Object.assign(new Error('Enter a valid OpenAI API key'), { status: 400 });
    return key;
  };
  const store = {
    has: id => secrets.has(id), write: (id, key) => secrets.set(id, validate(key)),
    read: id => { if (!secrets.has(id)) throw Object.assign(new Error('OpenAI is not connected'), { status: 409 }); return secrets.get(id); },
    delete: id => secrets.delete(id), validate,
    fingerprintFrom: key => '••••' + validate(key).slice(-4),
    status: id => secrets.has(id) ? { connected: true, fingerprint: '••••' + secrets.get(id).slice(-4) } : { connected: false, fingerprint: null }
  };
  const fetchImpl = async (_url, options) => {
    const token = String(options?.headers?.Authorization || '').replace(/^Bearer /, '');
    if (![good, other].includes(token)) return new Response(JSON.stringify({ error: { message: 'provider-private-detail' } }), { status: 401 });
    return new Response(JSON.stringify({ data: [{ id: 'gpt-6-sol' }, { id: 'unrelated-model' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = createOpenAIProvider({ store, activity: { event: event => events.push(event) }, fetchImpl });
  const userA = { id: '11111111-1111-4111-8111-111111111111', username: 'alice' };
  const userB = { id: '22222222-2222-4222-8222-222222222222', username: 'bobby' };
  const send = (_res, status, data) => ({ status, data });
  const req = (method, contentType = 'application/json') => ({ method, headers: { 'content-type': contentType } });
  const json = data => async () => data;
  return { provider, store, secrets, events, good, other, userA, userB, send, req, json };
}

test('OpenAI BYOK is isolated per user and exposes only a short fingerprint', async () => {
  const x = createFixture();
  let result = await x.provider.handle(x.req('GET'), {}, '/ai/providers', x.userA, x.json({}), x.send);
  assert.equal(result.data.providers[0].connected, false);
  result = await x.provider.handle(x.req('POST'), {}, '/ai/openai/test', x.userA, x.json({ apiKey: x.good }), x.send);
  assert.equal(result.status, 200); assert.equal(result.data.connected, false); assert.equal(x.secrets.size, 0);
  assert.deepEqual(result.data.models.map(model => model.id), ['gpt-6-sol']);
  result = await x.provider.handle(x.req('PUT'), {}, '/ai/openai/credential', x.userA, x.json({ apiKey: x.good }), x.send);
  assert.equal(result.data.fingerprint, '••••A7xQ'); assert.equal(x.secrets.get(x.userA.id), x.good);
  assert.equal(JSON.stringify(result.data).includes(x.good), false);
  result = await x.provider.handle(x.req('GET'), {}, '/ai/providers', x.userB, x.json({}), x.send);
  assert.equal(result.data.providers[0].connected, false);
  await x.provider.handle(x.req('PUT'), {}, '/ai/openai/credential', x.userB, x.json({ apiKey: x.other }), x.send);
  assert.equal(x.secrets.get(x.userA.id), x.good); assert.equal(x.secrets.get(x.userB.id), x.other);
  result = await x.provider.handle(x.req('DELETE'), {}, '/ai/openai/credential', x.userA, x.json({}), x.send);
  assert.equal(result.data.connected, false); assert.equal(x.secrets.has(x.userA.id), false); assert.equal(x.secrets.has(x.userB.id), true);
  assert.deepEqual(x.events.map(event => event.type), ['openai-connected', 'openai-connected', 'openai-disconnected']);
  assert.equal(JSON.stringify(x.events).includes(x.good), false); assert.equal(JSON.stringify(x.events).includes(x.other), false);
});

test('OpenAI provider sanitizes failures and records only safe audit metadata', async () => {
  const x = createFixture(), rejected = 'sk-test-' + 'X'.repeat(32);
  await assert.rejects(
    x.provider.handle(x.req('POST'), {}, '/ai/openai/test', x.userA, x.json({ apiKey: rejected }), x.send),
    error => error.status === 401 && error.message === 'OpenAI API key was rejected' && !error.message.includes('provider-private-detail')
  );
  assert.equal(x.events.length, 1); assert.equal(x.events[0].type, 'openai-test-failed'); assert.equal(x.events[0].status, 'failed');
  assert.equal(JSON.stringify(x.events).includes(rejected), false);
  await assert.rejects(
    x.provider.handle(x.req('POST', 'text/plain'), {}, '/ai/openai/test', x.userA, x.json({ apiKey: x.good }), x.send),
    error => error.status === 415
  );
  assert.throws(() => x.store.read(x.userA.id), error => error.status === 409);
});

test('AI Review uses Responses API structured outputs without leaking the stored key', async () => {
  const key = 'sk-test-' + 'R'.repeat(28) + 'R7vQ', calls = [];
  const store = {
    read: () => key,
    has: () => true,
    validate: value => value,
    fingerprintFrom: () => '••••R7vQ',
    status: () => ({ connected: true, fingerprint: '••••R7vQ' })
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'gpt-6-sol' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.equal(url, 'https://api.openai.com/v1/responses');
    return new Response(JSON.stringify({ output: [{ type: 'reasoning', id: 'rs_1' }, { type: 'message', content: [{ type: 'output_text', text: '{"summary":"ok","items":[]}' }] }], usage: { input_tokens: 120, output_tokens: 30, total_tokens: 150 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = createOpenAIProvider({ store, fetchImpl });
  const prepared = { instructions: 'system', input: '{"schema_version":1}', format: { type: 'json_schema', name: 'review', strict: true, schema: { type: 'object' } }, candidateCount: 1 };
  const result = await provider.reviewPrepared({ id: '11111111-1111-4111-8111-111111111111', username: 'alice' }, prepared, 'auto');
  assert.equal(result.model, 'gpt-6-sol'); assert.equal(result.outputText, '{"summary":"ok","items":[]}');
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 30, totalTokens: 150 });
  assert.equal(calls.length, 2);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.model, 'gpt-6-sol'); assert.equal(body.store, false); assert.deepEqual(body.reasoning, { effort: 'high' });
  assert.deepEqual(body.text.format, prepared.format); assert.equal(body.instructions, 'system'); assert.equal(body.input, prepared.input);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer ' + key);
  assert.equal(JSON.stringify(body).includes(key), false);
});

test('AI Review aborts a running Responses request and exposes only safe error codes', async () => {
  const key = 'sk-test-' + 'C'.repeat(28) + 'C7zQ';
  const store = { read: () => key, has: () => true, validate: value => value, fingerprintFrom: () => '••••C7zQ', status: () => ({ connected: true, fingerprint: '••••C7zQ' }) };
  let sawAbort = false;
  const fetchImpl = async (url, options) => {
    if (url.endsWith('/v1/responses')) return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => { sawAbort = true; const error = new Error('private abort detail'); error.name = 'AbortError'; reject(error); }, { once: true });
    });
    return new Response(JSON.stringify({ data: [{ id: 'gpt-6-sol' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = createOpenAIProvider({ store, fetchImpl, reviewTimeoutMs: 30000 });
  const prepared = { instructions: 'system', input: '{}', format: { type: 'json_schema', name: 'review', strict: true, schema: { type: 'object' } }, candidateCount: 1 };
  const controller = new AbortController();
  const task = provider.reviewPrepared({ id: '11111111-1111-4111-8111-111111111111', username: 'alice' }, prepared, 'gpt-6-sol', { signal: controller.signal });
  controller.abort();
  await assert.rejects(task, error => error.cancelled === true && error.safeCode === 'USER_CANCELLED' && !error.message.includes('private'));
  assert.equal(sawAbort, true);
});

test('AI Review maps provider failures to stable safe codes without automatic retries', async () => {
  const key = 'sk-test-' + 'D'.repeat(28) + 'D7wQ';
  const store = { read: () => key, has: () => true, validate: value => value, fingerprintFrom: () => '••••D7wQ', status: () => ({ connected: true, fingerprint: '••••D7wQ' }) };
  const prepared = { instructions: 'system', input: '{}', format: { type: 'json_schema', name: 'review', strict: true, schema: { type: 'object' } }, candidateCount: 1 };
  for (const [status, code] of [[401, 'OPENAI_AUTH'], [403, 'OPENAI_FORBIDDEN'], [429, 'OPENAI_QUOTA'], [500, 'OPENAI_UNAVAILABLE']]) {
    let calls = 0;
    const provider = createOpenAIProvider({ store, fetchImpl: async () => { calls++; return new Response('{}', { status }); } });
    await assert.rejects(provider.reviewPrepared({ id: '11111111-1111-4111-8111-111111111111', username: 'alice' }, prepared, 'gpt-6-sol'),
      error => error.safeCode === code);
    assert.equal(calls, 1);
  }
  const timeoutProvider = createOpenAIProvider({ store, fetchImpl: async () => { const error = new Error('private timeout'); error.name = 'TimeoutError'; throw error; } });
  await assert.rejects(timeoutProvider.reviewPrepared({ id: '11111111-1111-4111-8111-111111111111', username: 'alice' }, prepared, 'gpt-6-sol'),
    error => error.safeCode === 'OPENAI_TIMEOUT' && !error.message.includes('private'));
  const invalidProvider = createOpenAIProvider({ store, fetchImpl: async () => new Response(JSON.stringify({ output: [] }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(invalidProvider.reviewPrepared({ id: '11111111-1111-4111-8111-111111111111', username: 'alice' }, prepared, 'gpt-6-sol'),
    error => error.safeCode === 'AI_INVALID_OUTPUT');
});

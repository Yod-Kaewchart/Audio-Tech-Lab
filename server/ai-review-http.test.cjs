'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createServer } = require('./upload-server.js');

test('Phase 3 AI Review uses server Analyze state, queue isolation and validated advisory output', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atl-ai-review-http-'));
  const origin = 'https://ai-review-tests.invalid', secrets = new Map(), calls = [];
  const apiKey = 'sk-test-' + 'K'.repeat(28) + 'K4pQ';
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
  const openaiFetch = async (url, options) => {
    calls.push({ url, options });
    const token = String(options?.headers?.Authorization || '').replace(/^Bearer /, '');
    if (token !== apiKey) return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: 'gpt-6-sol' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/v1/responses')) return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'One strong candidate', items: [{ candidate_index: 0, recommendation: 'accept', confidence: 0.91, rationale: 'Low interval and spectral transition align.', reason_code: 'strong_boundary_evidence' }] }) }] }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error('Unexpected OpenAI URL');
  };
  const runJob = async (script, args, input) => {
    const name = path.basename(script), mode = args[1];
    if (name === 'analyze-upload.py') { if (String(args[0]).includes('Race.wav')) await new Promise(resolve => setTimeout(resolve, 150)); return JSON.stringify({ source_id: 'source-test', duration: 10, detections: String(args[0]).includes('Empty.wav') ? [] : [{ frame: 100, time: 5, confidence: 2.5, source: 'Silence Transition' }], level_diagnostics: null, waveform: { minimum: [0], maximum: [0] } }); }
    if (name === 'ai-review-bridge.py' && mode === 'prepare') return JSON.stringify({
      instructions: 'system instructions', input: '{"schema_version":1}', candidateCount: 1,
      format: { type: 'json_schema', name: 'audio_album_splitter_ai_review', strict: true, schema: { type: 'object' } },
      shortlist: { before: 1, selected: 1, nonEmptyWindows: 1, coveredWindows: 1, uncoveredWindows: 0, policy: '60s / max 4 per window / 2s separation / cap 128' },
      candidates: [{ candidateIndex: 0, fullCandidateIndex: 0, time: 5, localTime: 5, sourceId: 'source-test', selectedDetector: 'Silence Transition', selectedConfidence: 2.5, detectors: ['Silence Transition'] }]
    });
    if (name === 'ai-review-bridge.py' && mode === 'validate') {
      const raw = JSON.parse(input); assert.equal(raw.candidateCount, 1); assert.ok(raw.outputText.includes('strong_boundary_evidence'));
      return JSON.stringify({ summary: 'One strong candidate', items: [{ candidateIndex: 0, recommendation: 'accept', confidence: 0.91, rationale: 'Low interval and spectral transition align.', reasonCode: 'strong_boundary_evidence' }] });
    }
    throw new Error('Unexpected worker invocation: ' + name + ' ' + mode);
  };
  const server = createServer({ root, origin, openaiStore, openaiFetch, runJob });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(route, client, { method = 'GET', data, csrf = true, headers: extra = {} } = {}) {
    const headers = { Origin: origin, 'X-Forwarded-Proto': 'https', ...extra };
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
  async function completed(client, submitted) {
    assert.equal(submitted.status, 202);
    for (let i = 0; i < 100; i++) {
      const current = await request('/jobs/' + submitted.data.jobId, client);
      if (current.data.status === 'succeeded' || current.data.status === 'failed') return current;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('job did not finish');
  }
  async function upload(client, name = 'Album.wav') {
    const payload = Buffer.from('synthetic-audio');
    let response = await request('/upload/init', client, { method: 'POST', data: { name, size: payload.length } });
    assert.equal(response.status, 200);
    const uploadId = response.data.uploadId;
    response = await fetch(base + '/upload/chunk', { method: 'POST', headers: { Origin: origin, 'X-Forwarded-Proto': 'https', Cookie: client.cookie, 'X-CSRF-Token': client.csrf, 'X-Upload-Id': uploadId, 'X-Chunk-Index': '0' }, body: payload });
    assert.equal(response.status, 200);
    const done = await request('/upload/complete', client, { method: 'POST', data: { uploadId } });
    assert.equal(done.status, 200); return done.data.fileId;
  }
  try {
    for (const [username, email, password] of [
      ['alice', 'alice-review@example.invalid', 'Alice-Review-Test-123'],
      ['bobby', 'bobby-review@example.invalid', 'Bobby-Review-Test-123']
    ]) {
      const created = await request('/auth/register', null, { method: 'POST', data: { username, email, password } });
      assert.equal(created.status, 201);
    }
    const alice = await login('alice', 'Alice-Review-Test-123');
    const bob = await login('bobby', 'Bobby-Review-Test-123');
    const fileId = await upload(alice);
    assert.equal((await request('/ai/review', alice, { method: 'POST', data: { fileId } })).status, 409);
    assert.equal((await request('/ai/review', alice, { method: 'POST', data: { fileId }, csrf: false })).status, 403);
    assert.equal((await request('/ai/review', bob, { method: 'POST', data: { fileId } })).status, 404);
    let job = await completed(alice, await request('/analyze', alice, { method: 'POST', data: { fileId } }));
    assert.equal(job.data.status, 'succeeded');
    const beforeConnectCalls = calls.length;
    const disconnectedReview = await request('/ai/review', alice, { method: 'POST', data: { fileId } });
    assert.equal(disconnectedReview.status, 409); assert.equal(disconnectedReview.data.error, 'OpenAI is not connected');
    assert.equal(calls.length, beforeConnectCalls);
    let connected = await request('/ai/openai/credential', alice, { method: 'PUT', data: { apiKey } });
    assert.equal(connected.status, 200);
    job = await completed(alice, await request('/ai/review', alice, { method: 'POST', data: { fileId, model: 'auto' } }));
    assert.equal(job.data.status, 'succeeded');
    const result = job.data.result;
    assert.equal(result.model, 'gpt-6-sol'); assert.equal(result.summary, 'One strong candidate');
    assert.equal(result.items.length, 1); assert.equal(result.items[0].recommendation, 'accept'); assert.equal(result.items[0].time, 5);
    assert.equal(result.items[0].reasonCode, 'strong_boundary_evidence');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(apiKey), false); assert.equal(serialized.includes('system instructions'), false); assert.equal(serialized.includes('schema_version'), false);
    assert.ok(calls.some(call => call.url.endsWith('/v1/responses')));
    const history = await request('/jobs', alice);
    assert.ok(history.data.jobs.some(item => item.kind === 'ai-review' && item.fileId === fileId));
    const emptyId = await upload(alice, 'Empty.wav');
    job = await completed(alice, await request('/analyze', alice, { method: 'POST', data: { fileId: emptyId } }));
    assert.equal(job.data.status, 'succeeded'); assert.equal(job.data.result.detections.length, 0);
    const responseCalls = calls.filter(call => call.url.endsWith('/v1/responses')).length;
    const emptyReview = await request('/ai/review', alice, { method: 'POST', data: { fileId: emptyId } });
    assert.equal(emptyReview.status, 409); assert.equal(emptyReview.data.error, 'Analyze found no candidates for AI Review');
    assert.equal(calls.filter(call => call.url.endsWith('/v1/responses')).length, responseCalls);
    const raceId = await upload(alice, 'Race.wav');
    const pendingAnalyze = await request('/analyze', alice, { method: 'POST', data: { fileId: raceId } });
    assert.equal(pendingAnalyze.status, 202);
    const duringAnalyze = await request('/ai/review', alice, { method: 'POST', data: { fileId: raceId } });
    assert.equal(duringAnalyze.status, 409); assert.equal(duringAnalyze.data.error, 'Analyze is still running; wait before AI Review');
    await completed(alice, pendingAnalyze);
    assert.equal(calls.filter(call => call.url.endsWith('/v1/responses')).length, responseCalls);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

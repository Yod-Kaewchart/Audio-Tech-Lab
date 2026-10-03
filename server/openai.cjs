'use strict';
const SUPPORTED_MODELS = new Map([
  ['gpt-6-sol', { id: 'gpt-6-sol', label: 'GPT-6 Sol', default: true }]
]);
function fail(status, message) { return Object.assign(new Error(message), { status }); }

function createOpenAIProvider({ store, activity, fetchImpl = global.fetch, timeoutMs = 15000, reviewTimeoutMs = 90000 } = {}) {
  if (!store || typeof fetchImpl !== 'function') throw new Error('OpenAI provider dependencies are required');
  function audit(event) {
    try { activity?.event(event); } catch { console.error('Integration activity could not be recorded'); }
  }
  function identity(user) {
    return { ownerId: user.id, username: user.username, actorId: user.id, actorUsername: user.username };
  }
  async function availableModels(apiKey) {
    let response;
    try {
      response = await fetchImpl('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw fail(504, 'OpenAI connection timed out');
      throw fail(502, 'OpenAI is temporarily unavailable');
    }
    if (!response.ok) {
      if (response.status === 401) throw fail(401, 'OpenAI API key was rejected');
      if (response.status === 403) throw fail(403, 'OpenAI API access is not permitted');
      if (response.status === 429) throw fail(429, 'OpenAI quota or request limit was reached');
      throw fail(502, 'OpenAI is temporarily unavailable');
    }
    let data;
    try { data = await response.json(); } catch { throw fail(502, 'OpenAI returned an invalid response'); }
    if (!Array.isArray(data?.data)) throw fail(502, 'OpenAI returned an invalid response');
    const ids = new Set(data.data.map(item => item?.id).filter(id => typeof id === 'string'));
    return [...SUPPORTED_MODELS.values()].filter(model => ids.has(model.id));
  }
  function extractOutputText(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
    const parts = [];
    for (const item of Array.isArray(data?.output) ? data.output : []) {
      if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
      }
    }
    return parts.join('\n').trim();
  }
  async function reviewPrepared(user, prepared, requestedModel = 'auto') {
    if (!prepared || typeof prepared.instructions !== 'string' || typeof prepared.input !== 'string' ||
        !prepared.format || typeof prepared.format !== 'object' || !Number.isInteger(prepared.candidateCount) || prepared.candidateCount < 1)
      throw fail(500, 'AI Review request could not be prepared');
    const apiKey = store.read(user.id);
    let model = requestedModel;
    if (model === undefined || model === null || model === '' || model === 'auto') {
      const models = await availableModels(apiKey);
      model = models.find(item => item.default)?.id || models[0]?.id;
      if (!model) throw fail(409, 'No supported AI Review model is available for this API account');
    }
    if (!SUPPORTED_MODELS.has(model)) throw fail(400, 'Unsupported AI Review model');
    let response;
    try {
      response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model,
          store: false,
          reasoning: { effort: 'high' },
          instructions: prepared.instructions,
          input: prepared.input,
          text: { format: prepared.format }
        }),
        signal: AbortSignal.timeout(reviewTimeoutMs)
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw fail(504, 'OpenAI AI Review timed out');
      throw fail(502, 'OpenAI is temporarily unavailable');
    }
    if (!response.ok) {
      if (response.status === 401) throw fail(401, 'OpenAI API key was rejected');
      if (response.status === 403) throw fail(403, 'OpenAI API access is not permitted');
      if (response.status === 429) throw fail(429, 'OpenAI quota or request limit was reached');
      throw fail(502, 'OpenAI could not complete AI Review');
    }
    let data;
    try { data = await response.json(); } catch { throw fail(502, 'OpenAI returned an invalid response'); }
    const outputText = extractOutputText(data);
    if (!outputText) throw fail(502, 'OpenAI response did not contain AI Review output');
    return { model, outputText };
  }
  async function testKey(user, apiKey) {
    const key = store.validate(apiKey);
    try {
      const models = await availableModels(key);
      return { key, models };
    } catch (error) {
      audit({ type: 'openai-test-failed', status: 'failed', ...identity(user) });
      throw error;
    }
  }
  async function handle(req, res, route, user, json, send) {
    if (!route.startsWith('/ai/')) return false;
    if (req.method === 'GET' && route === '/ai/providers') {
      const state = store.status(user.id);
      return send(res, 200, { providers: [{ id: 'openai', name: 'OpenAI', ...state }] });
    }
    if (req.method === 'POST' && route === '/ai/openai/test') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON request required');
      const data = await json(req, 4096);
      const transient = Object.prototype.hasOwnProperty.call(data, 'apiKey');
      const key = transient ? store.validate(data.apiKey) : store.read(user.id);
      try {
        const models = await availableModels(key);
        return send(res, 200, { ok: true, connected: !transient && store.has(user.id),
          fingerprint: store.fingerprintFrom(key), models });
      } catch (error) {
        audit({ type: 'openai-test-failed', status: 'failed', ...identity(user) });
        throw error;
      }
    }
    if (req.method === 'PUT' && route === '/ai/openai/credential') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON request required');
      const data = await json(req, 4096);
      const { key, models } = await testKey(user, data.apiKey);
      store.write(user.id, key);
      audit({ type: 'openai-connected', status: 'completed', ...identity(user) });
      return send(res, 200, { ok: true, connected: true, fingerprint: store.fingerprintFrom(key), models });
    }
    if (req.method === 'DELETE' && route === '/ai/openai/credential') {
      const removed = store.delete(user.id);
      if (removed) audit({ type: 'openai-disconnected', status: 'completed', ...identity(user) });
      return send(res, 200, { ok: true, connected: false });
    }
    if (req.method === 'GET' && route === '/ai/openai/models') {
      const key = store.read(user.id);
      const models = await availableModels(key);
      return send(res, 200, { models });
    }
    throw fail(404, 'Not found');
  }
  return { handle, availableModels, reviewPrepared };
}
module.exports = { createOpenAIProvider, SUPPORTED_MODELS };
